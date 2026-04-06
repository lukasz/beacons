package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// buildBaseURL returns the public-facing base URL (scheme + host) for the request,
// correctly handling reverse proxies like Cloudflare.
func buildBaseURL(r *http.Request) string {
	scheme := "https"
	if r.TLS == nil && (strings.HasPrefix(r.Host, "localhost") || strings.HasPrefix(r.Host, "127.0.0.1")) {
		scheme = "http"
	}
	// Behind Cloudflare Flexible SSL, X-Forwarded-Proto may be "http" even though
	// the public URL is https. Only trust it for localhost; in production always use https.
	if fwd := r.Header.Get("X-Forwarded-Proto"); fwd != "" && scheme == "http" {
		scheme = fwd
	}
	return fmt.Sprintf("%s://%s", scheme, r.Host)
}

func main() {
	db := NewSupabaseClient()
	hub := NewHub(db)

	// API: create room
	http.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		id := hub.generateRoomID()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": id})
	})

	// API: create room from template (Linear cycle retro or new template board)
	http.HandleFunc("/api/rooms/template", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var tpl struct {
			SessionName string `json:"sessionName"`
			TeamName    string `json:"teamName"`
			BeatGoal    string `json:"beatGoal"`
			TeamID      string `json:"teamId"`
			UserID      string `json:"userId"`
			UserName    string `json:"userName"`
			IsTemplate  bool   `json:"isTemplate"`
			Sections    []struct {
				Title    string `json:"title"`
				ColorIdx int    `json:"colorIdx"`
			} `json:"sections"`
			CycleStats json.RawMessage `json:"cycleStats"`
		}
		if err := json.NewDecoder(r.Body).Decode(&tpl); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		id := hub.generateRoomID()
		state := NewBoardState(id)
		state.SessionName = tpl.SessionName
		state.TeamName = tpl.TeamName
		state.BeatGoal = tpl.BeatGoal
		state.TeamID = tpl.TeamID
		if len(tpl.CycleStats) > 0 {
			state.CycleStats = tpl.CycleStats
		}

		// Layout sections based on count
		gap := 40.0
		startX, startY := 60.0, 80.0
		n := len(tpl.Sections)

		// Determine grid layout
		var cols int
		switch {
		case n <= 2:
			cols = n // 1 or 2 in a row
		case n <= 4:
			cols = 2 // 2×2 grid
		case n <= 6:
			cols = 3 // 3×2 grid
		default:
			cols = 4
		}

		// Section dimensions based on layout
		var sectionW, sectionH float64
		if cols <= 2 && n <= 2 {
			sectionW, sectionH = 1125.0, 650.0
		} else {
			sectionW, sectionH = 560.0, 500.0
		}

		for i, sec := range tpl.Sections {
			secID := genID()
			col := i % cols
			row := i / cols
			sx := startX + float64(col)*(sectionW+gap)
			sy := startY + float64(row)*(sectionH+gap)

			state.Sections[secID] = &Section{
				ID:       secID,
				Title:    sec.Title,
				ColorIdx: sec.ColorIdx,
				X:        sx,
				Y:        sy,
				W:        sectionW,
				H:        sectionH,
				Order:    i,
			}
		}

		// Pre-create user entry
		if tpl.UserID != "" {
			state.Users[tpl.UserID] = &User{
				ID:   tpl.UserID,
				Name: tpl.UserName,
			}
		}

		// Save to Supabase immediately
		if db != nil {
			var saveErr error
			if tpl.IsTemplate {
				saveErr = db.SaveBoardAsTemplate(id, state)
			} else {
				saveErr = db.SaveBoard(id, state)
			}
			if saveErr != nil {
				log.Printf("template save error for %s: %v", id, saveErr)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": id})
	})

	// API: clone a board (used to create a board from a template)
	// Accepts optional JSON body to overlay metadata onto the clone
	http.HandleFunc("/api/rooms/clone/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		sourceID := strings.TrimPrefix(r.URL.Path, "/api/rooms/clone/")
		if sourceID == "" {
			http.Error(w, "source id required", http.StatusBadRequest)
			return
		}

		if db == nil {
			http.Error(w, "no persistence", http.StatusInternalServerError)
			return
		}

		// Optional overlay data
		var overlay struct {
			SessionName string          `json:"sessionName"`
			TeamName    string          `json:"teamName"`
			BeatGoal    string          `json:"beatGoal"`
			TeamID      string          `json:"teamId"`
			UserID      string          `json:"userId"`
			UserName    string          `json:"userName"`
			CycleStats  json.RawMessage `json:"cycleStats"`
		}
		// Decode body if present; ignore errors (body may be empty for plain clones)
		json.NewDecoder(r.Body).Decode(&overlay)

		source, err := db.LoadBoard(sourceID)
		if err != nil {
			log.Printf("clone load error for %s: %v", sourceID, err)
			http.Error(w, "failed to load source board", http.StatusInternalServerError)
			return
		}
		if source == nil {
			http.Error(w, "source board not found", http.StatusNotFound)
			return
		}

		newID := hub.generateRoomID()
		clone := NewBoardState(newID)
		clone.SessionName = source.SessionName

		// Apply overlay if provided
		if overlay.SessionName != "" {
			clone.SessionName = overlay.SessionName
		}
		if overlay.TeamName != "" {
			clone.TeamName = overlay.TeamName
		}
		if overlay.BeatGoal != "" {
			clone.BeatGoal = overlay.BeatGoal
		}
		if overlay.TeamID != "" {
			clone.TeamID = overlay.TeamID
		}
		if len(overlay.CycleStats) > 0 {
			clone.CycleStats = overlay.CycleStats
		}
		if overlay.UserID != "" {
			clone.Users[overlay.UserID] = &User{
				ID:   overlay.UserID,
				Name: overlay.UserName,
			}
		}

		// Clone sections with new IDs, keep mapping for post-its
		sectionMap := make(map[string]string) // old ID → new ID
		for oldID, sec := range source.Sections {
			newSecID := genID()
			sectionMap[oldID] = newSecID
			clone.Sections[newSecID] = &Section{
				ID:       newSecID,
				Title:    sec.Title,
				ColorIdx: sec.ColorIdx,
				X:        sec.X,
				Y:        sec.Y,
				W:        sec.W,
				H:        sec.H,
				Order:    sec.Order,
			}
		}

		// Clone groups with new IDs
		groupMap := make(map[string]string)
		for oldID, g := range source.Groups {
			newGID := genID()
			groupMap[oldID] = newGID
			clone.Groups[newGID] = &Group{
				ID:    newGID,
				Label: g.Label,
				X:     g.X,
				Y:     g.Y,
				W:     g.W,
				H:     g.H,
			}
		}

		// Clone post-its with new IDs, remap section and group references
		for _, p := range source.PostIts {
			newPID := genID()
			newSec := sectionMap[p.SectionID]
			if newSec == "" {
				newSec = p.SectionID
			}
			newGroup := groupMap[p.GroupID]
			clone.PostIts[newPID] = &PostIt{
				ID:        newPID,
				SectionID: newSec,
				AuthorID:  "",
				Text:      p.Text,
				X:         p.X,
				Y:         p.Y,
				Hidden:    false,
				GroupID:   newGroup,
				Votes:     0,
				ColorIdx:  p.ColorIdx,
			}
		}

		if err := db.SaveBoard(newID, clone); err != nil {
			log.Printf("clone save error for %s: %v", newID, err)
			http.Error(w, "failed to save cloned board", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": newID})
	})

	// API: check board access mode (no auth required)
	http.HandleFunc("/api/rooms/access/", func(w http.ResponseWriter, r *http.Request) {
		roomID := strings.TrimPrefix(r.URL.Path, "/api/rooms/access/")
		if roomID == "" {
			http.Error(w, "room id required", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"accessMode": hub.getRoomAccessMode(roomID)})
	})

	// ── Linear OAuth ──
	linearClientID := os.Getenv("LINEAR_OAUTH_CLIENT_ID")
	linearClientSecret := os.Getenv("LINEAR_OAUTH_CLIENT_SECRET")
	// CSRF state store (in-memory, short-lived)
	var oauthStates sync.Map

	// GET /api/linear/auth — redirect user to Linear OAuth
	http.HandleFunc("/api/linear/auth", func(w http.ResponseWriter, r *http.Request) {
		if linearClientID == "" || linearClientSecret == "" {
			http.Error(w, "Linear OAuth not configured", http.StatusServiceUnavailable)
			return
		}
		// Generate random state for CSRF protection
		stateBytes := make([]byte, 16)
		rand.Read(stateBytes)
		state := hex.EncodeToString(stateBytes)
		// Store with the redirect_uri the frontend wants to return to
		returnTo := r.URL.Query().Get("return_to")
		if returnTo == "" {
			returnTo = "/"
		}
		oauthStates.Store(state, returnTo)

		// Build redirect URI (same origin)
		redirectURI := buildBaseURL(r) + "/api/linear/callback"
		log.Printf("Linear OAuth: host=%s fwd=%s redirect_uri=%s", r.Host, r.Header.Get("X-Forwarded-Proto"), redirectURI)

		authURL := fmt.Sprintf(
			"https://linear.app/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=read,write,issues:create&state=%s&prompt=consent",
			url.QueryEscape(linearClientID),
			url.QueryEscape(redirectURI),
			url.QueryEscape(state),
		)
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	})

	// GET /api/linear/callback — exchange code for access token
	http.HandleFunc("/api/linear/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")
		if code == "" || state == "" {
			http.Error(w, "missing code or state", http.StatusBadRequest)
			return
		}

		// Validate state
		returnToVal, ok := oauthStates.LoadAndDelete(state)
		if !ok {
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}
		returnTo := returnToVal.(string)

		// Build redirect URI (must match the one used in /api/linear/auth)
		redirectURI := buildBaseURL(r) + "/api/linear/callback"

		// Exchange code for token
		tokenData := url.Values{
			"client_id":     {linearClientID},
			"client_secret": {linearClientSecret},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"grant_type":    {"authorization_code"},
		}
		resp, err := http.PostForm("https://api.linear.app/oauth/token", tokenData)
		if err != nil {
			log.Printf("Linear token exchange error: %v", err)
			http.Error(w, "token exchange failed", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)

		if resp.StatusCode != 200 {
			log.Printf("Linear token exchange status %d: %s", resp.StatusCode, string(body))
			http.Error(w, "token exchange failed", http.StatusBadGateway)
			return
		}

		var tokenResp struct {
			AccessToken string `json:"access_token"`
			TokenType   string `json:"token_type"`
			ExpiresIn   int    `json:"expires_in"`
			Scope       string `json:"scope"`
		}
		if err := json.Unmarshal(body, &tokenResp); err != nil {
			log.Printf("Linear token parse error: %v", err)
			http.Error(w, "token parse failed", http.StatusInternalServerError)
			return
		}

		// Redirect back to frontend with token in URL fragment (not query string, for security)
		redirectBack := fmt.Sprintf("%s#linear_token=%s", returnTo, url.QueryEscape(tokenResp.AccessToken))
		http.Redirect(w, r, redirectBack, http.StatusTemporaryRedirect)
	})

	// GET /api/linear/status — check if OAuth is configured
	http.HandleFunc("/api/linear/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"oauthEnabled": linearClientID != "" && linearClientSecret != ""})
	})

	// WebSocket: /ws/{roomID}?name=X&userId=Y
	http.HandleFunc("/ws/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/ws/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			http.Error(w, "room id required", http.StatusBadRequest)
			return
		}
		roomID := parts[0]
		name := r.URL.Query().Get("name")
		userID := r.URL.Query().Get("userId")
		if name == "" || userID == "" {
			http.Error(w, "name and userId required", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("upgrade error: %v", err)
			return
		}

		room := hub.getOrCreateRoom(roomID)
		client := &Client{
			room:   room,
			conn:   conn,
			send:   make(chan []byte, 256),
			userID: userID,
			name:   name,
		}

		room.register <- client
		go client.writePump()
		go client.readPump()
	})

	// Serve static files from web/dist in production
	distDir := filepath.Join("..", "web", "dist")
	if _, err := os.Stat(distDir); err == nil {
		fs := http.FileServer(http.Dir(distDir))
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Serve index.html for SPA routes
			path := filepath.Join(distDir, r.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) && !strings.HasPrefix(r.URL.Path, "/api") && !strings.HasPrefix(r.URL.Path, "/ws") {
				http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

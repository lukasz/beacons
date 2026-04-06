package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type SupabaseClient struct {
	baseURL    string
	anonKey    string
	httpClient *http.Client
}

func NewSupabaseClient() *SupabaseClient {
	projectRef := os.Getenv("SUPABASE_PROJECT_REF")
	anonKey := os.Getenv("SUPABASE_ANON_KEY")
	if projectRef == "" || anonKey == "" {
		log.Println("SUPABASE_PROJECT_REF and SUPABASE_ANON_KEY not set — persistence disabled")
		return nil
	}

	return &SupabaseClient{
		baseURL: fmt.Sprintf("https://%s.supabase.co/rest/v1", projectRef),
		anonKey: anonKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *SupabaseClient) setHeaders(req *http.Request) {
	req.Header.Set("apikey", s.anonKey)
	req.Header.Set("Authorization", "Bearer "+s.anonKey)
}

// LoadBoard fetches a board's state from Supabase. Returns nil, nil if not found.
func (s *SupabaseClient) LoadBoard(id string) (*BoardState, error) {
	url := fmt.Sprintf("%s/boards?id=eq.%s&select=state,team_id,is_template", s.baseURL, id)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	s.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supabase GET error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("supabase read body error: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("supabase GET status %d: %s", resp.StatusCode, string(body))
	}

	var rows []struct {
		State      json.RawMessage `json:"state"`
		TeamID     *string         `json:"team_id"`
		IsTemplate *bool           `json:"is_template"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("supabase unmarshal rows: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil // board doesn't exist yet
	}

	var state BoardState
	if err := json.Unmarshal(rows[0].State, &state); err != nil {
		return nil, fmt.Errorf("supabase unmarshal state: %w", err)
	}

	// Inject team_id from column into state so clients receive it via sync
	if rows[0].TeamID != nil {
		state.TeamID = *rows[0].TeamID
	}

	return &state, nil
}

// SaveBoard upserts the board state to Supabase (does NOT touch is_template).
func (s *SupabaseClient) SaveBoard(id string, state *BoardState) error {
	teamID := state.TeamID

	stateJSON, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}

	var payload string
	base := fmt.Sprintf(`"id":%q,"state":%s,"updated_at":"now()"`, id, string(stateJSON))
	if teamID != "" {
		payload = fmt.Sprintf(`{%s,"team_id":%q}`, base, teamID)
	} else {
		payload = fmt.Sprintf(`{%s}`, base)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/boards", bytes.NewBufferString(payload))
	if err != nil {
		return err
	}
	s.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase POST error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase POST status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// SaveBoardAsTemplate upserts the board state with is_template=true.
func (s *SupabaseClient) SaveBoardAsTemplate(id string, state *BoardState) error {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}

	payload := fmt.Sprintf(`{"id":%q,"state":%s,"updated_at":"now()","is_template":true}`, id, string(stateJSON))

	req, err := http.NewRequest("POST", s.baseURL+"/boards", bytes.NewBufferString(payload))
	if err != nil {
		return err
	}
	s.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase POST error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase POST status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func init() {
	// Log whether persistence is available
	c := NewSupabaseClient()
	if c != nil {
		log.Printf("Supabase persistence: %s", c.baseURL)
	}
}

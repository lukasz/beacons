package main

import (
	"encoding/json"
	"log"
	"time"
)

type Room struct {
	id         string
	state      *BoardState
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	inbound    chan ClientMessage
	timerDone  chan struct{}
	hub        *Hub
	saveChan   chan struct{}
	saveTimer  *time.Timer
}

func NewRoom(id string, hub *Hub) *Room {
	return &Room{
		id:         id,
		state:      NewBoardState(id),
		clients:    make(map[string]*Client),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		inbound:    make(chan ClientMessage, 256),
		hub:        hub,
		saveChan:   make(chan struct{}, 1),
	}
}

// markDirty schedules a debounced save (2 seconds after last mutation).
func (r *Room) markDirty() {
	if r.hub.db == nil {
		return
	}
	if r.saveTimer != nil {
		r.saveTimer.Stop()
	}
	r.saveTimer = time.AfterFunc(2*time.Second, func() {
		select {
		case r.saveChan <- struct{}{}:
		default:
		}
	})
}

// saveToSupabase snapshots state and saves it asynchronously.
func (r *Room) saveToSupabase() {
	if r.hub.db == nil {
		return
	}
	// Marshal inside the run loop for a consistent snapshot
	data, err := json.Marshal(r.state)
	if err != nil {
		log.Printf("save marshal error for room %s: %v", r.id, err)
		return
	}
	db := r.hub.db
	id := r.id
	go func() {
		var st BoardState
		if err := json.Unmarshal(data, &st); err != nil {
			log.Printf("save unmarshal error for room %s: %v", id, err)
			return
		}
		if err := db.SaveBoard(id, &st); err != nil {
			log.Printf("supabase save error for room %s: %v", id, err)
		}
	}()
}

func (r *Room) Run() {
	cleanupTimer := time.NewTimer(60 * time.Second)
	cleanupTimer.Stop()

	for {
		select {
		case client := <-r.register:
			r.clients[client.userID] = client
			cleanupTimer.Stop()
			if existing, ok := r.state.Users[client.userID]; ok {
				existing.Name = client.name
				existing.Connected = true
				existing.HideMode = true
			} else {
				r.state.Users[client.userID] = &User{
					ID:        client.userID,
					Name:      client.name,
					Connected: true,
					HideMode:  true,
				}
			}
			// Hide this user's post-its by default
			for _, p := range r.state.PostIts {
				if p.AuthorID == client.userID {
					p.Hidden = true
				}
			}
			client.sendSync(r.state)
			r.broadcastMsg(MsgUserJoined, r.state.Users[client.userID])

		case client := <-r.unregister:
			if _, ok := r.clients[client.userID]; ok {
				delete(r.clients, client.userID)
				close(client.send)
				if u, ok := r.state.Users[client.userID]; ok {
					u.Connected = false
				}
				r.broadcastMsg(MsgUserLeft, map[string]string{"userId": client.userID})
				if len(r.clients) == 0 {
					cleanupTimer.Reset(60 * time.Second)
				}
			}

		case msg := <-r.inbound:
			r.handleMessage(msg)

		case data := <-r.broadcast:
			for _, client := range r.clients {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(r.clients, client.userID)
				}
			}

		case <-r.saveChan:
			r.saveToSupabase()

		case <-cleanupTimer.C:
			if len(r.clients) == 0 {
				// Final synchronous save before eviction
				if r.hub.db != nil {
					if err := r.hub.db.SaveBoard(r.id, r.state); err != nil {
						log.Printf("final save error for room %s: %v", r.id, err)
					} else {
						log.Printf("final save for room %s before eviction", r.id)
					}
				}
				r.hub.removeRoom(r.id)
				return
			}
		}
	}
}

func (r *Room) handleMessage(cm ClientMessage) {
	var msg WSMessage
	if err := json.Unmarshal(cm.data, &msg); err != nil {
		log.Printf("bad message from %s: %v", cm.client.userID, err)
		return
	}

	dirty := true // most messages mutate state

	switch msg.Type {
	case MsgAddSection:
		sec, err := r.state.AddSection(msg.Payload)
		if err != nil || sec == nil {
			return
		}
		r.broadcastMsg(MsgAddSection, sec)

	case MsgUpdateSection:
		sec, err := r.state.UpdateSection(msg.Payload)
		if err != nil || sec == nil {
			return
		}
		r.broadcastMsg(MsgUpdateSection, sec)

	case MsgDeleteSection:
		id, err := r.state.DeleteSection(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgDeleteSection, map[string]string{"id": id})

	case MsgAddPostIt:
		p, err := r.state.AddPostIt(msg.Payload)
		if err != nil || p == nil {
			return
		}
		r.broadcastMsg(MsgAddPostIt, p)

	case MsgUpdatePostIt:
		p, err := r.state.UpdatePostIt(msg.Payload)
		if err != nil || p == nil {
			return
		}
		r.broadcastMsg(MsgUpdatePostIt, p)

	case MsgMovePostIt:
		p, err := r.state.MovePostIt(msg.Payload)
		if err != nil || p == nil {
			return
		}
		r.broadcastMsg(MsgMovePostIt, p)

	case MsgDeletePostIt:
		id, err := r.state.DeletePostIt(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgDeletePostIt, map[string]string{"id": id})

	case MsgToggleHide:
		userID, hidden, err := r.state.ToggleHide(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgToggleHide, map[string]interface{}{"userId": userID, "hidden": hidden})

	case MsgAddGroup:
		g, err := r.state.AddGroup(msg.Payload)
		if err != nil || g == nil {
			return
		}
		r.broadcastMsg(MsgAddGroup, g)

	case MsgUpdateGroup:
		g, err := r.state.UpdateGroup(msg.Payload)
		if err != nil || g == nil {
			return
		}
		r.broadcastMsg(MsgUpdateGroup, g)

	case MsgDeleteGroup:
		id, err := r.state.DeleteGroup(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgDeleteGroup, map[string]string{"id": id})

	case MsgTimerSet:
		var payload struct {
			DurationSec int `json:"durationSec"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		r.state.Timer.DurationSec = payload.DurationSec
		r.state.Timer.RemainingSec = payload.DurationSec
		r.state.Timer.Running = false
		r.broadcastMsg(MsgTimerSet, r.state.Timer)

	case MsgTimerAdjust:
		var payload struct {
			DeltaSec int `json:"deltaSec"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		newVal := r.state.Timer.RemainingSec + payload.DeltaSec
		if newVal < 0 {
			newVal = 0
		}
		r.state.Timer.RemainingSec = newVal
		r.state.Timer.DurationSec = r.state.Timer.DurationSec + payload.DeltaSec
		if r.state.Timer.DurationSec < 0 {
			r.state.Timer.DurationSec = 0
		}
		r.broadcastMsg(MsgTimerAdjust, r.state.Timer)

	case MsgTimerStart:
		if r.state.Timer.Running {
			return
		}
		r.state.Timer.Running = true
		r.state.Timer.StartedAt = time.Now().UnixMilli()
		r.broadcastMsg(MsgTimerStart, r.state.Timer)
		r.startTimer()

	case MsgTimerPause:
		r.state.Timer.Running = false
		r.stopTimer()
		r.broadcastMsg(MsgTimerPause, r.state.Timer)

	case MsgTimerReset:
		r.state.Timer.Running = false
		r.state.Timer.RemainingSec = r.state.Timer.DurationSec
		r.stopTimer()
		r.broadcastMsg(MsgTimerReset, r.state.Timer)

	case MsgVoteStart:
		vote, err := r.state.StartVote(msg.Payload, cm.client.userID)
		if err != nil || vote == nil {
			return
		}
		r.broadcastMsg(MsgVoteHistory, r.state.VoteHistory)
		r.broadcastMsg(MsgVoteUpdate, vote)

	case MsgVoteCast:
		if err := r.state.CastVote(cm.client.userID, msg.Payload); err != nil {
			return
		}
		r.broadcastMsg(MsgVoteUpdate, r.state.Vote)

	case MsgVoteUncast:
		if err := r.state.UncastVote(cm.client.userID, msg.Payload); err != nil {
			return
		}
		r.broadcastMsg(MsgVoteUpdate, r.state.Vote)

	case MsgVoteDone:
		r.state.MarkVoteDone(cm.client.userID)
		r.broadcastMsg(MsgVoteUpdate, r.state.Vote)

	case MsgVoteClose:
		r.state.CloseVote()
		r.broadcastMsg(MsgVoteUpdate, r.state.Vote)

	case MsgVoteDismiss:
		r.state.DismissVote()
		r.broadcastMsg(MsgVoteDismiss, r.state.VoteHistory)

	case MsgReaction:
		dirty = false // ephemeral, no state mutation
		var payload struct {
			Emoji string `json:"emoji"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		senderName := ""
		if cm.client != nil {
			if u, ok := r.state.Users[cm.client.userID]; ok {
				senderName = u.Name
			}
		}
		r.broadcastMsg(MsgReaction, map[string]string{"emoji": payload.Emoji, "sender": senderName})

	case MsgUpdateMeta:
		var payload struct {
			SessionName *string `json:"sessionName"`
			TeamName    *string `json:"teamName"`
			BeatGoal    *string `json:"beatGoal"`
			BeatGoalHit *bool   `json:"beatGoalHit"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if payload.SessionName != nil {
			r.state.SessionName = *payload.SessionName
		}
		if payload.TeamName != nil {
			r.state.TeamName = *payload.TeamName
		}
		if payload.BeatGoal != nil {
			r.state.BeatGoal = *payload.BeatGoal
		}
		if payload.BeatGoalHit != nil {
			r.state.BeatGoalHit = payload.BeatGoalHit
		}
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(msg.Payload, &raw); err == nil {
			if v, ok := raw["beatGoalHit"]; ok && string(v) == "null" {
				r.state.BeatGoalHit = nil
			}
		}
		r.broadcastMsg(MsgUpdateMeta, map[string]interface{}{
			"sessionName": r.state.SessionName,
			"teamName":    r.state.TeamName,
			"beatGoal":    r.state.BeatGoal,
			"beatGoalHit": r.state.BeatGoalHit,
		})

	case MsgAddAction:
		a, err := r.state.AddAction(msg.Payload)
		if err != nil || a == nil {
			return
		}
		r.broadcastMsg(MsgAddAction, a)

	case MsgUpdateAction:
		a, err := r.state.UpdateAction(msg.Payload)
		if err != nil || a == nil {
			return
		}
		r.broadcastMsg(MsgUpdateAction, a)

	case MsgDeleteAction:
		id, err := r.state.DeleteAction(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgDeleteAction, map[string]string{"id": id})

	case MsgAddImage:
		img, err := r.state.AddImage(msg.Payload)
		if err != nil || img == nil {
			return
		}
		r.broadcastMsg(MsgAddImage, img)

	case MsgMoveImage:
		img, err := r.state.MoveImage(msg.Payload)
		if err != nil || img == nil {
			return
		}
		r.broadcastMsg(MsgMoveImage, img)

	case MsgDeleteImage:
		id, err := r.state.DeleteImage(msg.Payload)
		if err != nil {
			return
		}
		r.broadcastMsg(MsgDeleteImage, map[string]string{"id": id})

	case MsgCursorMove:
		dirty = false // ephemeral, no state mutation
		var payload struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		senderID := ""
		senderName := ""
		if cm.client != nil {
			senderID = cm.client.userID
			if u, ok := r.state.Users[cm.client.userID]; ok {
				senderName = u.Name
			}
		}
		r.broadcastToOthers(senderID, MsgCursorMove, map[string]interface{}{
			"userId": senderID,
			"name":   senderName,
			"x":      payload.X,
			"y":      payload.Y,
		})

	case MsgUpdateAccess:
		var payload struct {
			AccessMode string `json:"accessMode"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if payload.AccessMode == "org" || payload.AccessMode == "public" {
			r.state.AccessMode = payload.AccessMode
		}
		r.broadcastMsg(MsgUpdateAccess, map[string]string{"accessMode": r.state.AccessMode})

	case "timer_internal_tick":
		dirty = false // don't save on every tick
		if !r.state.Timer.Running {
			return
		}
		r.state.Timer.RemainingSec--
		if r.state.Timer.RemainingSec <= 0 {
			r.state.Timer.RemainingSec = 0
			r.state.Timer.Running = false
			r.stopTimer()
			dirty = true // save when timer finishes
		}
		r.broadcastMsg(MsgTimerTick, r.state.Timer)

	default:
		dirty = false
	}

	if dirty {
		r.markDirty()
	}
}

func (r *Room) broadcastToOthers(excludeUserID string, msgType string, payload interface{}) {
	data, err := marshalMsg(msgType, payload)
	if err != nil {
		log.Printf("broadcast marshal error: %v", err)
		return
	}
	for _, client := range r.clients {
		if client.userID == excludeUserID {
			continue
		}
		select {
		case client.send <- data:
		default:
		}
	}
}

func (r *Room) broadcastMsg(msgType string, payload interface{}) {
	data, err := marshalMsg(msgType, payload)
	if err != nil {
		log.Printf("broadcast marshal error: %v", err)
		return
	}
	r.broadcast <- data
}

func (r *Room) startTimer() {
	r.stopTimer()
	r.timerDone = make(chan struct{})
	done := r.timerDone
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				tick, _ := json.Marshal(WSMessage{Type: "timer_internal_tick"})
				r.inbound <- ClientMessage{client: nil, data: tick}
			}
		}
	}()
}

func (r *Room) stopTimer() {
	if r.timerDone != nil {
		close(r.timerDone)
		r.timerDone = nil
	}
}

func mustMarshal(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}

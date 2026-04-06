package main

import (
	"log"
	"math/rand"
	"sync"
)

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*Room
	db    *SupabaseClient
}

func NewHub(db *SupabaseClient) *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
		db:    db,
	}
}

func (h *Hub) getOrCreateRoom(id string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room, ok := h.rooms[id]; ok {
		return room
	}
	room := NewRoom(id, h)

	// Try to load persisted board state
	if h.db != nil {
		if loaded, err := h.db.LoadBoard(id); err != nil {
			log.Printf("supabase load error for %s: %v", id, err)
		} else if loaded != nil {
			log.Printf("restored board %s from Supabase", id)
			// Mark all users as disconnected (preserve names for sticky authorship)
			for _, u := range loaded.Users {
				u.Connected = false
				u.HideMode = false
			}
			loaded.ID = id
			// Reset transient timer state
			loaded.Timer.Running = false
			// Ensure maps are initialized for older boards
			if loaded.Actions == nil {
				loaded.Actions = make(map[string]*Action)
			}
			if loaded.Images == nil {
				loaded.Images = make(map[string]*ImageElement)
			}
			room.state = loaded
		}
	}

	h.rooms[id] = room
	go room.Run()
	return room
}

func (h *Hub) removeRoom(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, id)
}

func (h *Hub) getRoomAccessMode(id string) string {
	h.mu.RLock()
	room, inMemory := h.rooms[id]
	h.mu.RUnlock()

	if inMemory {
		if room.state.AccessMode != "" {
			return room.state.AccessMode
		}
		return "org"
	}
	// Not in memory — try loading from DB
	if h.db != nil {
		if loaded, err := h.db.LoadBoard(id); err == nil && loaded != nil {
			if loaded.AccessMode != "" {
				return loaded.AccessMode
			}
		}
	}
	return "org"
}

func (h *Hub) generateRoomID() string {
	const chars = "abcdefghjkmnpqrstuvwxyz23456789"
	h.mu.RLock()
	defer h.mu.RUnlock()
	for {
		b := make([]byte, 6)
		for i := range b {
			b[i] = chars[rand.Intn(len(chars))]
		}
		id := string(b)
		if _, exists := h.rooms[id]; !exists {
			return id
		}
	}
}

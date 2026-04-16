package main

import (
	"encoding/json"
	"math/rand"
)

type BoardState struct {
	ID          string                    `json:"id"`
	Sections    map[string]*Section       `json:"sections"`
	PostIts     map[string]*PostIt        `json:"postIts"`
	Groups      map[string]*Group         `json:"groups"`
	Images      map[string]*ImageElement  `json:"images"`
	Timer       TimerState          `json:"timer"`
	Vote        *VoteSession        `json:"vote,omitempty"`
	VoteHistory []*VoteSession      `json:"voteHistory"`
	Users       map[string]*User    `json:"users"`
	Actions     map[string]*Action  `json:"actions"`
	SessionName string              `json:"sessionName"`
	TeamName    string              `json:"teamName"`
	BeatGoal    string              `json:"beatGoal"`
	BeatGoalHit *bool               `json:"beatGoalHit"`
	CycleStats  json.RawMessage     `json:"cycleStats,omitempty"`
	TeamID      string              `json:"teamId,omitempty"`
	AccessMode  string              `json:"accessMode,omitempty"` // "org" (default) or "public"
}

type Action struct {
	ID          string `json:"id"`
	Text        string `json:"text"`
	Done        bool   `json:"done"`
	AuthorID    string `json:"authorId"`
	AuthorName  string `json:"authorName"`
	LinearURL   string `json:"linearUrl,omitempty"`
	LinearKey   string `json:"linearKey,omitempty"`
	CreatedAt   int64  `json:"createdAt"`
}

type Section struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	ColorIdx int     `json:"colorIdx"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	W        float64 `json:"w"`
	H        float64 `json:"h"`
	Order    int     `json:"order"`
}

type PostIt struct {
	ID        string  `json:"id"`
	SectionID string  `json:"sectionId"`
	AuthorID  string  `json:"authorId"`
	Text      string  `json:"text"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Hidden    bool    `json:"hidden"`
	GroupID   string  `json:"groupId,omitempty"`
	Votes     int     `json:"votes"`
	ColorIdx  int     `json:"colorIdx"`
}

type Group struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	W     float64 `json:"w"`
	H     float64 `json:"h"`
}

type ImageElement struct {
	ID  string  `json:"id"`
	URL string  `json:"url"`
	X   float64 `json:"x"`
	Y   float64 `json:"y"`
	W   float64 `json:"w"`
	H   float64 `json:"h"`
}

type TimerState struct {
	DurationSec  int   `json:"durationSec"`
	RemainingSec int   `json:"remainingSec"`
	Running      bool  `json:"running"`
	StartedAt    int64 `json:"startedAt,omitempty"`
	Open         bool  `json:"open,omitempty"`
}

type VoteSession struct {
	ID           string              `json:"id"`
	OrganizerID  string              `json:"organizerId"`
	VotesPerUser int                 `json:"votesPerUser"`
	Votes        map[string][]string `json:"votes"`
	DoneUsers    map[string]bool     `json:"doneUsers"`
	Closed       bool                `json:"closed"`
}

type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
	HideMode  bool   `json:"hideMode"`
}

func NewBoardState(id string) *BoardState {
	return &BoardState{
		ID:          id,
		Sections:    make(map[string]*Section),
		PostIts:     make(map[string]*PostIt),
		Groups:      make(map[string]*Group),
		Images:      make(map[string]*ImageElement),
		Timer:       TimerState{DurationSec: 300, RemainingSec: 300},
		VoteHistory: []*VoteSession{},
		Users:       make(map[string]*User),
		Actions:     make(map[string]*Action),
	}
}

func genID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

// Apply methods

func (s *BoardState) AddSection(data json.RawMessage) (*Section, error) {
	var sec Section
	if err := json.Unmarshal(data, &sec); err != nil {
		return nil, err
	}
	if sec.ID == "" {
		sec.ID = genID()
	}
	sec.Order = len(s.Sections)
	s.Sections[sec.ID] = &sec
	return &sec, nil
}

func (s *BoardState) UpdateSection(data json.RawMessage) (*Section, error) {
	var partial Section
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	sec, ok := s.Sections[partial.ID]
	if !ok {
		return nil, nil
	}
	if partial.Title != "" {
		sec.Title = partial.Title
	}
	if partial.ColorIdx >= 0 {
		sec.ColorIdx = partial.ColorIdx
	}
	if partial.X != 0 || partial.Y != 0 {
		sec.X = partial.X
		sec.Y = partial.Y
	}
	if partial.W != 0 {
		sec.W = partial.W
	}
	if partial.H != 0 {
		sec.H = partial.H
	}
	return sec, nil
}

func (s *BoardState) DeleteSection(data json.RawMessage) (string, error) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	delete(s.Sections, payload.ID)
	return payload.ID, nil
}

func (s *BoardState) AddPostIt(data json.RawMessage) (*PostIt, error) {
	var p PostIt
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	if p.ID == "" {
		p.ID = genID()
	}
	// If the author has hide mode on, auto-hide the new post-it
	if u, ok := s.Users[p.AuthorID]; ok && u.HideMode {
		p.Hidden = true
	}
	s.PostIts[p.ID] = &p
	return &p, nil
}

func (s *BoardState) UpdatePostIt(data json.RawMessage) (*PostIt, error) {
	var partial PostIt
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	p, ok := s.PostIts[partial.ID]
	if !ok {
		return nil, nil
	}
	if partial.Text != "" {
		p.Text = partial.Text
	}
	if partial.SectionID != "" {
		p.SectionID = partial.SectionID
	}
	return p, nil
}

func (s *BoardState) MovePostIt(data json.RawMessage) (*PostIt, error) {
	var move struct {
		ID string  `json:"id"`
		X  float64 `json:"x"`
		Y  float64 `json:"y"`
	}
	if err := json.Unmarshal(data, &move); err != nil {
		return nil, err
	}
	p, ok := s.PostIts[move.ID]
	if !ok {
		return nil, nil
	}
	p.X = move.X
	p.Y = move.Y
	// Check group catching: expand catch zone to include existing grouped post-its
	p.GroupID = ""
	pw, ph := 160.0, 100.0
	cx, cy := p.X+pw/2, p.Y+ph/2

	for _, g := range s.Groups {
		// Start with the group label bounds
		minX, minY := g.X, g.Y
		maxX, maxY := g.X+g.W, g.Y+g.H

		// Expand bounds to include all post-its already in this group
		for _, other := range s.PostIts {
			if other.ID == move.ID || other.GroupID != g.ID {
				continue
			}
			if other.X < minX {
				minX = other.X
			}
			if other.Y < minY {
				minY = other.Y
			}
			if other.X+pw > maxX {
				maxX = other.X + pw
			}
			if other.Y+ph > maxY {
				maxY = other.Y + ph
			}
		}

		// Use generous margin around the expanded bounds
		margin := 80.0
		if cx >= minX-margin && cx <= maxX+margin && cy >= minY-margin && cy <= maxY+margin {
			p.GroupID = g.ID
			break
		}
	}
	return p, nil
}

func (s *BoardState) DeletePostIt(data json.RawMessage) (string, error) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	delete(s.PostIts, payload.ID)
	return payload.ID, nil
}

func (s *BoardState) ToggleHide(data json.RawMessage) (string, bool, error) {
	var payload struct {
		UserID string `json:"userId"`
		Hidden bool   `json:"hidden"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", false, err
	}
	if u, ok := s.Users[payload.UserID]; ok {
		u.HideMode = payload.Hidden
	}
	for _, p := range s.PostIts {
		if p.AuthorID == payload.UserID {
			p.Hidden = payload.Hidden
		}
	}
	return payload.UserID, payload.Hidden, nil
}

func (s *BoardState) AddGroup(data json.RawMessage) (*Group, error) {
	var g Group
	if err := json.Unmarshal(data, &g); err != nil {
		return nil, err
	}
	if g.ID == "" {
		g.ID = genID()
	}
	s.Groups[g.ID] = &g
	return &g, nil
}

func (s *BoardState) UpdateGroup(data json.RawMessage) (*Group, error) {
	var partial Group
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	g, ok := s.Groups[partial.ID]
	if !ok {
		return nil, nil
	}
	if partial.Label != "" {
		g.Label = partial.Label
	}
	if partial.X != 0 || partial.Y != 0 {
		g.X = partial.X
		g.Y = partial.Y
	}
	if partial.W != 0 {
		g.W = partial.W
	}
	if partial.H != 0 {
		g.H = partial.H
	}
	return g, nil
}

func (s *BoardState) DeleteGroup(data json.RawMessage) (string, error) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	// Ungroup any post-its
	for _, p := range s.PostIts {
		if p.GroupID == payload.ID {
			p.GroupID = ""
		}
	}
	delete(s.Groups, payload.ID)
	return payload.ID, nil
}

// Vote methods

func (s *BoardState) StartVote(data json.RawMessage, organizerID string) (*VoteSession, error) {
	var payload struct {
		VotesPerUser int `json:"votesPerUser"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	// Archive existing vote to history
	if s.Vote != nil {
		s.Vote.Closed = true
		s.VoteHistory = append(s.VoteHistory, s.Vote)
	}
	s.Vote = &VoteSession{
		ID:           genID(),
		OrganizerID:  organizerID,
		VotesPerUser: payload.VotesPerUser,
		Votes:        make(map[string][]string),
		DoneUsers:    make(map[string]bool),
	}
	return s.Vote, nil
}

func (s *BoardState) CastVote(userID string, data json.RawMessage) error {
	if s.Vote == nil || s.Vote.Closed {
		return nil
	}
	var payload struct {
		TargetID string `json:"targetId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	// Count user's existing votes
	count := 0
	for _, voters := range s.Vote.Votes {
		for _, v := range voters {
			if v == userID {
				count++
			}
		}
	}
	if count >= s.Vote.VotesPerUser {
		return nil
	}
	s.Vote.Votes[payload.TargetID] = append(s.Vote.Votes[payload.TargetID], userID)
	return nil
}

func (s *BoardState) UncastVote(userID string, data json.RawMessage) error {
	if s.Vote == nil || s.Vote.Closed {
		return nil
	}
	var payload struct {
		TargetID string `json:"targetId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	voters := s.Vote.Votes[payload.TargetID]
	for i, v := range voters {
		if v == userID {
			s.Vote.Votes[payload.TargetID] = append(voters[:i], voters[i+1:]...)
			break
		}
	}
	return nil
}

func (s *BoardState) MarkVoteDone(userID string) {
	if s.Vote == nil || s.Vote.Closed {
		return
	}
	s.Vote.DoneUsers[userID] = true
}

func (s *BoardState) CloseVote() {
	if s.Vote == nil {
		return
	}
	s.Vote.Closed = true
}

func (s *BoardState) DismissVote() {
	if s.Vote != nil {
		s.Vote.Closed = true
		s.VoteHistory = append(s.VoteHistory, s.Vote)
	}
	s.Vote = nil
}

// Action methods

func (s *BoardState) AddAction(data json.RawMessage) (*Action, error) {
	var a Action
	if err := json.Unmarshal(data, &a); err != nil {
		return nil, err
	}
	if a.ID == "" {
		a.ID = genID()
	}
	if s.Actions == nil {
		s.Actions = make(map[string]*Action)
	}
	s.Actions[a.ID] = &a
	return &a, nil
}

func (s *BoardState) UpdateAction(data json.RawMessage) (*Action, error) {
	var partial struct {
		ID        string  `json:"id"`
		Text      *string `json:"text"`
		Done      *bool   `json:"done"`
		LinearURL *string `json:"linearUrl"`
		LinearKey *string `json:"linearKey"`
	}
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	a, ok := s.Actions[partial.ID]
	if !ok {
		return nil, nil
	}
	if partial.Text != nil {
		a.Text = *partial.Text
	}
	if partial.Done != nil {
		a.Done = *partial.Done
	}
	if partial.LinearURL != nil {
		a.LinearURL = *partial.LinearURL
	}
	if partial.LinearKey != nil {
		a.LinearKey = *partial.LinearKey
	}
	return a, nil
}

func (s *BoardState) DeleteAction(data json.RawMessage) (string, error) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	delete(s.Actions, payload.ID)
	return payload.ID, nil
}

// Image methods

func (s *BoardState) AddImage(data json.RawMessage) (*ImageElement, error) {
	var img ImageElement
	if err := json.Unmarshal(data, &img); err != nil {
		return nil, err
	}
	if img.ID == "" {
		img.ID = genID()
	}
	if s.Images == nil {
		s.Images = make(map[string]*ImageElement)
	}
	s.Images[img.ID] = &img
	return &img, nil
}

func (s *BoardState) MoveImage(data json.RawMessage) (*ImageElement, error) {
	var partial struct {
		ID string   `json:"id"`
		X  float64  `json:"x"`
		Y  float64  `json:"y"`
		W  *float64 `json:"w"`
		H  *float64 `json:"h"`
	}
	if err := json.Unmarshal(data, &partial); err != nil {
		return nil, err
	}
	if s.Images == nil {
		return nil, nil
	}
	img, ok := s.Images[partial.ID]
	if !ok {
		return nil, nil
	}
	img.X = partial.X
	img.Y = partial.Y
	if partial.W != nil {
		img.W = *partial.W
	}
	if partial.H != nil {
		img.H = *partial.H
	}
	return img, nil
}

func (s *BoardState) DeleteImage(data json.RawMessage) (string, error) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	if s.Images != nil {
		delete(s.Images, payload.ID)
	}
	return payload.ID, nil
}

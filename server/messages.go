package main

import "encoding/json"

// WSMessage is the envelope for all WebSocket communication.
type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Message type constants
const (
	MsgSync          = "sync"
	MsgUserJoined    = "user_joined"
	MsgUserLeft      = "user_left"
	MsgAddSection    = "add_section"
	MsgUpdateSection = "update_section"
	MsgDeleteSection = "delete_section"
	MsgAddPostIt     = "add_postit"
	MsgUpdatePostIt  = "update_postit"
	MsgDeletePostIt  = "delete_postit"
	MsgMovePostIt    = "move_postit"
	MsgToggleHide    = "toggle_hide"
	MsgToggleHideAll = "toggle_hide_all"
	MsgAddGroup      = "add_group"
	MsgUpdateGroup   = "update_group"
	MsgDeleteGroup   = "delete_group"
	MsgTimerSet      = "timer_set"
	MsgTimerAdjust   = "timer_adjust"
	MsgTimerStart    = "timer_start"
	MsgTimerPause    = "timer_pause"
	MsgTimerReset    = "timer_reset"
	MsgTimerTick     = "timer_tick"
	MsgTimerOpen     = "timer_open"
	MsgVoteStart     = "vote_start"
	MsgVoteCast      = "vote_cast"
	MsgVoteUncast    = "vote_uncast"
	MsgVoteDone      = "vote_done"
	MsgVoteUpdate    = "vote_update"
	MsgVoteClose     = "vote_close"
	MsgVoteDismiss   = "vote_dismiss"
	MsgVoteHistory   = "vote_history"
	MsgReaction      = "reaction"
	MsgUpdateMeta    = "update_meta"
	MsgAddAction     = "add_action"
	MsgUpdateAction  = "update_action"
	MsgDeleteAction  = "delete_action"
	MsgAddImage      = "add_image"
	MsgMoveImage     = "move_image"
	MsgDeleteImage   = "delete_image"
	MsgUpdateAccess  = "update_access"
	MsgCursorMove    = "cursor_move"
)

func marshalMsg(msgType string, payload interface{}) ([]byte, error) {
	p, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return json.Marshal(WSMessage{Type: msgType, Payload: p})
}

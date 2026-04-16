import { useState, useRef, useCallback, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';
import type { PostIt as PostItType } from '../types';
import { POSTIT_COLORS } from '../types';
import { zoomRef } from '../zoomRef';

// Screen-space pointer motion, in px, required before we treat a
// pointerdown as the start of a drag. Anything smaller is a click.
const DRAG_THRESHOLD = 4;

const RANK_MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'];

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface Props {
  postIt: PostItType;
  colorIdx: number;
  voteCount: number;
  canVote: boolean;
  canUnvote: boolean;
  inGroup: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  rank: number;
  selected?: boolean;
  votingActive?: boolean;
  grabMode?: boolean;
}

export default function PostItComponent({ postIt, colorIdx, voteCount, canVote, canUnvote, inGroup, onVote, onUnvote, rank, selected, votingActive, grabMode }: Props) {
  const { state, send, userId } = useBoard();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(postIt.text);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const lastSend = useRef(0);
  const didDrag = useRef(false);

  const isOwn = postIt.authorId === userId;
  const isBlurred = postIt.hidden && !isOwn;
  const mountedRef = useRef(false);

  // Auto-enter edit mode for new empty post-its owned by user
  useEffect(() => {
    if (!mountedRef.current && isOwn && !postIt.text) {
      setEditing(true);
      setEditText('');
    }
    mountedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      didDrag.current = false;
      if (editing || selected || votingActive || grabMode) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      didDrag.current = false;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: postIt.x,
        origY: postIt.y,
      };
    },
    [editing, selected, votingActive, postIt.x, postIt.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      // Screen-space delta — compare against threshold before zoom scaling so
      // a tiny click-wobble never leaves the device regardless of zoom.
      const sdx = e.clientX - dragRef.current.startX;
      const sdy = e.clientY - dragRef.current.startY;
      if (!didDrag.current && Math.abs(sdx) <= DRAG_THRESHOLD && Math.abs(sdy) <= DRAG_THRESHOLD) return;
      didDrag.current = true;

      const z = zoomRef.current || 1;
      const newX = dragRef.current.origX + sdx / z;
      const newY = dragRef.current.origY + sdy / z;

      const now = Date.now();
      if (now - lastSend.current > 30) {
        send('move_postit', { id: postIt.id, x: newX, y: newY });
        lastSend.current = now;
      }
    },
    [send, postIt.id],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const isVotable = canVote && !!postIt.text;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDrag.current || editing || grabMode) return;
      // In voting mode: cast vote (standalone → self, grouped → group via onVote)
      if (isVotable) {
        e.stopPropagation();
        onVote(postIt.id);
        return;
      }
      // No editing during active vote
      if (votingActive) return;
      // Single click to edit own post-it
      if (isOwn) {
        setEditText(postIt.text);
        setEditing(true);
      }
    },
    [isVotable, votingActive, grabMode, onVote, postIt.id, editing, isOwn, postIt.text],
  );

  const finishEdit = useCallback(() => {
    setEditing(false);
    if (editText !== postIt.text) {
      send('update_postit', { id: postIt.id, text: editText });
    }
  }, [editText, postIt.text, postIt.id, send]);

  return (
    <div
      className={`postit ${isBlurred ? 'blurred' : ''} ${isVotable ? 'votable' : ''} ${editing ? 'editing' : ''}`}
      data-item-type="postit"
      data-item-id={postIt.id}
      style={{
        transform: `translate(${postIt.x}px, ${postIt.y}px)`,
        backgroundColor: POSTIT_COLORS[colorIdx] || POSTIT_COLORS[0],
        zIndex: 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {rank > 0 && !inGroup && (
        <div className={`rank-badge rank-${Math.min(rank, 4)}`}>
          {RANK_MEDALS[rank] && <span className="rank-medal">{RANK_MEDALS[rank]}</span>}
          <span className="rank-text">{ordinal(rank)}</span>
        </div>
      )}

      {voteCount > 0 && !inGroup && !rank && (
        <div
          className={`vote-badge ${canUnvote ? 'can-unvote' : ''}`}
          data-count={voteCount}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (canUnvote) onUnvote(postIt.id);
          }}
        />
      )}

      {editing ? (
        <textarea
          className="postit-text-edit"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
              e.preventDefault();
              finishEdit();
            }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="postit-text">{postIt.text}</div>
      )}

      <div className="postit-author">{state.users[postIt.authorId]?.name || postIt.authorId.slice(2, 6)}</div>
    </div>
  );
}

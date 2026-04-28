import { useState, useRef, useCallback } from 'react';
import { useBoard } from '../hooks/useBoard';
import type { Group } from '../types';
import { zoomRef } from '../zoomRef';
import { RANK_MEDALS, ordinal } from '../lib/ranks';

const DRAG_THRESHOLD = 4;

interface Props {
  group: Group;
  voteCount: number;
  canVote: boolean;
  canUnvote: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  rank: number;
  selected?: boolean;
  votingActive?: boolean;
  grabMode?: boolean;
}

export default function GroupLabelComponent({ group, voteCount, canVote, canUnvote, onVote, onUnvote, rank, selected, votingActive, grabMode }: Props) {
  const { send } = useBoard();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(group.label);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const lastSend = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing || selected || votingActive || grabMode) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: group.x,
        origY: group.y,
        moved: false,
      };
    },
    [editing, selected, votingActive, group.x, group.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const sdx = e.clientX - dragRef.current.startX;
      const sdy = e.clientY - dragRef.current.startY;
      if (!dragRef.current.moved && Math.abs(sdx) <= DRAG_THRESHOLD && Math.abs(sdy) <= DRAG_THRESHOLD) return;
      dragRef.current.moved = true;

      const z = zoomRef.current || 1;
      const dx = sdx / z;
      const dy = sdy / z;

      const now = Date.now();
      if (now - lastSend.current > 30) {
        send('update_group', {
          id: group.id,
          label: group.label,
          x: dragRef.current.origX + dx,
          y: dragRef.current.origY + dy,
          w: group.w,
          h: group.h,
        });
        lastSend.current = now;
      }
    },
    [send, group],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className="group-label"
      data-item-type="group"
      data-item-id={group.id}
      style={{ transform: `translate(${group.x}px, ${group.y}px)`, zIndex: rank > 0 ? 60 : undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={() => {
        if (grabMode) return;
        if (canVote) {
          onVote(group.id);
        }
      }}
      onDoubleClick={() => {
        if (votingActive || grabMode) return;
        setLabel(group.label);
        setEditing(true);
      }}
    >
      {rank > 0 && (
        <div className={`rank-badge rank-${Math.min(rank, 4)}`}>
          {RANK_MEDALS[rank] && <span className="rank-medal">{RANK_MEDALS[rank]}</span>}
          <span className="rank-text">{ordinal(rank)}</span>
        </div>
      )}

      {voteCount > 0 && !rank && (
        <div
          className={`vote-badge ${canUnvote ? 'can-unvote' : ''}`}
          data-count={voteCount}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (canUnvote) onUnvote(group.id);
          }}
        />
      )}
      {editing ? (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            setEditing(false);
            send('update_group', { ...group, label });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setEditing(false);
              send('update_group', { ...group, label });
            }
          }}
          autoFocus
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span>{group.label}</span>
      )}
    </div>
  );
}

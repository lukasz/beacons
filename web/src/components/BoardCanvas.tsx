/**
 * The transformed canvas inside `<Board>` — every drawable item lives
 * here: groups, sections, post-its, images, ghost preview, remote
 * cursors, selection outlines.
 *
 * Pure presentation. Logic stays in `<Board>` and the hooks; this
 * component receives everything as props.
 */
import { COLORS } from '../types';
import type { BoardState, PostIt, Section, Group } from '../types';
import GroupOutline from './GroupOutline';
import SectionComponent from './Section';
import GroupLabelComponent from './GroupLabel';
import PostItComponent from './PostIt';
import { hashCode } from '../lib/hash';
import type { CreationMode } from './FloatingMenu';
import type { SelectedItem } from '../hooks/board/useClipboard';
import type { RemoteCursor } from '../hooks/board/useRemoteCursors';
import type { ImageResizeApi } from '../hooks/board/useImageResize';

interface BoardCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  state: BoardState;
  postIts: PostIt[];
  sections: Section[];
  groups: Group[];
  selection: SelectedItem[];
  selectedIds: Set<string>;

  // Voting wiring
  canVote: boolean;
  hasRemainingVotes: boolean;
  votingActive: boolean;
  rankMap: Record<string, number>;
  getVoteCount: (targetId: string) => number;
  getEffectiveVoteCount: (postItId: string) => number;
  getEffectiveRank: (postItId: string) => number;
  getSectionColorIdx: (sectionId: string) => number;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onGroupVote: (id: string) => void;
  onGroupUnvote: (id: string) => void;

  grabMode: boolean;
  creationMode: CreationMode;
  ghostPos: { x: number; y: number } | null;

  cursorsEnabled: boolean;
  remoteCursors: RemoteCursor[];

  /** Used to seed an image resize from each handle's onPointerDown. */
  startImageResize: ImageResizeApi['start'];
  /** Caller's boardRef so we can setPointerCapture on the resize handles. */
  boardRef: React.RefObject<HTMLDivElement | null>;
}

export default function BoardCanvas(props: BoardCanvasProps) {
  const {
    canvasRef, state, postIts, sections, groups, selection, selectedIds,
    canVote, hasRemainingVotes, votingActive, rankMap,
    getVoteCount, getEffectiveVoteCount, getEffectiveRank, getSectionColorIdx,
    onVote, onUnvote, onGroupVote, onGroupUnvote,
    grabMode, creationMode, ghostPos,
    cursorsEnabled, remoteCursors,
    startImageResize, boardRef,
  } = props;

  return (
    <div className="board-canvas" ref={canvasRef} style={{ transformOrigin: '0 0' }}>
      {groups.map((g) => (
        <GroupOutline
          key={g.id}
          group={g}
          postIts={postIts}
          canVote={canVote && hasRemainingVotes}
          onVote={onGroupVote}
        />
      ))}

      {sections.map((s) => (
        <SectionComponent
          key={s.id}
          section={s}
          selected={selectedIds.has(`section:${s.id}`)}
          grabMode={grabMode}
          votingActive={votingActive}
        />
      ))}

      {groups.map((g) => (
        <GroupLabelComponent
          key={g.id}
          group={g}
          voteCount={getVoteCount(g.id)}
          canVote={canVote && hasRemainingVotes}
          canUnvote={canVote}
          onVote={onGroupVote}
          onUnvote={onGroupUnvote}
          rank={rankMap[g.id] || 0}
          selected={selectedIds.has(`group:${g.id}`)}
          votingActive={votingActive}
          grabMode={grabMode}
        />
      ))}

      {postIts.map((p) => (
        <PostItComponent
          key={p.id}
          postIt={p}
          colorIdx={p.sectionId ? getSectionColorIdx(p.sectionId) : (p.colorIdx || 0)}
          voteCount={getEffectiveVoteCount(p.id)}
          canVote={canVote && hasRemainingVotes}
          canUnvote={canVote}
          inGroup={!!p.groupId}
          onVote={onVote}
          onUnvote={onUnvote}
          rank={getEffectiveRank(p.id)}
          selected={selectedIds.has(`postit:${p.id}`)}
          votingActive={votingActive}
          grabMode={grabMode}
        />
      ))}

      {/* Images */}
      {Object.values(state.images || {}).map((img) => {
        const isSel = selectedIds.has(`image:${img.id}`);
        return (
          <div
            key={img.id}
            className={`board-image ${isSel ? 'selected' : ''}`}
            style={{
              transform: `translate(${img.x}px, ${img.y}px)`,
              width: img.w,
              height: img.h,
            }}
            data-item-type="image"
            data-item-id={img.id}
          >
            <img
              src={img.url}
              alt=""
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                borderRadius: 6, pointerEvents: 'none',
              }}
            />
            {isSel && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <div
                key={corner}
                className={`image-resize-handle image-resize-${corner}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const el = boardRef.current;
                  if (el) el.setPointerCapture(e.pointerId);
                  startImageResize(corner, img, { clientX: e.clientX, clientY: e.clientY });
                }}
              />
            ))}
          </div>
        );
      })}

      {/* Ghost preview for creation mode */}
      {creationMode && ghostPos && (
        <div
          className={`creation-ghost creation-ghost-${creationMode}`}
          style={{ transform: `translate(${ghostPos.x}px, ${ghostPos.y}px)` }}
        >
          {creationMode === 'postit' && '📝'}
          {creationMode === 'group' && '⊞ Group'}
          {creationMode === 'section' && '▦ Section'}
        </div>
      )}

      {/* Remote cursors */}
      {cursorsEnabled && remoteCursors.map((c) => (
        <div
          key={`cursor-${c.userId}`}
          className="remote-cursor"
          style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
        >
          <svg className="remote-cursor-arrow" width="16" height="20" viewBox="0 0 16 20">
            <path
              d="M0 0 L0 16 L4.5 11.5 L8 20 L11 19 L7.5 10.5 L14 10.5 Z"
              fill={COLORS[Math.abs(hashCode(c.userId)) % COLORS.length]}
              stroke="var(--bg)"
              strokeWidth="1"
            />
          </svg>
          <span
            className="remote-cursor-label"
            style={{ background: COLORS[Math.abs(hashCode(c.userId)) % COLORS.length] }}
          >
            {c.name.split(' ')[0]}
          </span>
        </div>
      ))}

      {/* Selection outlines (in canvas space) */}
      {selection.map((item) => {
        let x = 0, y = 0, w = 0, h = 0;
        if (item.type === 'postit') {
          const p = state.postIts[item.id];
          if (!p) return null;
          x = p.x; y = p.y; w = 160; h = 100;
        } else if (item.type === 'section') {
          const s = state.sections[item.id];
          if (!s) return null;
          x = s.x; y = s.y; w = s.w; h = s.h;
        } else if (item.type === 'group') {
          const g = state.groups[item.id];
          if (!g) return null;
          x = g.x; y = g.y; w = g.w; h = g.h;
        } else if (item.type === 'image') {
          const img = (state.images || {})[item.id];
          if (!img) return null;
          x = img.x; y = img.y; w = img.w; h = img.h;
        }
        return (
          <div
            key={`sel-${item.type}-${item.id}`}
            className="selection-outline"
            style={{ transform: `translate(${x - 3}px, ${y - 3}px)`, width: w + 6, height: h + 6 }}
          />
        );
      })}
    </div>
  );
}

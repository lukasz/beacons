import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useBoard } from '../hooks/useBoard';
import { useVoteUI } from '../hooks/board/useVoteUI';
import { useClipboard, type SelectedItem } from '../hooks/board/useClipboard';
import { useRemoteCursors } from '../hooks/board/useRemoteCursors';
import { usePanZoom } from '../hooks/board/usePanZoom';
import { useBoardKeyboard } from '../hooks/board/useBoardKeyboard';
import { useImageResize } from '../hooks/board/useImageResize';
import { useSelectionDrag, snapshotSelection } from '../hooks/board/useSelectionDrag';
import { useMarqueeSelection } from '../hooks/board/useMarqueeSelection';
import { useRadialMenuItems } from '../hooks/board/useRadialMenuItems';
import Toolbar from './Toolbar';
import BoardCanvas from './BoardCanvas';
import VotePanel from './VotePanel';
import ReactionButton from './ReactionButton';
import ReactionRain from './ReactionRain';
import RadialMenu from './RadialMenu';
import type { RadialMenuItem } from './RadialMenu';
import FloatingMenu from './FloatingMenu';
import GiphyPicker from './GiphyPicker';
import type { CreationMode } from './FloatingMenu';
import Timer from './Timer';
import BeatGoal from './BeatGoal';
import HiddenBanner from './HiddenBanner';
import CycleStatsPanel from './CycleStatsPanel';
import ActionsPanel from './ActionsPanel';
import { actions as actionsService, type PreviousAction } from '../services/actions';
import { buildMarkdown } from '../lib/buildMarkdown';
import { organizeBoard } from '../lib/organizeBoard';
import { BoardUiProvider, useBoardUi } from '../state/BoardUiContext';

export default function Board() {
  return (
    <BoardUiProvider>
      <BoardInner />
    </BoardUiProvider>
  );
}

function BoardInner() {
  const { state, send, userId, templateMode } = useBoard();
  const {
    viewingHistoryId,
    ranksVisible,
    votePanelOpen,
    setVotePanelOpen,
    toggleVotePanel,
    cursorsEnabled,
  } = useBoardUi();

  const postIts = useMemo(() => Object.values(state.postIts), [state.postIts]);
  const sections = useMemo(
    () => Object.values(state.sections).sort((a, b) => a.order - b.order),
    [state.sections],
  );
  const groups = useMemo(() => Object.values(state.groups), [state.groups]);

  const voteUI = useVoteUI(state, userId, viewingHistoryId, ranksVisible);
  const { vote, votingActive, canVote, hasRemainingVotes, rankMap, getVoteTarget,
    getVoteCount, getEffectiveVoteCount, getEffectiveRank } = voteUI;

  const handleVote = useCallback(
    (targetId: string) => {
      if (canVote && hasRemainingVotes) {
        send('vote_cast', { targetId: getVoteTarget(targetId) });
      }
    },
    [canVote, hasRemainingVotes, send, getVoteTarget],
  );

  const handleUnvote = useCallback(
    (targetId: string) => {
      if (canVote) {
        send('vote_uncast', { targetId: getVoteTarget(targetId) });
      }
    },
    [canVote, send, getVoteTarget],
  );

  const handleGroupVote = useCallback(
    (groupId: string) => {
      if (canVote && hasRemainingVotes) send('vote_cast', { targetId: groupId });
    },
    [canVote, hasRemainingVotes, send],
  );

  const handleGroupUnvote = useCallback(
    (groupId: string) => {
      if (canVote) send('vote_uncast', { targetId: groupId });
    },
    [canVote, send],
  );

  // ── Copy / Paste ──
  const { copyItems, pasteItems, hasItems: clipboardHasItems } = useClipboard(state, send, userId);

  const getSectionColorIdx = useCallback(
    (sectionId: string) => {
      return state.sections[sectionId]?.colorIdx || 0;
    },
    [state.sections],
  );

  // ── Pan & Zoom ──
  const {
    boardRef, canvasRef, transform, panRef, isPanning, spaceDown,
    zoomDisplay, applyTransform, zoomTo, screenToCanvas, getViewportCenter,
    resetTransform,
  } = usePanZoom();

  // ── Remote Cursors ──
  const { cursors: remoteCursors, trackLocal: trackLocalCursor } = useRemoteCursors(send);

  // ── Creation Mode ──
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [ctxPostItColor, setCtxPostItColor] = useState(0);
  const [ctxSectionColor, setCtxSectionColor] = useState(0);
  const timerOpen = !!state.timer.open;
  const toggleTimerOpen = useCallback(() => {
    send('timer_open', { open: !state.timer.open });
  }, [send, state.timer.open]);
  const closeTimer = useCallback(() => {
    send('timer_open', { open: false });
  }, [send]);
  const [giphyOpen, setGiphyOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const prevActionsCache = useRef<PreviousAction[] | null>(null);

  const getPreviousActions = useCallback(async () => {
    if (prevActionsCache.current) return prevActionsCache.current;
    if (!state.teamId || !state.id) return [];
    const result = await actionsService.previousForTeam(state.teamId, state.id);
    prevActionsCache.current = result;
    return result;
  }, [state.teamId, state.id]);

  const handleExportMarkdown = useCallback(async (selectedIds?: Set<string>) => {
    const prev = await getPreviousActions();
    const md = buildMarkdown(state, selectedIds, prev);
    await navigator.clipboard.writeText(md);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 1500);
  }, [state, getPreviousActions]);

  // votePanelOpen + cursorsEnabled now live in BoardUiContext; nothing to subscribe to.

  // Ghost preview position for creation mode
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // ── Selection state ──
  const [selection, setSelection] = useState<SelectedItem[]>([]);

  // ── Marquee + selection-drag + image-resize hooks ──
  const marqueeSelection = useMarqueeSelection();
  const selectionDrag = useSelectionDrag(send);
  const imageResize = useImageResize(send);
  const [grabMode, setGrabMode] = useState(false);

  // ── Keyboard + system paste subscriptions ──
  useBoardKeyboard({
    hasSelection: selection.length > 0,
    onEscape: () => {
      if (creationMode) {
        setCreationMode(null);
        setGhostPos(null);
      } else if (grabMode) {
        setGrabMode(false);
        if (boardRef.current) boardRef.current.style.cursor = '';
      } else if (selection.length > 0) {
        setSelection([]);
      }
    },
    onDelete: () => {
      const deleteMap: Record<string, string> = {
        postit: 'delete_postit',
        group: 'delete_group',
        section: 'delete_section',
        image: 'delete_image',
      };
      for (const item of selection) send(deleteMap[item.type], { id: item.id });
      setSelection([]);
    },
    onCopy: () => copyItems(selection),
    onPasteImageUrl: (url: string) => {
      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const img = new Image();
      img.onload = () => {
        // 15% of visible board area in canvas coords; scale longest edge.
        const maxW = (rect.width / (transform.current.z || 1)) * 0.15;
        const maxH = (rect.height / (transform.current.z || 1)) * 0.15;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        send('add_image', { url, x: center.x - w / 2, y: center.y - h / 2, w, h });
      };
      img.onerror = () => {
        send('add_image', { url, x: center.x - 100, y: center.y - 75, w: 200, h: 150 });
      };
      img.src = url;
    },
    onPasteInternal: () => {
      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
      pasteItems(center.x, center.y);
    },
    hasClipboard: clipboardHasItems,
  });

  // Place an item at canvas position based on current creation mode
  const placeItem = useCallback(
    (canvasX: number, canvasY: number) => {
      switch (creationMode) {
        case 'postit':
          send('add_postit', {
            sectionId: '',
            authorId: userId,
            text: '',
            x: canvasX,
            y: canvasY,
            colorIdx: ctxPostItColor,
          });
          break;
        case 'group':
          send('add_group', {
            label: 'Group',
            x: canvasX,
            y: canvasY,
            w: 200,
            h: 40,
          });
          break;
        case 'section':
          send('add_section', {
            title: 'New Section',
            colorIdx: ctxSectionColor,
            x: canvasX,
            y: canvasY,
            w: 280,
            h: 500,
          });
          break;
      }
      // Exit creation mode after placing
      setCreationMode(null);
      setGhostPos(null);
    },
    [creationMode, send, userId, ctxPostItColor, ctxSectionColor],
  );

  // ── Radial Context Menu ──
  type ContextTarget = { type: 'postit' | 'group' | 'section' | 'image'; id: string } | null;
  const [radialMenu, setRadialMenu] = useState<{ x: number; y: number; target: ContextTarget; parentSectionId?: string | null } | null>(null);

  // Walk up DOM from target to find an item with data-item-type/data-item-id
  const findItemTarget = useCallback((el: HTMLElement): ContextTarget => {
    let node: HTMLElement | null = el;
    while (node && node !== boardRef.current) {
      const itemType = node.dataset.itemType as 'postit' | 'group' | 'section' | 'image' | undefined;
      const itemId = node.dataset.itemId;
      if (itemType && itemId) {
        return { type: itemType, id: itemId };
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  // Find the parent section element (if right-click is inside a section body)
  const findParentSection = useCallback((el: HTMLElement): string | null => {
    let node: HTMLElement | null = el;
    while (node && node !== boardRef.current) {
      if (node.classList.contains('section')) {
        // Find the section header child to get the id
        const header = node.querySelector('.section-header');
        if (header) return (header as HTMLElement).dataset.itemId || null;
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (creationMode) {
        setCreationMode(null);
        setGhostPos(null);
        return;
      }
      const target = findItemTarget(e.target as HTMLElement);
      const parentSectionId = !target ? findParentSection(e.target as HTMLElement) : null;
      setRadialMenu({ x: e.clientX, y: e.clientY, target, parentSectionId });
    },
    [creationMode, findItemTarget],
  );

  const closeRadialMenu = useCallback(() => setRadialMenu(null), []);

  const radialMenuItems = useRadialMenuItems({
    state, userId, selection, radialMenu,
    ctxPostItColor, ctxSectionColor, votingActive,
    screenToCanvas, hasClipboard: clipboardHasItems,
    send, copyItems, pasteItems,
    clearSelection: () => setSelection([]),
    onExportMarkdown: handleExportMarkdown,
    toggleVotePanel,
  });

  // ── Pan / Marquee / Selection-drag handlers ──
  const DRAG_THRESHOLD = 4;

  const handleBoardPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Close radial menu on any click
      if (radialMenu) {
        setRadialMenu(null);
        return;
      }

      const target = e.target as HTMLElement;
      const isEmptyArea = target === boardRef.current || target === canvasRef.current || target.classList.contains('section-body');
      const forcePan = e.button === 1 || (e.button === 0 && spaceDown.current);

      // If in creation mode and clicking on empty area, place the item
      if (creationMode && e.button === 0 && isEmptyArea && !forcePan) {
        e.preventDefault();
        const pos = screenToCanvas(e.clientX, e.clientY);
        placeItem(pos.x, pos.y);
        return;
      }

      // If in grab mode and left-clicking, start panning
      if (grabMode && e.button === 0) {
        e.preventDefault();
        const el = boardRef.current;
        if (el) {
          el.setPointerCapture(e.pointerId);
          el.style.cursor = 'grabbing';
        }
        isPanning.current = true;
        const t = transform.current;
        panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y };
        return;
      }

      // Middle-mouse or space+drag: immediate pan
      if (forcePan) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        e.preventDefault();
        const el = boardRef.current;
        if (el) {
          el.setPointerCapture(e.pointerId);
          el.style.cursor = 'grabbing';
        }
        isPanning.current = true;
        const t = transform.current;
        panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: t.x, origY: t.y };
        return;
      }

      // Left-click on empty area: start marquee selection
      if (e.button === 0 && isEmptyArea) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        e.preventDefault();
        const el = boardRef.current;
        if (el) el.setPointerCapture(e.pointerId);
        const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
        marqueeSelection.start({ clientX: e.clientX, clientY: e.clientY }, rect);
        setSelection([]);
        return;
      }

      // Left-click on an image: select it (images don't handle their own selection)
      if (e.button === 0 && !grabMode && !votingActive) {
        const clickedTarget = findItemTarget(target);
        if (clickedTarget && clickedTarget.type === 'image') {
          e.preventDefault();
          e.stopPropagation();
          const alreadySelected = selection.some((s) => s.type === 'image' && s.id === clickedTarget.id);
          if (!alreadySelected) setSelection([{ type: 'image', id: clickedTarget.id }]);
          const el = boardRef.current;
          if (el) el.setPointerCapture(e.pointerId);
          const dragSnaps = alreadySelected
            ? snapshotSelection(selection, state)
            : (() => {
                const img = (state.images || {})[clickedTarget.id];
                return img ? [{ type: 'image' as const, id: clickedTarget.id, x: img.x, y: img.y }] : [];
              })();
          selectionDrag.start(dragSnaps, { clientX: e.clientX, clientY: e.clientY });
          return;
        }
      }

      // Left-click on a selected item: start dragging the selection.
      // During voting, dragging is disabled so vote-click + wobble doesn't
      // move cards/sections for everyone.
      if (e.button === 0 && selection.length > 0 && !votingActive) {
        const clickedTarget = findItemTarget(target);
        if (clickedTarget && selection.some((s) => s.type === clickedTarget.type && s.id === clickedTarget.id)) {
          e.preventDefault();
          e.stopPropagation();
          const el = boardRef.current;
          if (el) el.setPointerCapture(e.pointerId);
          selectionDrag.start(snapshotSelection(selection, state), { clientX: e.clientX, clientY: e.clientY });
          return;
        }
      }
    },
    [radialMenu, creationMode, screenToCanvas, placeItem, grabMode, selection, findItemTarget, votingActive, state, marqueeSelection, selectionDrag],
  );

  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Always send cursor position to other users (throttled by the hook).
      const cursorPos = screenToCanvas(e.clientX, e.clientY);
      trackLocalCursor(cursorPos.x, cursorPos.y);

      // Update ghost position for creation mode preview
      if (creationMode && !isPanning.current) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setGhostPos(pos);
      }

      // Panning (grab mode, middle-mouse, or space+drag)
      if (panRef.current && isPanning.current) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        transform.current.x = panRef.current.origX + dx;
        transform.current.y = panRef.current.origY + dy;
        applyTransform();
        return;
      }

      // Delegate to whichever pointer interaction is in flight.
      if (marqueeSelection.onPointerMove(e)) return;
      if (imageResize.onPointerMove(e)) return;
      if (selectionDrag.onPointerMove(e)) return;
    },
    [applyTransform, creationMode, screenToCanvas, marqueeSelection, imageResize, selectionDrag],
  );

  const handleBoardPointerUp = useCallback(() => {
    // End panning
    if (isPanning.current) {
      isPanning.current = false;
      panRef.current = null;
      if (boardRef.current) {
        boardRef.current.style.cursor = grabMode ? 'grab' : (spaceDown.current ? 'grab' : '');
      }
    }

    // End marquee — commit hit-tested selection (or clear on a bare click).
    const committed = marqueeSelection.commit(transform.current, state);
    if (committed !== null) setSelection(committed);

    // End selection drag / image resize.
    selectionDrag.onPointerUp();
    imageResize.onPointerUp();
  }, [grabMode, state, marqueeSelection, selectionDrag, imageResize]);

  // Double-click on empty area toggles grab mode
  const handleBoardDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if double-click is inside a section via DOM walk
      let node: HTMLElement | null = target;
      while (node && node !== boardRef.current) {
        if (node.classList.contains('section')) return;
        node = node.parentElement;
      }
      const isEmptyArea = target === boardRef.current || target === canvasRef.current;
      if (!isEmptyArea) return;

      // Also check geometrically if click is inside any section bounds
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      for (const s of Object.values(state.sections)) {
        if (canvasPos.x >= s.x && canvasPos.x <= s.x + s.w &&
            canvasPos.y >= s.y && canvasPos.y <= s.y + s.h) {
          // Inside a section — create a sticky instead of toggling grab mode
          send('add_postit', {
            sectionId: s.id,
            authorId: userId,
            text: '',
            x: canvasPos.x,
            y: canvasPos.y,
          });
          return;
        }
      }

      if (grabMode) {
        setGrabMode(false);
        if (boardRef.current) boardRef.current.style.cursor = '';
      } else {
        setGrabMode(true);
        setSelection([]);
        if (boardRef.current) boardRef.current.style.cursor = 'grab';
      }
    },
    [grabMode, screenToCanvas, state.sections, send, userId],
  );

  // Smooth transition helper for button-triggered zooms
  const smoothZoom = useCallback((fn: () => void) => {
    const el = canvasRef.current;
    if (el) el.classList.add('smooth');
    fn();
    setTimeout(() => { if (el) el.classList.remove('smooth'); }, 220);
  }, []);

  const zoomIn = useCallback(() => {
    smoothZoom(() => {
      const center = getViewportCenter();
      zoomTo(transform.current.z + 0.1, center.x, center.y);
    });
  }, [zoomTo, getViewportCenter, smoothZoom]);

  const zoomOut = useCallback(() => {
    smoothZoom(() => {
      const center = getViewportCenter();
      zoomTo(transform.current.z - 0.1, center.x, center.y);
    });
  }, [zoomTo, getViewportCenter, smoothZoom]);

  const zoomReset = useCallback(() => {
    smoothZoom(resetTransform);
  }, [resetTransform, smoothZoom]);

  // ── OCD Panic Button — dispatch the moves computed by lib/organizeBoard ──
  const handleOrganize = useCallback(() => {
    for (const m of organizeBoard(state)) send(m.msg, m.data);
  }, [state, send]);


  // Build set of selected IDs for quick lookup
  const selectedIds = useMemo(() => new Set(selection.map((s) => `${s.type}:${s.id}`)), [selection]);

  // Determine cursor for board based on mode
  const boardCursor = creationMode ? 'crosshair' : grabMode ? 'grab' : '';

  return (
    <>
      <Toolbar />
      <div className="board-wrapper">
        <div
          className={`board${votingActive ? ' voting-mode' : ''}`}
          ref={boardRef}
          style={boardCursor ? { cursor: boardCursor } : undefined}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onDoubleClick={handleBoardDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <BoardCanvas
            canvasRef={canvasRef}
            boardRef={boardRef}
            state={state}
            postIts={postIts}
            sections={sections}
            groups={groups}
            selection={selection}
            selectedIds={selectedIds}
            canVote={canVote}
            hasRemainingVotes={hasRemainingVotes}
            votingActive={votingActive}
            rankMap={rankMap}
            getVoteCount={getVoteCount}
            getEffectiveVoteCount={getEffectiveVoteCount}
            getEffectiveRank={getEffectiveRank}
            getSectionColorIdx={getSectionColorIdx}
            onVote={handleVote}
            onUnvote={handleUnvote}
            onGroupVote={handleGroupVote}
            onGroupUnvote={handleGroupUnvote}
            grabMode={grabMode}
            creationMode={creationMode}
            ghostPos={ghostPos}
            cursorsEnabled={cursorsEnabled}
            remoteCursors={remoteCursors}
            startImageResize={imageResize.start}
          />

          {/* Marquee selection rectangle (screen space, inside .board but outside canvas) */}
          {marqueeSelection.marquee && (
            <div
              className="marquee-rect"
              style={{
                left: Math.min(marqueeSelection.marquee.sx, marqueeSelection.marquee.ex),
                top: Math.min(marqueeSelection.marquee.sy, marqueeSelection.marquee.ey),
                width: Math.abs(marqueeSelection.marquee.ex - marqueeSelection.marquee.sx),
                height: Math.abs(marqueeSelection.marquee.ey - marqueeSelection.marquee.sy),
              }}
            />
          )}
        </div>

        {/* Floating tool menu */}
        <FloatingMenu
          activeMode={creationMode}
          onModeChange={setCreationMode}
          timerOpen={timerOpen}
          onToggleTimer={toggleTimerOpen}
          hasVoteActivity={votePanelOpen}
          onToggleVotePanel={toggleVotePanel}
          stickyColorIdx={ctxPostItColor}
          onStickyColorChange={setCtxPostItColor}
          sectionColorIdx={ctxSectionColor}
          onSectionColorChange={setCtxSectionColor}
          templateMode={templateMode}
          onGiphyOpen={() => setGiphyOpen(true)}
          hideMode={!!state.users[userId]?.hideMode}
          onToggleHide={() => {
            const current = !!state.users[userId]?.hideMode;
            send('toggle_hide', { userId, hidden: !current });
          }}
          isFacilitator={!!state.createdBy && state.createdBy === userId}
          allHidden={Object.values(state.users).length > 0 && Object.values(state.users).every((u) => u.hideMode)}
          onToggleHideAll={() => {
            const users = Object.values(state.users);
            const everyoneHidden = users.length > 0 && users.every((u) => u.hideMode);
            send('toggle_hide_all', { hidden: !everyoneHidden });
          }}
        />

        {/* Giphy picker */}
        {giphyOpen && (
          <GiphyPicker
            onClose={() => setGiphyOpen(false)}
            onSelect={(url, natW, natH) => {
              setGiphyOpen(false);
              const board = boardRef.current;
              if (!board) return;
              const rect = board.getBoundingClientRect();
              const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
              const maxW = (rect.width / (transform.current.z || 1)) * 0.15;
              const maxH = (rect.height / (transform.current.z || 1)) * 0.15;
              const scale = Math.min(maxW / natW, maxH / natH, 1);
              const w = Math.round(natW * scale);
              const h = Math.round(natH * scale);
              send('add_image', { url, x: center.x - w / 2, y: center.y - h / 2, w, h });
            }}
          />
        )}

        {/* Right-side floating panels */}
        {!templateMode && (
          <div className="right-panels">
            <CycleStatsPanel />
            <ActionsPanel />
            <VotePanel />
          </div>
        )}

        {/* Timer floating panel */}
        {!templateMode && timerOpen && (
          <Timer onClose={closeTimer} />
        )}

        {/* Creation mode banner */}
        {creationMode && (
          <div className="creation-mode-banner">
            Click on the board to place a {creationMode === 'postit' ? 'sticky' : creationMode}
            <button className="btn btn-small btn-secondary" onClick={() => { setCreationMode(null); setGhostPos(null); }} style={{ marginLeft: 12 }}>
              Cancel
            </button>
          </div>
        )}

        {/* Grab mode banner */}
        {grabMode && (
          <div className="creation-mode-banner">
            Grab mode — drag to pan. Double-click or press Escape to exit.
          </div>
        )}

        {/* Selection banner */}
        {selection.length > 0 && !grabMode && (
          <div className="creation-mode-banner">
            {selection.length} item{selection.length > 1 ? 's' : ''} selected — drag to move, Delete to remove
            <button className="btn btn-small btn-secondary" onClick={() => setSelection([])} style={{ marginLeft: 12 }}>
              Deselect
            </button>
          </div>
        )}

        {/* Beat goal floating pill */}
        {!templateMode && <BeatGoal />}

        {!templateMode && <HiddenBanner />}

        {!templateMode && <ReactionButton />}

        <div className="bottom-controls">
          <div className="ocd-wrap">
            <button
              className="ocd-btn"
              onClick={handleOrganize}
            >
              🧹 OCD
            </button>
            <div className="ocd-tooltip">
              <strong>OCD Panic Button</strong>
              <span>Neatly organizes all sections, groups and stickies into tidy grids. Deep breath... everything will be okay.</span>
            </div>
          </div>
          <div className="md-export-wrap">
            <button
              className="md-export-btn"
              onClick={() => handleExportMarkdown()}
            >
              {exportCopied ? '✓' : '📝 MD'}
            </button>
            <div className="md-export-tooltip">
              <strong>Export as Markdown</strong>
              <span>Copy full board content to clipboard as formatted Markdown</span>
            </div>
          </div>
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom out">−</button>
            <button className="zoom-label" onClick={zoomReset} title="Reset zoom">{zoomDisplay}%</button>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
          </div>
        </div>
      </div>

      <ReactionRain />

      {radialMenu && (
        <RadialMenu
          x={radialMenu.x}
          y={radialMenu.y}
          items={radialMenuItems}
          onClose={closeRadialMenu}
        />
      )}

    </>
  );
}

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { VoteSession } from '../types';
import { COLORS } from '../types';
import { useBoard } from '../hooks/useBoard';
import Toolbar from './Toolbar';
import SectionComponent from './Section';
import PostItComponent from './PostIt';
import GroupLabelComponent from './GroupLabel';
import GroupOutline from './GroupOutline';
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
import { fetchPreviousActions, type PreviousAction } from './ActionsPanel';
import { zoomRef } from '../zoomRef';
import { storage } from '../lib/storage';
import { hashCode } from '../lib/hash';
import { buildMarkdown } from '../lib/buildMarkdown';

interface RemoteCursor { userId: string; name: string; x: number; y: number; ts: number }

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.002; // for scroll wheel
const PINCH_SENSITIVITY = 0.008; // for trackpad pinch

export default function Board() {
  const { state, send, userId, templateMode } = useBoard();

  const postIts = useMemo(() => Object.values(state.postIts), [state.postIts]);
  const sections = useMemo(
    () => Object.values(state.sections).sort((a, b) => a.order - b.order),
    [state.sections],
  );
  const groups = useMemo(() => Object.values(state.groups), [state.groups]);

  const vote = state.vote;
  const votingActive = !!vote && !vote.closed;
  const canVote = votingActive && !vote.doneUsers[userId];

  const myVoteCount = useMemo(() => {
    if (!vote) return 0;
    let count = 0;
    for (const voters of Object.values(vote.votes)) {
      for (const v of voters) {
        if (v === userId) count++;
      }
    }
    return count;
  }, [vote, userId]);

  const hasRemainingVotes = vote ? myVoteCount < vote.votesPerUser : false;

  // Get the effective vote target: if post-it is in a group, vote on the group
  const getVoteTarget = useCallback(
    (postItId: string) => {
      const p = state.postIts[postItId];
      if (p?.groupId) return p.groupId;
      return postItId;
    },
    [state.postIts],
  );

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
      if (canVote && hasRemainingVotes) {
        send('vote_cast', { targetId: groupId });
      }
    },
    [canVote, hasRemainingVotes, send],
  );

  const handleGroupUnvote = useCallback(
    (groupId: string) => {
      if (canVote) {
        send('vote_uncast', { targetId: groupId });
      }
    },
    [canVote, send],
  );

  const getVoteCount = useCallback(
    (targetId: string) => {
      if (!vote) return 0;
      const voters = vote.votes[targetId];
      if (!voters) return 0;
      // During active voting, each user only sees their OWN votes per target.
      // The aggregate tally is revealed only after the vote is closed.
      if (!vote.closed) {
        let own = 0;
        for (const v of voters) if (v === userId) own++;
        return own;
      }
      return voters.length;
    },
    [vote, userId],
  );

  // For post-its in groups, get the group's vote count
  const getEffectiveVoteCount = useCallback(
    (postItId: string) => {
      const p = state.postIts[postItId];
      if (p?.groupId) return getVoteCount(p.groupId);
      return getVoteCount(postItId);
    },
    [state.postIts, getVoteCount],
  );

  // ── Copy / Paste ──
  type ClipItemWithOffset = ClipItem & { dx: number; dy: number };
  type ClipboardDataFull = { items: ClipItemWithOffset[] };

  const copyItems = useCallback(
    (items: SelectedItem[]) => {
      if (items.length === 0) return;
      // Collect positions to compute anchor (top-left of bounding box)
      let minX = Infinity;
      let minY = Infinity;
      const raw: { item: SelectedItem; x: number; y: number }[] = [];
      for (const item of items) {
        if (item.type === 'postit') {
          const p = state.postIts[item.id];
          if (!p) continue;
          raw.push({ item, x: p.x, y: p.y });
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
        } else if (item.type === 'group') {
          const g = state.groups[item.id];
          if (!g) continue;
          raw.push({ item, x: g.x, y: g.y });
          if (g.x < minX) minX = g.x;
          if (g.y < minY) minY = g.y;
        } else if (item.type === 'section') {
          const s = state.sections[item.id];
          if (!s) continue;
          raw.push({ item, x: s.x, y: s.y });
          if (s.x < minX) minX = s.x;
          if (s.y < minY) minY = s.y;
        }
      }
      const clipItems: ClipItemWithOffset[] = [];
      for (const { item, x, y } of raw) {
        const dx = x - minX;
        const dy = y - minY;
        if (item.type === 'postit') {
          const p = state.postIts[item.id]!;
          clipItems.push({ type: 'postit', data: { text: p.text, colorIdx: p.colorIdx ?? 0, sectionId: p.sectionId, groupId: p.groupId }, dx, dy });
        } else if (item.type === 'group') {
          const g = state.groups[item.id]!;
          clipItems.push({ type: 'group', data: { label: g.label, w: g.w, h: g.h }, dx, dy });
        } else if (item.type === 'section') {
          const s = state.sections[item.id]!;
          clipItems.push({ type: 'section', data: { title: s.title, colorIdx: s.colorIdx, w: s.w, h: s.h }, dx, dy });
        }
      }
      if (clipItems.length > 0) {
        (clipboardRef as React.MutableRefObject<ClipboardDataFull | null>).current = { items: clipItems };
      }
    },
    [state.postIts, state.groups, state.sections],
  );

  const pasteItems = useCallback(
    (canvasX: number, canvasY: number) => {
      const clip = clipboardRef.current as ClipboardDataFull | null;
      if (!clip || clip.items.length === 0) return;
      for (const item of clip.items) {
        const px = canvasX + item.dx;
        const py = canvasY + item.dy;
        if (item.type === 'postit') {
          send('add_postit', {
            sectionId: '',
            authorId: userId,
            text: item.data.text,
            x: px,
            y: py,
            colorIdx: item.data.colorIdx,
          });
        } else if (item.type === 'group') {
          send('add_group', {
            label: item.data.label,
            x: px,
            y: py,
            w: item.data.w,
            h: item.data.h,
          });
        } else if (item.type === 'section') {
          send('add_section', {
            title: item.data.title,
            colorIdx: item.data.colorIdx,
            x: px,
            y: py,
            w: item.data.w,
            h: item.data.h,
          });
        }
      }
    },
    [send, userId],
  );

  // Track which historical vote the sidebar is viewing
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [ranksVisible, setRanksVisible] = useState(true);

  useEffect(() => {
    const handler = (e: Event) => {
      setViewingHistoryId((e as CustomEvent).detail);
    };
    window.addEventListener('vote-view-change', handler);
    return () => window.removeEventListener('vote-view-change', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setRanksVisible((e as CustomEvent).detail);
    };
    window.addEventListener('vote-ranks-visibility', handler);
    return () => window.removeEventListener('vote-ranks-visibility', handler);
  }, []);

  // The vote to derive rank badges from
  const rankVote = useMemo((): VoteSession | null => {
    if (viewingHistoryId) {
      return (state.voteHistory || []).find((v) => v.id === viewingHistoryId) || null;
    }
    return vote?.closed ? vote : null;
  }, [viewingHistoryId, state.voteHistory, vote]);

  // Ranking map: targetId → rank (1-based) when viewing a closed vote
  const rankMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!rankVote || !ranksVisible) return map;
    const items: { id: string; count: number }[] = [];
    for (const [targetId, voters] of Object.entries(rankVote.votes)) {
      if (voters.length > 0) items.push({ id: targetId, count: voters.length });
    }
    items.sort((a, b) => b.count - a.count);
    for (let i = 0; i < items.length; i++) {
      map[items[i].id] = i + 1;
    }
    return map;
  }, [rankVote, ranksVisible]);

  // Get rank for a post-it (follows group if grouped)
  const getEffectiveRank = useCallback(
    (postItId: string) => {
      const p = state.postIts[postItId];
      if (p?.groupId) return rankMap[p.groupId] || 0;
      return rankMap[postItId] || 0;
    },
    [state.postIts, rankMap],
  );

  const getSectionColorIdx = useCallback(
    (sectionId: string) => {
      return state.sections[sectionId]?.colorIdx || 0;
    },
    [state.sections],
  );

  // ── Pan & Zoom ──
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const transform = useRef({ x: 0, y: 0, z: 1 });
  const [zoomDisplay, setZoomDisplay] = useState(100);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const isPanning = useRef(false);
  const spaceDown = useRef(false);

  // ── Remote Cursors ──
  const [cursorsEnabled, setCursorsEnabled] = useState(() => storage.read('cursors') !== 'off');
  const remoteCursorsRef = useRef<Map<string, RemoteCursor>>(new Map());
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const cursorThrottleRef = useRef(0);
  const cursorRafRef = useRef(0);

  const applyTransform = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const { x, y, z } = transform.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  }, []);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomTo = useCallback(
    (newZoom: number, pivotX: number, pivotY: number) => {
      const t = transform.current;
      const oldZoom = t.z;
      newZoom = clampZoom(newZoom);
      if (newZoom === oldZoom) return;
      const scale = newZoom / oldZoom;
      t.x = pivotX - (pivotX - t.x) * scale;
      t.y = pivotY - (pivotY - t.y) * scale;
      t.z = newZoom;
      zoomRef.current = newZoom;
      applyTransform();
      setZoomDisplay(Math.round(newZoom * 100));
    },
    [applyTransform],
  );

  const getViewportCenter = useCallback(() => {
    const board = boardRef.current;
    if (!board) return { x: 0, y: 0 };
    const rect = board.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }, []);

  // Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spaceDown.current = true;
        if (boardRef.current) boardRef.current.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (boardRef.current && !isPanning.current) boardRef.current.style.cursor = '';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Attach wheel handler as non-passive
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transform.current;
      const rect = board.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad) — use finer sensitivity
        const factor = 1 - e.deltaY * PINCH_SENSITIVITY;
        const newZoom = clampZoom(t.z * factor);
        zoomTo(newZoom, mouseX, mouseY);
      } else if (e.deltaX !== 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scroll (trackpad two-finger swipe) — pan horizontally
        t.x -= e.deltaX;
        applyTransform();
      } else {
        // Regular scroll — zoom centered on mouse
        const factor = 1 - e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = clampZoom(t.z * factor);
        zoomTo(newZoom, mouseX, mouseY);
      }
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => board.removeEventListener('wheel', handleWheel);
  }, [zoomTo, applyTransform]);

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
  const [votePanelOpen, setVotePanelOpen] = useState(false);
  const [giphyOpen, setGiphyOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const prevActionsCache = useRef<PreviousAction[] | null>(null);

  const getPreviousActions = useCallback(async () => {
    if (prevActionsCache.current) return prevActionsCache.current;
    if (!state.teamId || !state.id) return [];
    const result = await fetchPreviousActions(state.teamId, state.id);
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

  useEffect(() => {
    const handler = (e: Event) => setVotePanelOpen((e as CustomEvent).detail);
    window.addEventListener('vote-panel-visibility', handler);
    return () => window.removeEventListener('vote-panel-visibility', handler);
  }, []);

  // ── Cursors toggle listener ──
  useEffect(() => {
    const handler = (e: Event) => setCursorsEnabled((e as CustomEvent).detail);
    window.addEventListener('cursors-toggle', handler);
    return () => window.removeEventListener('cursors-toggle', handler);
  }, []);

  // ── Remote cursor handler ──
  useEffect(() => {
    const handler = (data: unknown) => {
      const d = data as { userId: string; name: string; x: number; y: number };
      remoteCursorsRef.current.set(d.userId, { ...d, ts: Date.now() });
      cancelAnimationFrame(cursorRafRef.current);
      cursorRafRef.current = requestAnimationFrame(() => {
        setRemoteCursors(Array.from(remoteCursorsRef.current.values()));
      });
    };
    (window as unknown as Record<string, unknown>).__handleCursorMove = handler;

    // Clean up stale cursors every 3s
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, c] of remoteCursorsRef.current) {
        if (now - c.ts > 5000) {
          remoteCursorsRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) setRemoteCursors(Array.from(remoteCursorsRef.current.values()));
    }, 3000);

    return () => {
      delete (window as unknown as Record<string, unknown>).__handleCursorMove;
      clearInterval(interval);
      cancelAnimationFrame(cursorRafRef.current);
    };
  }, []);

  // Ghost preview position for creation mode
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // ── Selection state ──
  type SelectedItem = { type: 'postit' | 'group' | 'section' | 'image'; id: string };
  const [selection, setSelection] = useState<SelectedItem[]>([]);

  // ── Clipboard ──
  type ClipItem =
    | { type: 'postit'; data: { text: string; colorIdx: number; sectionId: string; groupId?: string } }
    | { type: 'group'; data: { label: string; w: number; h: number } }
    | { type: 'section'; data: { title: string; colorIdx: number; w: number; h: number } };

  type ClipboardData = { items: ClipItem[]; anchorX: number; anchorY: number };
  const clipboardRef = useRef<ClipboardData | null>(null);
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  const marqueeRef = useRef<{ boardX: number; boardY: number; screenStartX: number; screenStartY: number } | null>(null);
  const [grabMode, setGrabMode] = useState(false);

  // Drag-selected-items state — `moved` flips to true once the pointer has
  // travelled past DRAG_THRESHOLD in screen space; until then we emit nothing
  // so that a plain click never broadcasts a move.
  const selDragRef = useRef<{ startX: number; startY: number; moved: boolean; snaps: { type: string; id: string; x: number; y: number }[] } | null>(null);

  // Image resize state
  const imgResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; corner: string } | null>(null);

  // Convert screen position to canvas position
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const board = boardRef.current;
      if (!board) return { x: 0, y: 0 };
      const rect = board.getBoundingClientRect();
      const t = transform.current;
      return {
        x: (screenX - rect.left - t.x) / t.z,
        y: (screenY - rect.top - t.y) / t.z,
      };
    },
    [],
  );

  // Cancel creation mode / selection / grab mode on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (creationMode) {
          setCreationMode(null);
          setGhostPos(null);
        } else if (grabMode) {
          setGrabMode(false);
          if (boardRef.current) boardRef.current.style.cursor = '';
        } else if (selection.length > 0) {
          setSelection([]);
        }
      }
      // Delete selected items
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length > 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        for (const item of selection) {
          const deleteMap: Record<string, string> = { postit: 'delete_postit', group: 'delete_group', section: 'delete_section', image: 'delete_image' };
          send(deleteMap[item.type], { id: item.id });
        }
        setSelection([]);
      }
      // Copy selected items
      if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey) && selection.length > 0 && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        copyItems(selection);
      }
      // Paste items — place at center of visible viewport
      // NOTE: don't preventDefault here — let the native 'paste' event fire first
      // so the paste-image-URL handler can inspect clipboardData. We handle internal
      // paste inside the 'paste' event listener instead.
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [creationMode, grabMode, selection, send, copyItems, pasteItems, screenToCanvas]);

  // Paste handler — image URLs from system clipboard, or internal board items
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const text = e.clipboardData?.getData('text/plain')?.trim() || '';

      // Check if it's an image URL
      const isImageUrl = /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(text)
        || (/^https?:\/\/.+/i.test(text) && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(text));

      const board = boardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);

      if (isImageUrl) {
        e.preventDefault();
        // Load the image to get natural dimensions, then compute constrained size
        const img = new Image();
        img.onload = () => {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;
          // 15% of visible board area in canvas coords
          const maxW = (rect.width / (transform.current.z || 1)) * 0.15;
          const maxH = (rect.height / (transform.current.z || 1)) * 0.15;
          // Scale so longer edge fits
          const scale = Math.min(maxW / natW, maxH / natH, 1);
          const w = Math.round(natW * scale);
          const h = Math.round(natH * scale);
          send('add_image', {
            url: text,
            x: center.x - w / 2,
            y: center.y - h / 2,
            w,
            h,
          });
        };
        img.onerror = () => {
          // If image fails to load, place with default size
          send('add_image', {
            url: text,
            x: center.x - 100,
            y: center.y - 75,
            w: 200,
            h: 150,
          });
        };
        img.src = text;
      } else if (clipboardRef.current) {
        // Internal board paste (copied stickies/groups/sections)
        e.preventDefault();
        pasteItems(center.x, center.y);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [send, screenToCanvas, pasteItems]);

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

  const radialMenuItems = useMemo((): RadialMenuItem[] => {
    const items: RadialMenuItem[] = [];
    const target = radialMenu?.target || null;
    const parentSectionId = radialMenu?.parentSectionId || null;

    const hasClipboard = !!(clipboardRef.current as ClipboardDataFull | null)?.items?.length;

    const userName = state.users[userId]?.name || 'Unknown';

    // If we have a multi-selection, show bulk actions
    if (selection.length > 1) {
      // Check if any selected items are stickies with text
      const selectedPostIts = selection.filter((s) => s.type === 'postit');
      const stickiesWithText = selectedPostIts.filter((s) => state.postIts[s.id]?.text);

      if (stickiesWithText.length > 0) {
        items.push({
          label: `Turn ${stickiesWithText.length} into actions`,
          icon: '⚡',
          action: () => {
            for (const s of stickiesWithText) {
              const p = state.postIts[s.id];
              if (!p?.text) continue;
              send('add_action', {
                text: p.text.slice(0, 128),
                done: false,
                authorId: userId,
                authorName: userName,
                createdAt: Date.now(),
              });
            }
          },
        });
      }

      items.push({
        label: `Copy ${selection.length} items`,
        icon: '📋',
        action: () => {
          copyItems(selection);
        },
      });
      items.push({
        label: 'Copy as Markdown',
        icon: '📝',
        action: () => {
          const ids = new Set(selection.map((s) => s.id));
          handleExportMarkdown(ids);
        },
      });
      items.push({
        label: `Delete ${selection.length} items`,
        icon: '🗑️',
        variant: 'danger',
        action: () => {
          const deleteMap: Record<string, string> = { postit: 'delete_postit', group: 'delete_group', section: 'delete_section', image: 'delete_image' };
          for (const item of selection) {
            send(deleteMap[item.type], { id: item.id });
          }
          setSelection([]);
        },
      });
      return items;
    }

    if (target) {
      // Right-clicked on a specific item — show item-specific menu
      const labelMap: Record<string, string> = { postit: 'sticky', group: 'group', section: 'section', image: 'image' };
      const deleteMap: Record<string, string> = { postit: 'delete_postit', group: 'delete_group', section: 'delete_section', image: 'delete_image' };

      // Turn sticky into action
      if (target.type === 'postit') {
        const p = state.postIts[target.id];
        if (p?.text) {
          items.push({
            label: 'Turn into action',
            icon: '⚡',
            action: () => {
              send('add_action', {
                text: p.text.slice(0, 128),
                done: false,
                authorId: userId,
                authorName: userName,
                createdAt: Date.now(),
              });
            },
          });
        }
      }

      items.push({
        label: `Copy ${labelMap[target.type]}`,
        icon: '📋',
        action: () => {
          copyItems([target]);
        },
      });
      items.push({
        label: `Delete ${labelMap[target.type]}`,
        icon: '🗑️',
        variant: 'danger',
        action: () => {
          send(deleteMap[target.type], { id: target.id });
        },
      });
    } else {
      // Right-clicked on empty area — show creation menu
      const pos = radialMenu ? screenToCanvas(radialMenu.x, radialMenu.y) : { x: 200, y: 200 };

      // If inside a section, use that section's color for stickies; otherwise use the floating menu selection
      const stickyColor = parentSectionId
        ? (state.sections[parentSectionId]?.colorIdx || 0)
        : ctxPostItColor;

      items.push({
        label: 'New Sticky',
        icon: '📝',
        action: () => {
          send('add_postit', {
            sectionId: parentSectionId || '',
            authorId: userId,
            text: '',
            x: pos.x,
            y: pos.y,
            colorIdx: stickyColor,
          });
        },
      });

      items.push({
        label: 'New Section',
        icon: '📋',
        action: () => {
          send('add_section', {
            title: 'New Section',
            colorIdx: ctxSectionColor,
            x: pos.x,
            y: pos.y,
            w: 500,
            h: 400,
          });
        },
      });

      items.push({
        label: 'New Group',
        icon: '📂',
        action: () => {
          send('add_group', {
            label: 'Group',
            x: pos.x,
            y: pos.y,
            w: 200,
            h: 40,
          });
        },
      });

      if (hasClipboard) {
        items.push({
          label: 'Paste',
          icon: '📌',
          action: () => {
            pasteItems(pos.x, pos.y);
          },
        });
      }

      if (!votingActive) {
        items.push({
          label: 'Start Vote',
          icon: '🗳️',
          action: () => {
            window.dispatchEvent(new CustomEvent('toggle-vote-panel'));
          },
        });
      } else {
        items.push({
          label: 'End Vote',
          icon: '🏁',
          action: () => {
            send('vote_close', {});
          },
        });
      }
    }

    return items;
  }, [radialMenu, screenToCanvas, send, userId, votingActive, ctxPostItColor, ctxSectionColor, state.sections, state.postIts, state.users, selection, copyItems, pasteItems]);

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
        marqueeRef.current = {
          boardX: e.clientX - rect.left,
          boardY: e.clientY - rect.top,
          screenStartX: e.clientX,
          screenStartY: e.clientY,
        };
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
          if (!alreadySelected) {
            setSelection([{ type: 'image', id: clickedTarget.id }]);
          }
          // Start drag
          const el = boardRef.current;
          if (el) el.setPointerCapture(e.pointerId);
          const img = (state.images || {})[clickedTarget.id];
          const snaps: { type: string; id: string; x: number; y: number }[] = [];
          if (alreadySelected) {
            for (const item of selection) {
              if (item.type === 'postit') {
                const p = state.postIts[item.id];
                if (p) snaps.push({ type: 'postit', id: item.id, x: p.x, y: p.y });
              } else if (item.type === 'section') {
                const s = state.sections[item.id];
                if (s) snaps.push({ type: 'section', id: item.id, x: s.x, y: s.y });
              } else if (item.type === 'group') {
                const g = state.groups[item.id];
                if (g) snaps.push({ type: 'group', id: item.id, x: g.x, y: g.y });
              } else if (item.type === 'image') {
                const im = (state.images || {})[item.id];
                if (im) snaps.push({ type: 'image', id: item.id, x: im.x, y: im.y });
              }
            }
          } else if (img) {
            snaps.push({ type: 'image', id: clickedTarget.id, x: img.x, y: img.y });
          }
          selDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, snaps };
          return;
        }
      }

      // Left-click on a selected item: start dragging the selection
      // During voting, dragging is disabled so that vote-click + tiny mouse wobble
      // doesn't move cards/sections for everyone.
      if (e.button === 0 && selection.length > 0 && !votingActive) {
        const clickedTarget = findItemTarget(target);
        if (clickedTarget && selection.some((s) => s.type === clickedTarget.type && s.id === clickedTarget.id)) {
          e.preventDefault();
          e.stopPropagation();
          const el = boardRef.current;
          if (el) el.setPointerCapture(e.pointerId);
          // Snapshot positions of all selected items
          const snaps: { type: string; id: string; x: number; y: number }[] = [];
          for (const item of selection) {
            if (item.type === 'postit') {
              const p = state.postIts[item.id];
              if (p) snaps.push({ type: 'postit', id: item.id, x: p.x, y: p.y });
            } else if (item.type === 'section') {
              const s = state.sections[item.id];
              if (s) snaps.push({ type: 'section', id: item.id, x: s.x, y: s.y });
            } else if (item.type === 'group') {
              const g = state.groups[item.id];
              if (g) snaps.push({ type: 'group', id: item.id, x: g.x, y: g.y });
            } else if (item.type === 'image') {
              const img = (state.images || {})[item.id];
              if (img) snaps.push({ type: 'image', id: item.id, x: img.x, y: img.y });
            }
          }
          selDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, snaps };
          return;
        }
      }
    },
    [radialMenu, creationMode, screenToCanvas, placeItem, grabMode, selection, findItemTarget, votingActive, state.postIts, state.sections, state.groups, state.images],
  );

  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Always send cursor position to other users (throttled ~50ms)
      {
        const now = Date.now();
        if (now - cursorThrottleRef.current > 50) {
          cursorThrottleRef.current = now;
          const pos = screenToCanvas(e.clientX, e.clientY);
          send('cursor_move', { x: pos.x, y: pos.y });
        }
      }

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

      // Marquee selection
      if (marqueeRef.current) {
        const dx = e.clientX - marqueeRef.current.screenStartX;
        const dy = e.clientY - marqueeRef.current.screenStartY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          setMarquee({
            sx: marqueeRef.current.boardX,
            sy: marqueeRef.current.boardY,
            ex: marqueeRef.current.boardX + dx,
            ey: marqueeRef.current.boardY + dy,
          });
        }
        return;
      }

      // Image resize
      if (imgResizeRef.current) {
        const z = zoomRef.current || 1;
        const r = imgResizeRef.current;
        const dx = (e.clientX - r.startX) / z;
        const dy = (e.clientY - r.startY) / z;
        const aspect = r.origW / r.origH;
        let newW = r.origW;
        let newH = r.origH;
        let newX = r.origX;
        let newY = r.origY;
        if (r.corner === 'se') {
          newW = Math.max(40, r.origW + dx);
          newH = newW / aspect;
        } else if (r.corner === 'sw') {
          newW = Math.max(40, r.origW - dx);
          newH = newW / aspect;
          newX = r.origX + r.origW - newW;
        } else if (r.corner === 'ne') {
          newW = Math.max(40, r.origW + dx);
          newH = newW / aspect;
          newY = r.origY + r.origH - newH;
        } else if (r.corner === 'nw') {
          newW = Math.max(40, r.origW - dx);
          newH = newW / aspect;
          newX = r.origX + r.origW - newW;
          newY = r.origY + r.origH - newH;
        }
        send('move_image', { id: r.id, x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) });
        return;
      }

      // Selection drag
      if (selDragRef.current) {
        const sdx = e.clientX - selDragRef.current.startX;
        const sdy = e.clientY - selDragRef.current.startY;
        if (!selDragRef.current.moved && Math.abs(sdx) <= DRAG_THRESHOLD && Math.abs(sdy) <= DRAG_THRESHOLD) return;
        selDragRef.current.moved = true;

        const z = zoomRef.current || 1;
        const dx = sdx / z;
        const dy = sdy / z;
        for (const snap of selDragRef.current.snaps) {
          if (snap.type === 'postit') {
            send('move_postit', { id: snap.id, x: snap.x + dx, y: snap.y + dy });
          } else if (snap.type === 'section') {
            send('update_section', { id: snap.id, x: snap.x + dx, y: snap.y + dy });
          } else if (snap.type === 'group') {
            send('update_group', { id: snap.id, x: snap.x + dx, y: snap.y + dy });
          } else if (snap.type === 'image') {
            send('move_image', { id: snap.id, x: snap.x + dx, y: snap.y + dy });
          }
        }
        return;
      }
    },
    [applyTransform, creationMode, screenToCanvas, send],
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

    // End marquee — compute selection
    if (marqueeRef.current) {
      if (!marquee) {
        // Just a click without drag — clear selection
        setSelection([]);
      } else {
        // Convert board-relative marquee corners to canvas coords for hit-testing
        // boardRelative → canvas: (boardPos - pan) / zoom
        const t = transform.current;
        const c1 = { x: (marquee.sx - t.x) / t.z, y: (marquee.sy - t.y) / t.z };
        const c2 = { x: (marquee.ex - t.x) / t.z, y: (marquee.ey - t.y) / t.z };
        const minX = Math.min(c1.x, c2.x);
        const maxX = Math.max(c1.x, c2.x);
        const minY = Math.min(c1.y, c2.y);
        const maxY = Math.max(c1.y, c2.y);

        const selected: SelectedItem[] = [];

        // Check post-its (160x100)
        for (const p of Object.values(state.postIts)) {
          const px = p.x, py = p.y, pw = 160, ph = 100;
          if (px + pw > minX && px < maxX && py + ph > minY && py < maxY) {
            selected.push({ type: 'postit', id: p.id });
          }
        }

        // Check groups
        for (const g of Object.values(state.groups)) {
          if (g.x + g.w > minX && g.x < maxX && g.y + g.h > minY && g.y < maxY) {
            selected.push({ type: 'group', id: g.id });
          }
        }

        // Check images
        for (const img of Object.values(state.images || {})) {
          if (img.x + img.w > minX && img.x < maxX && img.y + img.h > minY && img.y < maxY) {
            selected.push({ type: 'image' as SelectedItem['type'], id: img.id });
          }
        }

        setSelection(selected);
      }
      marqueeRef.current = null;
      setMarquee(null);
    }

    // End selection drag
    selDragRef.current = null;
    // End image resize
    imgResizeRef.current = null;
  }, [grabMode, marquee, state.postIts, state.sections, state.groups, state.images]);

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
    smoothZoom(() => {
      transform.current = { x: 0, y: 0, z: 1 };
      zoomRef.current = 1;
      applyTransform();
      setZoomDisplay(100);
    });
  }, [applyTransform, smoothZoom]);

  // ── OCD Panic Button — organize everything into neat grids ──
  const organizeBoard = useCallback(() => {
    const ORIGIN = 100;
    const SECTION_GAP = 40;
    const SEC_PAD_TOP = 50; // section header height
    const SEC_PAD = 16;
    const POSTIT_W = 160;
    const POSTIT_H = 110;
    const POSTIT_GAP = 12;
    const GROUP_PAD = 10;
    const GROUP_GAP = 60; // enough to clear group outline padding (24px convex hull + margin)
    const GROUP_LABEL_H = 32;

    const allSections = Object.values(state.sections).sort((a, b) => a.order - b.order);
    const allPostIts = Object.values(state.postIts);
    const allGroups = Object.values(state.groups);

    // Collect all moves to send at the end
    type Move = { msg: string; data: Record<string, unknown> };
    const moves: Move[] = [];

    // Grid layout helper — picks the column count whose resulting
    // (width × height) is closest to square, given a non-square item size.
    // e.g. for 160×110 post-its a 3-wide grid is often flatter than a
    // 2-wide grid; this chooses whichever makes the content most square.
    function grid(count: number, itemW: number, itemH: number, gap: number) {
      if (count === 0) return { cols: 0, rows: 0, w: 0, h: 0, pos: [] as { x: number; y: number }[] };
      let bestCols = 1;
      let bestDiff = Infinity;
      for (let c = 1; c <= count; c++) {
        const r = Math.ceil(count / c);
        const w = c * itemW + Math.max(0, c - 1) * gap;
        const h = r * itemH + Math.max(0, r - 1) * gap;
        const diff = Math.abs(w - h);
        // Prefer a slightly taller layout over a wider one on ties — boards
        // usually have horizontal real-estate to spare; it's the flat-wide
        // shape that feels wrong.
        if (diff < bestDiff || (diff === bestDiff && c < bestCols)) {
          bestDiff = diff;
          bestCols = c;
        }
      }
      const cols = bestCols;
      const rows = Math.ceil(count / cols);
      const pos: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        pos.push({ x: (i % cols) * (itemW + gap), y: Math.floor(i / cols) * (itemH + gap) });
      }
      return { cols, rows, w: cols * itemW + Math.max(0, cols - 1) * gap, h: rows * itemH + Math.max(0, rows - 1) * gap, pos };
    }

    // Phase 1: compute each section's internal layout and required size
    type SecLayout = { sec: typeof allSections[0]; w: number; h: number };
    const secLayouts: SecLayout[] = [];

    for (const sec of allSections) {
      const secPostIts = allPostIts.filter((p) => p.sectionId === sec.id);
      // Groups that have at least one post-it in this section
      const secGroupIds = new Set<string>();
      for (const p of secPostIts) { if (p.groupId) secGroupIds.add(p.groupId); }
      const secGroups = allGroups.filter((g) => secGroupIds.has(g.id));
      const loosePostIts = secPostIts.filter((p) => !p.groupId || !secGroupIds.has(p.groupId!));

      // Compute group internal sizes
      const groupInfos = secGroups.map((g) => {
        const gp = secPostIts.filter((p) => p.groupId === g.id);
        const gl = grid(gp.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
        const gw = Math.max(200, gl.w + GROUP_PAD * 2);
        const gh = GROUP_LABEL_H + gl.h + GROUP_PAD * 2;
        return { group: g, postIts: gp, innerGrid: gl, w: gw, h: gh };
      });

      let contentH = 0;
      let contentW = 0;

      // Groups arranged in a grid
      if (groupInfos.length > 0) {
        const maxGW = Math.max(...groupInfos.map((g) => g.w));
        const maxGH = Math.max(...groupInfos.map((g) => g.h));
        const gGrid = grid(groupInfos.length, maxGW, maxGH, GROUP_GAP);
        contentW = Math.max(contentW, gGrid.w);
        contentH += gGrid.h;
        if (loosePostIts.length > 0) contentH += GROUP_GAP;
      }

      // Loose post-its grid
      const looseGrid = grid(loosePostIts.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
      if (loosePostIts.length > 0) {
        contentW = Math.max(contentW, looseGrid.w);
        contentH += looseGrid.h;
      }

      // Size sections purely from their content so OCD can shrink wide
      // sections back to a square-ish shape. A small floor keeps empty
      // sections usable.
      const MIN_SEC_W = 300;
      const MIN_SEC_H = 200;
      const neededW = Math.max(MIN_SEC_W, contentW + SEC_PAD * 2);
      const neededH = Math.max(MIN_SEC_H, contentH + SEC_PAD_TOP + SEC_PAD);
      secLayouts.push({ sec, w: neededW, h: neededH });
    }

    // Phase 2: arrange sections in a grid, compute final absolute positions for everything
    const maxSecW = secLayouts.length > 0 ? Math.max(...secLayouts.map((s) => s.w)) : 0;
    const maxSecH = secLayouts.length > 0 ? Math.max(...secLayouts.map((s) => s.h)) : 0;
    const secGrid = grid(allSections.length, maxSecW, maxSecH, SECTION_GAP);

    for (let si = 0; si < allSections.length; si++) {
      const sec = allSections[si];
      const sl = secLayouts[si];
      const secX = ORIGIN + secGrid.pos[si].x;
      const secY = ORIGIN + secGrid.pos[si].y;

      moves.push({ msg: 'update_section', data: { ...sec, x: secX, y: secY, w: sl.w, h: sl.h } });

      // Re-derive the same internal layout to get positions (relative to section top-left)
      const secPostIts = allPostIts.filter((p) => p.sectionId === sec.id);
      const secGroupIds = new Set<string>();
      for (const p of secPostIts) { if (p.groupId) secGroupIds.add(p.groupId); }
      const secGroups = allGroups.filter((g) => secGroupIds.has(g.id));
      const loosePostIts = secPostIts.filter((p) => !p.groupId || !secGroupIds.has(p.groupId!));

      const groupInfos = secGroups.map((g) => {
        const gp = secPostIts.filter((p) => p.groupId === g.id);
        const gl = grid(gp.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
        const gw = Math.max(200, gl.w + GROUP_PAD * 2);
        const gh = GROUP_LABEL_H + gl.h + GROUP_PAD * 2;
        return { group: g, postIts: gp, innerGrid: gl, w: gw, h: gh };
      });

      let cursorY = 0; // content cursor relative to (secX + SEC_PAD, secY + SEC_PAD_TOP)

      if (groupInfos.length > 0) {
        const maxGW = Math.max(...groupInfos.map((g) => g.w));
        const maxGH = Math.max(...groupInfos.map((g) => g.h));
        const gGrid = grid(groupInfos.length, maxGW, maxGH, GROUP_GAP);

        for (let gi = 0; gi < groupInfos.length; gi++) {
          const gInfo = groupInfos[gi];
          const gx = secX + SEC_PAD + gGrid.pos[gi].x;
          const gy = secY + SEC_PAD_TOP + gGrid.pos[gi].y;
          moves.push({ msg: 'update_group', data: { ...gInfo.group, x: gx, y: gy, w: gInfo.w, h: gInfo.h } });

          for (let pi = 0; pi < gInfo.postIts.length; pi++) {
            const p = gInfo.postIts[pi];
            moves.push({
              msg: 'move_postit',
              data: { ...p, x: gx + GROUP_PAD + gInfo.innerGrid.pos[pi].x, y: gy + GROUP_LABEL_H + GROUP_PAD + gInfo.innerGrid.pos[pi].y },
            });
          }
        }
        cursorY += gGrid.h;
        if (loosePostIts.length > 0) cursorY += GROUP_GAP;
      }

      if (loosePostIts.length > 0) {
        const lGrid = grid(loosePostIts.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
        for (let pi = 0; pi < loosePostIts.length; pi++) {
          const p = loosePostIts[pi];
          moves.push({
            msg: 'move_postit',
            data: { ...p, x: secX + SEC_PAD + lGrid.pos[pi].x, y: secY + SEC_PAD_TOP + cursorY + lGrid.pos[pi].y },
          });
        }
      }
    }

    // Orphan post-its (no section) — separate grouped from ungrouped
    const orphanPostIts = allPostIts.filter((p) => !p.sectionId);
    const sectionGroupIds = new Set<string>();
    for (const sec of allSections) {
      for (const p of allPostIts) {
        if (p.sectionId === sec.id && p.groupId) sectionGroupIds.add(p.groupId);
      }
    }
    // Orphan groups: groups with orphan post-its that aren't in any section
    const orphanGroupIds = new Set<string>();
    for (const p of orphanPostIts) {
      if (p.groupId && !sectionGroupIds.has(p.groupId)) orphanGroupIds.add(p.groupId);
    }
    const orphanGrouped = allGroups.filter((g) => orphanGroupIds.has(g.id));
    const orphanLoose = orphanPostIts.filter((p) => !p.groupId || !orphanGroupIds.has(p.groupId!));
    // Empty groups (no post-its at all, and not in a section)
    const usedGroupIds = new Set(allPostIts.filter((p) => p.groupId).map((p) => p.groupId));
    const emptyGroups = allGroups.filter((g) => !usedGroupIds.has(g.id) && !sectionGroupIds.has(g.id));

    if (orphanGrouped.length > 0 || orphanLoose.length > 0 || emptyGroups.length > 0) {
      let belowY = ORIGIN;
      if (secLayouts.length > 0) {
        for (let i = 0; i < secLayouts.length; i++) {
          belowY = Math.max(belowY, ORIGIN + secGrid.pos[i].y + secLayouts[i].h);
        }
        belowY += SECTION_GAP;
      }

      let cursorY = belowY;

      // Place orphan groups first (with their post-its)
      if (orphanGrouped.length > 0) {
        const orphanGroupInfos = orphanGrouped.map((g) => {
          const gp = orphanPostIts.filter((p) => p.groupId === g.id);
          const gl = grid(gp.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
          const gw = Math.max(200, gl.w + GROUP_PAD * 2);
          const gh = GROUP_LABEL_H + gl.h + GROUP_PAD * 2;
          return { group: g, postIts: gp, innerGrid: gl, w: gw, h: gh };
        });
        const maxGW = Math.max(...orphanGroupInfos.map((g) => g.w));
        const maxGH = Math.max(...orphanGroupInfos.map((g) => g.h));
        const gGrid = grid(orphanGroupInfos.length, maxGW, maxGH, GROUP_GAP);

        for (let gi = 0; gi < orphanGroupInfos.length; gi++) {
          const gInfo = orphanGroupInfos[gi];
          const gx = ORIGIN + gGrid.pos[gi].x;
          const gy = cursorY + gGrid.pos[gi].y;
          moves.push({ msg: 'update_group', data: { ...gInfo.group, x: gx, y: gy, w: gInfo.w, h: gInfo.h } });
          for (let pi = 0; pi < gInfo.postIts.length; pi++) {
            const p = gInfo.postIts[pi];
            moves.push({
              msg: 'move_postit',
              data: { ...p, x: gx + GROUP_PAD + gInfo.innerGrid.pos[pi].x, y: gy + GROUP_LABEL_H + GROUP_PAD + gInfo.innerGrid.pos[pi].y },
            });
          }
        }
        cursorY += gGrid.h + GROUP_GAP;
      }

      // Then place ungrouped orphan post-its below the groups
      if (orphanLoose.length > 0) {
        const oGrid = grid(orphanLoose.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
        for (let i = 0; i < orphanLoose.length; i++) {
          moves.push({ msg: 'move_postit', data: { ...orphanLoose[i], x: ORIGIN + oGrid.pos[i].x, y: cursorY + oGrid.pos[i].y } });
        }
        cursorY += oGrid.h + GROUP_GAP;
      }

      // Empty groups at the end
      if (emptyGroups.length > 0) {
        const eGrid = grid(emptyGroups.length, 200, 60, POSTIT_GAP);
        for (let i = 0; i < emptyGroups.length; i++) {
          moves.push({ msg: 'update_group', data: { ...emptyGroups[i], x: ORIGIN + eGrid.pos[i].x, y: cursorY + eGrid.pos[i].y } });
        }
      }
    }

    // Fire all moves
    for (const m of moves) {
      send(m.msg, m.data);
    }
  }, [state.sections, state.postIts, state.groups, send]);

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
          <div
            className="board-canvas"
            ref={canvasRef}
            style={{ transformOrigin: '0 0' }}
          >
            {groups.map((g) => (
              <GroupOutline
                key={g.id}
                group={g}
                postIts={postIts}
                canVote={canVote && hasRemainingVotes}
                onVote={handleGroupVote}
              />
            ))}

            {sections.map((s) => (
              <SectionComponent key={s.id} section={s} selected={selectedIds.has(`section:${s.id}`)} grabMode={grabMode} votingActive={votingActive} />
            ))}

            {groups.map((g) => (
              <GroupLabelComponent
                key={g.id}
                group={g}
                voteCount={getVoteCount(g.id)}
                canVote={canVote && hasRemainingVotes}
                canUnvote={canVote}
                onVote={handleGroupVote}
                onUnvote={handleGroupUnvote}
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
                onVote={handleVote}
                onUnvote={handleUnvote}
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
                  <img src={img.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6, pointerEvents: 'none' }} />
                  {isSel && ['nw', 'ne', 'sw', 'se'].map((corner) => (
                    <div
                      key={corner}
                      className={`image-resize-handle image-resize-${corner}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const el = boardRef.current;
                        if (el) el.setPointerCapture(e.pointerId);
                        imgResizeRef.current = {
                          id: img.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origW: img.w,
                          origH: img.h,
                          origX: img.x,
                          origY: img.y,
                          corner,
                        };
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
                  <path d="M0 0 L0 16 L4.5 11.5 L8 20 L11 19 L7.5 10.5 L14 10.5 Z" fill={COLORS[Math.abs(hashCode(c.userId)) % COLORS.length]} stroke="var(--bg)" strokeWidth="1" />
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

          {/* Marquee selection rectangle (screen space, inside .board but outside canvas) */}
          {marquee && (
            <div
              className="marquee-rect"
              style={{
                left: Math.min(marquee.sx, marquee.ex),
                top: Math.min(marquee.sy, marquee.ey),
                width: Math.abs(marquee.ex - marquee.sx),
                height: Math.abs(marquee.ey - marquee.sy),
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
              onClick={organizeBoard}
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

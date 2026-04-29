/**
 * "OCD Panic Button" — recompute clean positions for everything on the
 * board (sections, groups, post-its) and produce a flat list of update
 * messages the caller can send over the wire.
 *
 * Pure: no React, no I/O, no DOM. Caller iterates the returned list and
 * dispatches each message with their `send`.
 */
import type { BoardState, Section, Group, PostIt } from '../types';

export interface BoardMove {
  msg: 'update_section' | 'update_group' | 'move_postit';
  data: Record<string, unknown>;
}

const ORIGIN = 100;
const SECTION_GAP = 40;
const SEC_PAD_TOP = 50; // section header height
const SEC_PAD = 16;
const POSTIT_W = 160;
const POSTIT_H = 110;
const POSTIT_GAP = 12;
const GROUP_PAD = 10;
const GROUP_GAP = 60;
const GROUP_LABEL_H = 32;
const MIN_SEC_W = 300;
const MIN_SEC_H = 200;

interface GridLayout {
  cols: number;
  rows: number;
  w: number;
  h: number;
  pos: { x: number; y: number }[];
}

/**
 * Pick the column count whose resulting (width × height) is closest to
 * square, given a non-square item size. For 160×110 post-its a 3-wide
 * grid is often flatter than a 2-wide one — this picks whichever lands
 * the content closest to a square footprint.
 */
function grid(count: number, itemW: number, itemH: number, gap: number): GridLayout {
  if (count === 0) return { cols: 0, rows: 0, w: 0, h: 0, pos: [] };
  let bestCols = 1;
  let bestDiff = Infinity;
  for (let c = 1; c <= count; c++) {
    const r = Math.ceil(count / c);
    const w = c * itemW + Math.max(0, c - 1) * gap;
    const h = r * itemH + Math.max(0, r - 1) * gap;
    const diff = Math.abs(w - h);
    // Prefer slightly taller layouts on ties — boards have horizontal
    // real estate to spare; flat-wide shapes feel wrong.
    if (diff < bestDiff || (diff === bestDiff && c < bestCols)) {
      bestDiff = diff;
      bestCols = c;
    }
  }
  const cols = bestCols;
  const rows = Math.ceil(count / cols);
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    pos.push({
      x: (i % cols) * (itemW + gap),
      y: Math.floor(i / cols) * (itemH + gap),
    });
  }
  return {
    cols,
    rows,
    w: cols * itemW + Math.max(0, cols - 1) * gap,
    h: rows * itemH + Math.max(0, rows - 1) * gap,
    pos,
  };
}

interface GroupInfo {
  group: Group;
  postIts: PostIt[];
  innerGrid: GridLayout;
  w: number;
  h: number;
}

function buildGroupInfo(group: Group, postIts: PostIt[]): GroupInfo {
  const inner = grid(postIts.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
  return {
    group,
    postIts,
    innerGrid: inner,
    w: Math.max(200, inner.w + GROUP_PAD * 2),
    h: GROUP_LABEL_H + inner.h + GROUP_PAD * 2,
  };
}

interface SectionLayout { sec: Section; w: number; h: number }

function sectionLayout(
  sec: Section,
  sectionPostIts: PostIt[],
  sectionGroups: Group[],
): SectionLayout {
  const groupedIds = new Set(sectionPostIts.map((p) => p.groupId).filter(Boolean));
  const present = sectionGroups.filter((g) => groupedIds.has(g.id));
  const loose = sectionPostIts.filter((p) => !p.groupId || !groupedIds.has(p.groupId!));

  const groupInfos = present.map((g) =>
    buildGroupInfo(g, sectionPostIts.filter((p) => p.groupId === g.id)),
  );

  let contentH = 0;
  let contentW = 0;
  if (groupInfos.length > 0) {
    const maxGW = Math.max(...groupInfos.map((g) => g.w));
    const maxGH = Math.max(...groupInfos.map((g) => g.h));
    const gGrid = grid(groupInfos.length, maxGW, maxGH, GROUP_GAP);
    contentW = Math.max(contentW, gGrid.w);
    contentH += gGrid.h;
    if (loose.length > 0) contentH += GROUP_GAP;
  }
  const looseGrid = grid(loose.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
  if (loose.length > 0) {
    contentW = Math.max(contentW, looseGrid.w);
    contentH += looseGrid.h;
  }

  return {
    sec,
    w: Math.max(MIN_SEC_W, contentW + SEC_PAD * 2),
    h: Math.max(MIN_SEC_H, contentH + SEC_PAD_TOP + SEC_PAD),
  };
}

/**
 * Compute the moves required to tidy a board into a clean grid layout.
 *
 * The function does not mutate state; it returns the messages the
 * caller will dispatch via `send` (e.g. `for (const m of organizeBoard(state)) send(m.msg, m.data)`).
 */
export function organizeBoard(state: BoardState): BoardMove[] {
  const allSections = Object.values(state.sections).sort((a, b) => a.order - b.order);
  const allPostIts = Object.values(state.postIts);
  const allGroups = Object.values(state.groups);
  const moves: BoardMove[] = [];

  // Phase 1: compute each section's required size based on its content.
  const secLayouts: SectionLayout[] = [];
  for (const sec of allSections) {
    const secPostIts = allPostIts.filter((p) => p.sectionId === sec.id);
    const groupIds = new Set(secPostIts.map((p) => p.groupId).filter(Boolean));
    const secGroups = allGroups.filter((g) => groupIds.has(g.id));
    secLayouts.push(sectionLayout(sec, secPostIts, secGroups));
  }

  // Phase 2: arrange sections in a uniform grid; place every child.
  const maxSecW = secLayouts.length > 0 ? Math.max(...secLayouts.map((s) => s.w)) : 0;
  const maxSecH = secLayouts.length > 0 ? Math.max(...secLayouts.map((s) => s.h)) : 0;
  const secGrid = grid(allSections.length, maxSecW, maxSecH, SECTION_GAP);

  for (let si = 0; si < allSections.length; si++) {
    const sec = allSections[si];
    const sl = secLayouts[si];
    const secX = ORIGIN + secGrid.pos[si].x;
    const secY = ORIGIN + secGrid.pos[si].y;

    moves.push({ msg: 'update_section', data: { ...sec, x: secX, y: secY, w: sl.w, h: sl.h } });

    const secPostIts = allPostIts.filter((p) => p.sectionId === sec.id);
    const groupIds = new Set(secPostIts.map((p) => p.groupId).filter(Boolean));
    const secGroups = allGroups.filter((g) => groupIds.has(g.id));
    const loose = secPostIts.filter((p) => !p.groupId || !groupIds.has(p.groupId!));

    const groupInfos = secGroups.map((g) =>
      buildGroupInfo(g, secPostIts.filter((p) => p.groupId === g.id)),
    );

    let cursorY = 0; // relative to (secX + SEC_PAD, secY + SEC_PAD_TOP)

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
            data: {
              ...p,
              x: gx + GROUP_PAD + gInfo.innerGrid.pos[pi].x,
              y: gy + GROUP_LABEL_H + GROUP_PAD + gInfo.innerGrid.pos[pi].y,
            },
          });
        }
      }
      cursorY += gGrid.h;
      if (loose.length > 0) cursorY += GROUP_GAP;
    }

    if (loose.length > 0) {
      const lGrid = grid(loose.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
      for (let pi = 0; pi < loose.length; pi++) {
        const p = loose[pi];
        moves.push({
          msg: 'move_postit',
          data: {
            ...p,
            x: secX + SEC_PAD + lGrid.pos[pi].x,
            y: secY + SEC_PAD_TOP + cursorY + lGrid.pos[pi].y,
          },
        });
      }
    }
  }

  // Orphans (no section).
  const orphanPostIts = allPostIts.filter((p) => !p.sectionId);
  const sectionGroupIds = new Set<string>();
  for (const sec of allSections) {
    for (const p of allPostIts) {
      if (p.sectionId === sec.id && p.groupId) sectionGroupIds.add(p.groupId);
    }
  }
  const orphanGroupIds = new Set<string>();
  for (const p of orphanPostIts) {
    if (p.groupId && !sectionGroupIds.has(p.groupId)) orphanGroupIds.add(p.groupId);
  }
  const orphanGrouped = allGroups.filter((g) => orphanGroupIds.has(g.id));
  const orphanLoose = orphanPostIts.filter((p) => !p.groupId || !orphanGroupIds.has(p.groupId!));
  const usedGroupIds = new Set(allPostIts.filter((p) => p.groupId).map((p) => p.groupId));
  const emptyGroups = allGroups.filter((g) => !usedGroupIds.has(g.id) && !sectionGroupIds.has(g.id));

  if (orphanGrouped.length === 0 && orphanLoose.length === 0 && emptyGroups.length === 0) {
    return moves;
  }

  let belowY = ORIGIN;
  if (secLayouts.length > 0) {
    for (let i = 0; i < secLayouts.length; i++) {
      belowY = Math.max(belowY, ORIGIN + secGrid.pos[i].y + secLayouts[i].h);
    }
    belowY += SECTION_GAP;
  }
  let cursorY = belowY;

  if (orphanGrouped.length > 0) {
    const infos = orphanGrouped.map((g) =>
      buildGroupInfo(g, orphanPostIts.filter((p) => p.groupId === g.id)),
    );
    const maxGW = Math.max(...infos.map((g) => g.w));
    const maxGH = Math.max(...infos.map((g) => g.h));
    const gGrid = grid(infos.length, maxGW, maxGH, GROUP_GAP);
    for (let gi = 0; gi < infos.length; gi++) {
      const gInfo = infos[gi];
      const gx = ORIGIN + gGrid.pos[gi].x;
      const gy = cursorY + gGrid.pos[gi].y;
      moves.push({ msg: 'update_group', data: { ...gInfo.group, x: gx, y: gy, w: gInfo.w, h: gInfo.h } });
      for (let pi = 0; pi < gInfo.postIts.length; pi++) {
        const p = gInfo.postIts[pi];
        moves.push({
          msg: 'move_postit',
          data: {
            ...p,
            x: gx + GROUP_PAD + gInfo.innerGrid.pos[pi].x,
            y: gy + GROUP_LABEL_H + GROUP_PAD + gInfo.innerGrid.pos[pi].y,
          },
        });
      }
    }
    cursorY += gGrid.h + GROUP_GAP;
  }

  if (orphanLoose.length > 0) {
    const oGrid = grid(orphanLoose.length, POSTIT_W, POSTIT_H, POSTIT_GAP);
    for (let i = 0; i < orphanLoose.length; i++) {
      moves.push({
        msg: 'move_postit',
        data: { ...orphanLoose[i], x: ORIGIN + oGrid.pos[i].x, y: cursorY + oGrid.pos[i].y },
      });
    }
    cursorY += oGrid.h + GROUP_GAP;
  }

  if (emptyGroups.length > 0) {
    const eGrid = grid(emptyGroups.length, 200, 60, POSTIT_GAP);
    for (let i = 0; i < emptyGroups.length; i++) {
      moves.push({
        msg: 'update_group',
        data: { ...emptyGroups[i], x: ORIGIN + eGrid.pos[i].x, y: cursorY + eGrid.pos[i].y },
      });
    }
  }

  return moves;
}

/**
 * Convert a board state into a Markdown document — the same format the
 * "📝 MD" button copies to clipboard.
 *
 * Pure: no React, no I/O, no DOM. Pass in everything it needs.
 */
import type { BoardState } from '../types';

/**
 * Minimal shape the previous-actions section needs. Defined locally so
 * this module doesn't reach into a component file. Anything shaped like
 * this — including the full `PreviousAction` from the actions service —
 * will satisfy it.
 */
export interface MarkdownPreviousAction {
  text: string;
  sourceSessionName: string;
}

export function buildMarkdown(
  state: BoardState,
  selectedIds?: Set<string>,
  previousActions?: MarkdownPreviousAction[],
): string {
  const lines: string[] = [];
  const allPostIts = Object.values(state.postIts);
  const allActions = Object.values(state.actions || {});
  const sortedSections = Object.values(state.sections).sort((a, b) => a.order - b.order);

  // Header
  if (state.sessionName) lines.push(`# ${state.sessionName}`);
  if (state.beatGoal) lines.push(`### ${state.beatGoal}`);

  // Sections
  for (const section of sortedSections) {
    const sectionPostIts = allPostIts.filter((p) => p.sectionId === section.id && p.text);
    const relevant = selectedIds
      ? sectionPostIts.filter((p) => selectedIds.has(p.id))
      : sectionPostIts;
    if (relevant.length === 0) continue;

    lines.push('', `## ${section.title}`);

    // Partition into grouped and ungrouped
    const byGroup = new Map<string, typeof relevant>();
    const ungrouped: typeof relevant = [];
    for (const p of relevant) {
      if (p.groupId && state.groups[p.groupId]) {
        if (!byGroup.has(p.groupId)) byGroup.set(p.groupId, []);
        byGroup.get(p.groupId)!.push(p);
      } else {
        ungrouped.push(p);
      }
    }

    // Groups
    for (const [groupId, items] of byGroup) {
      const group = state.groups[groupId];
      if (group?.label) lines.push(`### ${group.label}`);
      for (const p of items) lines.push(`- ${p.text}`);
    }

    // Ungrouped under "Standalone"
    if (ungrouped.length > 0) {
      lines.push('### Standalone');
      for (const p of ungrouped) lines.push(`- ${p.text}`);
    }
  }

  // Actions
  const openActions = allActions.filter((a) => !a.done);
  const hasPrevActions = previousActions && previousActions.length > 0;
  if (openActions.length > 0 || hasPrevActions) {
    lines.push('', '## Actions');
    if (openActions.length > 0) {
      lines.push("### This session's actions");
      for (const a of openActions) lines.push(`- [ ] ${a.text}`);
    }
    if (hasPrevActions) {
      lines.push("### Previous sessions' actions");
      for (const a of previousActions!) {
        lines.push(`- [ ] ${a.text} _(${a.sourceSessionName})_`);
      }
    }
  }

  // Voting results (last vote session). Schema: vote.votes is keyed by
  // target id (post-it OR group), valued by voter user-ids.
  const lastVote = state.voteHistory?.[state.voteHistory.length - 1];
  if (lastVote?.closed) {
    const ranked = Object.entries(lastVote.votes)
      .map(([targetId, voters]) => {
        const label = state.postIts[targetId]?.text
          ?? state.groups[targetId]?.label
          ?? targetId;
        return { text: label, count: voters.length };
      })
      .filter((r) => r.text && r.count > 0)
      .sort((a, b) => b.count - a.count);

    if (ranked.length > 0) {
      lines.push('', '## Voting Results');
      lines.push('| Item | Votes |', '|------|-------|');
      for (const r of ranked) lines.push(`| ${r.text.replace(/\|/g, '\\|')} | ${r.count} |`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

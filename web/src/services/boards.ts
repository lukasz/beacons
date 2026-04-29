/**
 * `boards` service — every read/write to the `boards` table and the
 * `/api/rooms/*` endpoints. Components import from here; nothing in
 * `src/components/` should reach for `supabase` directly.
 */
import { supabase } from '../supabaseClient';
import { http } from './http';

// ─────────────────────────────────────────────────────────────
// Public types — what callers receive.
// ─────────────────────────────────────────────────────────────

export interface BoardListItem {
  id: string;
  sessionName: string;
  teamName: string;
  teamId: string | null;
  stickyCount: number;
  sectionCount: number;
  actionCount: number;
  participants: { id: string; name: string }[];
  updatedAt: string;
  archived: boolean;
  linearSourceId?: string;
  linearSourceType?: 'cycle' | 'project';
}

export interface TemplateBoardItem extends BoardListItem {
  sections: { title: string; colorIdx: number }[];
}

export interface GlobalActionItem {
  id: string;
  text: string;
  done: boolean;
  authorName: string;
  linearUrl?: string;
  linearKey?: string;
  createdAt: number;
  boardId: string;
  sessionName: string;
  teamName: string;
  teamId: string | null;
}

export interface CreateFromTemplatePayload {
  sessionName?: string;
  teamName?: string;
  teamId?: string;
  beatGoal?: string;
  isTemplate?: boolean;
  sections?: { title: string; colorIdx: number }[];
  cycleStats?: unknown;
  userId: string;
  userName: string;
}

export interface CloneTemplatePayload {
  sessionName?: string;
  teamName?: string;
  beatGoal?: string;
  teamId?: string;
  userId: string;
  userName: string;
  cycleStats?: unknown;
}

// ─────────────────────────────────────────────────────────────
// Internal row shapes — what Supabase returns.
// ─────────────────────────────────────────────────────────────

interface BoardSummaryRow {
  id: string;
  updated_at: string;
  archived?: boolean;
  team_id?: string | null;
  is_template?: boolean | null;
  users?: Record<string, { id: string; name: string }>;
  postIts?: Record<string, unknown>;
  sections?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  sessionName?: string;
  teamName?: string;
  cycleStats?: { linearSourceId?: string; source?: 'cycle' | 'project' };
}

interface BoardActionsRow {
  id: string;
  team_id?: string | null;
  users?: Record<string, { id: string }>;
  actions?: Record<string, {
    id: string;
    text: string;
    done: boolean;
    authorName: string;
    linearUrl?: string;
    linearKey?: string;
    createdAt: number;
  }>;
  sessionName?: string;
  teamName?: string;
}

interface TemplateBoardRow {
  id: string;
  state: {
    sections?: Record<string, { title: string; colorIdx: number; order?: number }>;
    sessionName?: string;
    teamName?: string;
    users?: Record<string, { id: string; name: string }>;
    cycleStats?: { linearSourceId?: string; source?: 'cycle' | 'project' };
  };
  updated_at: string;
  archived?: boolean;
  team_id?: string | null;
}

function mapSummary(row: BoardSummaryRow): BoardListItem {
  const users = row.users || {};
  return {
    id: row.id,
    sessionName: row.sessionName ?? '',
    teamName: row.teamName ?? '',
    teamId: row.team_id ?? null,
    stickyCount: Object.keys(row.postIts ?? {}).length,
    sectionCount: Object.keys(row.sections ?? {}).length,
    actionCount: Object.keys(row.actions ?? {}).length,
    participants: Object.values(users).map((u) => ({ id: u.id, name: u.name })),
    updatedAt: row.updated_at,
    archived: row.archived ?? false,
    linearSourceId: row.cycleStats?.linearSourceId,
    linearSourceType: row.cycleStats?.source,
  };
}

// ─────────────────────────────────────────────────────────────
// Service surface
// ─────────────────────────────────────────────────────────────

export const boards = {
  /** Non-template boards, newest first. Visible to all authenticated users. */
  async list(): Promise<BoardListItem[]> {
    const { data, error } = await supabase
      .from('boards')
      .select('id, updated_at, archived, team_id, is_template, state->users, state->postIts, state->sections, state->actions, state->sessionName, state->teamName, state->cycleStats')
      .or('is_template.is.null,is_template.eq.false')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapSummary(row as BoardSummaryRow));
  },

  /**
   * All boards' actions, flattened. The viewer must currently appear in
   * a board's `users` map for the board's actions to be included.
   */
  async listGlobalActions(viewerId: string): Promise<GlobalActionItem[]> {
    const { data, error } = await supabase
      .from('boards')
      .select('id, team_id, state->actions, state->sessionName, state->teamName, state->users')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const out: GlobalActionItem[] = [];
    for (const row of (data ?? []) as BoardActionsRow[]) {
      const users = row.users ?? {};
      if (!Object.keys(users).includes(viewerId)) continue;
      for (const a of Object.values(row.actions ?? {})) {
        out.push({
          ...a,
          boardId: row.id,
          sessionName: row.sessionName ?? '',
          teamName: row.teamName ?? '',
          teamId: row.team_id ?? null,
        });
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },

  /** Template boards (is_template = true). */
  async listTemplates(): Promise<TemplateBoardItem[]> {
    const { data, error } = await supabase
      .from('boards')
      .select('id, state, updated_at, archived, is_template, team_id')
      .eq('is_template', true)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const r = row as TemplateBoardRow;
      const sections = r.state?.sections ?? {};
      const users = r.state?.users ?? {};
      const orderedSections = Object.values(sections)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({ title: s.title, colorIdx: s.colorIdx }));
      return {
        id: r.id,
        sessionName: r.state?.sessionName ?? '',
        teamName: r.state?.teamName ?? '',
        teamId: r.team_id ?? null,
        stickyCount: 0,
        sectionCount: orderedSections.length,
        actionCount: 0,
        participants: Object.values(users).map((u) => ({ id: u.id, name: u.name })),
        updatedAt: r.updated_at,
        archived: r.archived ?? false,
        linearSourceId: r.state?.cycleStats?.linearSourceId,
        linearSourceType: r.state?.cycleStats?.source,
        sections: orderedSections,
      };
    });
  },

  /** Read just the `state` column for one board (used for cross-board state mutations). */
  async getState(boardId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase
      .from('boards')
      .select('state')
      .eq('id', boardId)
      .single();
    if (error) {
      // Treat "not found" as null rather than throwing.
      if ((error as { code?: string }).code === 'PGRST116') return null;
      throw error;
    }
    return ((data as { state?: Record<string, unknown> })?.state) ?? null;
  },

  /** Replace a board's `state` column. Caller is responsible for the merge. */
  async updateState(boardId: string, state: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from('boards').update({ state }).eq('id', boardId);
    if (error) throw error;
  },

  /**
   * Attach a board to a team (or detach with `null`). Also patches
   * `state.teamId` and `state.teamName` so the WS server picks the change up.
   */
  async attachToTeam(boardId: string, team: { id: string; name: string } | null): Promise<void> {
    const { error } = await supabase
      .from('boards')
      .update({ team_id: team?.id ?? null })
      .eq('id', boardId);
    if (error) throw error;
    const state = await boards.getState(boardId);
    if (state) {
      state.teamId = team?.id ?? '';
      if (team) state.teamName = team.name;
      await boards.updateState(boardId, state);
    }
  },

  async setArchived(boardId: string, archived: boolean): Promise<void> {
    const { error } = await supabase.from('boards').update({ archived }).eq('id', boardId);
    if (error) throw error;
  },

  async remove(boardId: string): Promise<void> {
    const { error } = await supabase.from('boards').delete().eq('id', boardId);
    if (error) throw error;
  },

  // ── Server-side creation (via the Go API) ──

  /** Create an empty board. */
  createBlank(): Promise<{ id: string }> {
    return http.post<{ id: string }>('/api/rooms');
  },

  /** Create a board with pre-defined sections and metadata. */
  createFromTemplate(payload: CreateFromTemplatePayload): Promise<{ id: string }> {
    return http.post<{ id: string }>('/api/rooms/template', payload);
  },

  /** Clone an existing template board, optionally overlaying metadata. */
  cloneTemplate(templateId: string, payload?: CloneTemplatePayload): Promise<{ id: string }> {
    return http.post<{ id: string }>(`/api/rooms/clone/${templateId}`, payload);
  },

  /** Whether a board is org-only or public — used for guest-join detection. */
  getAccessMode(roomId: string): Promise<{ accessMode: 'org' | 'public' }> {
    return http.get<{ accessMode: 'org' | 'public' }>(`/api/rooms/access/${roomId}`);
  },
};

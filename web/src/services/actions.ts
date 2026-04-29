/**
 * `actions` service — cross-board action operations. The board's own
 * actions live in the WebSocket-synced state; this service handles the
 * stuff that needs Supabase: the carry-over feed and patches to the
 * source board's persisted state.
 */
import { supabase } from '../supabaseClient';

export interface PreviousAction {
  id: string;
  text: string;
  authorName: string;
  createdAt: number;
  linearUrl?: string;
  linearKey?: string;
  sourceBoardId: string;
  sourceSessionName: string;
}

interface PrevActionRow {
  id: string;
  actions?: Record<string, {
    id: string;
    text: string;
    done: boolean;
    authorName: string;
    createdAt: number;
    linearUrl?: string;
    linearKey?: string;
  }>;
  sessionName?: string;
}

export const actions = {
  /**
   * Recent unfinished actions from this team's other boards. Capped at
   * the most recent 10 boards, sorted newest action first.
   */
  async previousForTeam(teamId: string, excludeBoardId: string): Promise<PreviousAction[]> {
    const { data, error } = await supabase
      .from('boards')
      .select('id, state->actions, state->sessionName')
      .eq('team_id', teamId)
      .neq('id', excludeBoardId)
      .is('is_template', false)
      .order('updated_at', { ascending: false })
      .limit(10);
    if (error || !data) return [];
    const out: PreviousAction[] = [];
    for (const row of data as PrevActionRow[]) {
      for (const a of Object.values(row.actions ?? {})) {
        if (a.done) continue;
        out.push({
          id: a.id,
          text: a.text,
          authorName: a.authorName,
          createdAt: a.createdAt,
          linearUrl: a.linearUrl,
          linearKey: a.linearKey,
          sourceBoardId: row.id,
          sourceSessionName: row.sessionName ?? 'Untitled',
        });
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },

  /**
   * Mark a single action on a *different* board as done. Used when a
   * carried-over action is closed from the new retro.
   */
  async markDoneOnSourceBoard(sourceBoardId: string, actionId: string): Promise<void> {
    const { data } = await supabase
      .from('boards')
      .select('state')
      .eq('id', sourceBoardId)
      .single();
    const state = (data as { state?: Record<string, unknown> })?.state;
    if (!state) return;
    const stateActions = (state.actions ?? {}) as Record<string, { id: string; done: boolean }>;
    const target = stateActions[actionId];
    if (!target) return;
    const updatedState = {
      ...state,
      actions: { ...stateActions, [actionId]: { ...target, done: true } },
    };
    const { error } = await supabase
      .from('boards')
      .update({ state: updatedState })
      .eq('id', sourceBoardId);
    if (error) throw error;
  },

  /**
   * Attach a Linear issue link to an action on a *different* board.
   * Used when we create a Linear ticket from the actions tab while
   * looking at a global view of all teams' actions.
   */
  async updateLinearLinkOnSourceBoard(
    sourceBoardId: string,
    actionId: string,
    link: { url: string; key: string },
  ): Promise<void> {
    const { data } = await supabase
      .from('boards')
      .select('state')
      .eq('id', sourceBoardId)
      .single();
    const state = (data as { state?: Record<string, unknown> })?.state;
    if (!state) return;
    const stateActions = (state.actions ?? {}) as Record<string, Record<string, unknown>>;
    const target = stateActions[actionId];
    if (!target) return;
    const updatedState = {
      ...state,
      actions: {
        ...stateActions,
        [actionId]: { ...target, linearUrl: link.url, linearKey: link.key },
      },
    };
    const { error } = await supabase
      .from('boards')
      .update({ state: updatedState })
      .eq('id', sourceBoardId);
    if (error) throw error;
  },
};

/**
 * `teams` service — `teams` and `team_members` tables.
 */
import { supabase } from '../supabaseClient';
import type { Team } from '../types';

interface TeamRow {
  id: string;
  name: string;
  linear_team_id?: string | null;
  linear_team_key?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    linearTeamId: row.linear_team_id ?? undefined,
    linearTeamKey: row.linear_team_key ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTeamInput {
  name: string;
  linearTeamId?: string;
  linearTeamKey?: string;
  ownerUserId: string;
}

export interface UpdateTeamInput {
  id: string;
  name: string;
  linearTeamId?: string;
  linearTeamKey?: string;
}

export const teams = {
  /** All teams in the org, sorted by name. */
  async list(): Promise<Team[]> {
    const { data, error } = await supabase.from('teams').select('*').order('name');
    if (error) throw error;
    return ((data ?? []) as TeamRow[]).map(mapTeam);
  },

  /**
   * Ensure the user is a member of every team. Idempotent — only inserts
   * memberships for teams the user isn't already in. Returns the count of
   * memberships created.
   */
  async ensureMembershipsForAll(userId: string, allTeamIds: string[]): Promise<number> {
    if (allTeamIds.length === 0) return 0;
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);
    const memberOf = new Set(((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id));
    const missing = allTeamIds.filter((id) => !memberOf.has(id));
    if (missing.length === 0) return 0;
    const { error } = await supabase
      .from('team_members')
      .insert(missing.map((team_id) => ({ team_id, user_id: userId, role: 'member' })));
    if (error) throw error;
    return missing.length;
  },

  /**
   * Create a team and make the creator its owner. Returns the new team id.
   */
  async create({ name, linearTeamId, linearTeamKey, ownerUserId }: CreateTeamInput): Promise<string> {
    const id = crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const { error: teamErr } = await supabase.from('teams').insert({
      id,
      name,
      linear_team_id: linearTeamId || null,
      linear_team_key: linearTeamKey || null,
      created_by: ownerUserId,
      created_at: now,
      updated_at: now,
    });
    if (teamErr) throw teamErr;
    const { error: memberErr } = await supabase
      .from('team_members')
      .insert({ team_id: id, user_id: ownerUserId, role: 'owner' });
    if (memberErr) throw memberErr;
    return id;
  },

  async update({ id, name, linearTeamId, linearTeamKey }: UpdateTeamInput): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .update({
        name,
        linear_team_id: linearTeamId || null,
        linear_team_key: linearTeamKey || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(teamId: string): Promise<void> {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw error;
  },
};

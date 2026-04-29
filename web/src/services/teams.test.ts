import { describe, it, expect, vi, beforeEach } from 'vitest';

const { chain } = vi.hoisted(() => {
  const state: { data: unknown; error: unknown } = { data: null, error: null };
  const c: Record<string, ReturnType<typeof vi.fn>> & {
    setResult(next: { data: unknown; error: unknown }): void;
    resetCalls(): void;
    [key: string]: unknown;
  } = {} as never;
  const methods = ['from','select','insert','update','delete','eq','neq','is','or','order','limit'] as const;
  for (const k of methods) c[k] = vi.fn(() => c);
  c.single = vi.fn(() => Promise.resolve({ ...state }));
  (c as unknown as PromiseLike<unknown>).then = ((onF, onR) =>
    Promise.resolve({ ...state }).then(onF, onR)) as PromiseLike<unknown>['then'];
  c.setResult = (next) => { state.data = next.data; state.error = next.error; };
  c.resetCalls = () => {
    for (const k of methods) c[k].mockClear();
    c.single.mockClear();
  };
  return { chain: c };
});

vi.mock('../supabaseClient', () => ({ supabase: chain }));

import { teams } from './teams';

beforeEach(() => {
  chain.setResult({ data: null, error: null });
  chain.resetCalls();
});

describe('teams.list', () => {
  it('queries the teams table sorted by name and maps to camelCase', async () => {
    chain.setResult({
      data: [{
        id: 't1', name: 'Platform',
        linear_team_id: 'LIN-1', linear_team_key: 'PLAT',
        created_by: 'u1', created_at: '2026-01', updated_at: '2026-02',
      }],
      error: null,
    });
    const result = await teams.list();
    expect(chain.from).toHaveBeenCalledWith('teams');
    expect(chain.order).toHaveBeenCalledWith('name');
    expect(result[0]).toEqual({
      id: 't1',
      name: 'Platform',
      linearTeamId: 'LIN-1',
      linearTeamKey: 'PLAT',
      createdBy: 'u1',
      createdAt: '2026-01',
      updatedAt: '2026-02',
    });
  });
});

describe('teams.ensureMembershipsForAll', () => {
  it('only inserts memberships the user is missing', async () => {
    // First call: list memberships → user is in t1
    chain.setResult({ data: [{ team_id: 't1' }], error: null });
    const created = await teams.ensureMembershipsForAll('u1', ['t1', 't2', 't3']);
    expect(created).toBe(2);
    expect(chain.insert).toHaveBeenCalledWith([
      { team_id: 't2', user_id: 'u1', role: 'member' },
      { team_id: 't3', user_id: 'u1', role: 'member' },
    ]);
  });

  it('returns 0 when the user is already a member of every team', async () => {
    chain.setResult({ data: [{ team_id: 't1' }, { team_id: 't2' }], error: null });
    const created = await teams.ensureMembershipsForAll('u1', ['t1', 't2']);
    expect(created).toBe(0);
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('skips when allTeamIds is empty', async () => {
    expect(await teams.ensureMembershipsForAll('u1', [])).toBe(0);
    expect(chain.from).not.toHaveBeenCalled();
  });
});

describe('teams.create', () => {
  it('inserts team and owner membership', async () => {
    const id = await teams.create({ name: 'Platform', ownerUserId: 'u1' });
    expect(typeof id).toBe('string');
    expect(id.length).toBe(8);
    expect(chain.from).toHaveBeenCalledWith('teams');
    expect(chain.from).toHaveBeenCalledWith('team_members');
    // First insert: the team row
    const teamInsert = chain.insert.mock.calls[0][0];
    expect(teamInsert).toMatchObject({ id, name: 'Platform', created_by: 'u1' });
    // Second insert: owner membership
    const memberInsert = chain.insert.mock.calls[1][0];
    expect(memberInsert).toEqual({ team_id: id, user_id: 'u1', role: 'owner' });
  });
});

describe('teams.update / remove', () => {
  it('update patches the named columns', async () => {
    await teams.update({ id: 't1', name: 'Renamed', linearTeamId: 'LIN-2' });
    const patch = chain.update.mock.calls[0][0];
    expect(patch).toMatchObject({
      name: 'Renamed',
      linear_team_id: 'LIN-2',
      linear_team_key: null,
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 't1');
  });

  it('remove deletes the team by id', async () => {
    await teams.remove('t1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 't1');
  });
});

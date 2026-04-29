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

import { actions } from './actions';

beforeEach(() => {
  chain.setResult({ data: null, error: null });
  chain.resetCalls();
});

describe('actions.previousForTeam', () => {
  it('queries for the team, excludes the current board, skips templates, limits to 10', async () => {
    chain.setResult({ data: [], error: null });
    await actions.previousForTeam('t1', 'b-current');
    expect(chain.from).toHaveBeenCalledWith('boards');
    expect(chain.eq).toHaveBeenCalledWith('team_id', 't1');
    expect(chain.neq).toHaveBeenCalledWith('id', 'b-current');
    expect(chain.is).toHaveBeenCalledWith('is_template', false);
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('skips done actions and returns the unfinished ones sorted newest first', async () => {
    chain.setResult({
      data: [
        { id: 'b1', sessionName: 'Cycle 23', actions: {
          a1: { id: 'a1', text: 'old', done: false, authorName: 'Ana', createdAt: 100 },
          a2: { id: 'a2', text: 'done', done: true,  authorName: 'Ana', createdAt: 110 },
        } },
        { id: 'b2', sessionName: 'Cycle 22', actions: {
          a3: { id: 'a3', text: 'newer', done: false, authorName: 'Ben', createdAt: 200 },
        } },
      ],
      error: null,
    });
    const result = await actions.previousForTeam('t1', 'bx');
    expect(result.map((a) => a.id)).toEqual(['a3', 'a1']);
    expect(result[0]).toMatchObject({ sourceBoardId: 'b2', sourceSessionName: 'Cycle 22' });
  });

  it('returns [] on error or empty data without throwing', async () => {
    chain.setResult({ data: null, error: { message: 'oops' } });
    expect(await actions.previousForTeam('t1', 'bx')).toEqual([]);
  });
});

describe('actions.markDoneOnSourceBoard', () => {
  it('reads source state, flips action.done, and writes it back', async () => {
    chain.setResult({
      data: { state: { actions: { a1: { id: 'a1', done: false, text: 'x' } } } },
      error: null,
    });
    await actions.markDoneOnSourceBoard('b1', 'a1');
    const updated = chain.update.mock.calls[0][0] as { state: { actions: Record<string, { done: boolean }> } };
    expect(updated.state.actions.a1.done).toBe(true);
  });

  it('no-ops when the action does not exist on the source', async () => {
    chain.setResult({
      data: { state: { actions: { other: { id: 'other', done: false } } } },
      error: null,
    });
    await actions.markDoneOnSourceBoard('b1', 'missing');
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('no-ops when the source has no state', async () => {
    chain.setResult({ data: { state: null }, error: null });
    await actions.markDoneOnSourceBoard('b1', 'a1');
    expect(chain.update).not.toHaveBeenCalled();
  });
});

describe('actions.updateLinearLinkOnSourceBoard', () => {
  it('attaches linearUrl + linearKey to the matching action', async () => {
    chain.setResult({
      data: { state: { actions: { a1: { id: 'a1', text: 'x', done: false } } } },
      error: null,
    });
    await actions.updateLinearLinkOnSourceBoard('b1', 'a1', { url: 'https://lin/1', key: 'ENG-1' });
    const updated = chain.update.mock.calls[0][0] as { state: { actions: Record<string, { linearUrl: string; linearKey: string }> } };
    expect(updated.state.actions.a1).toMatchObject({
      linearUrl: 'https://lin/1',
      linearKey: 'ENG-1',
    });
  });
});

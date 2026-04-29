import { describe, it, expect, vi, beforeEach } from 'vitest';

// Inline supabase chain so it lives in the same hoisted scope as vi.mock.
// Must be `vi.hoisted` (synchronous) since vi.mock factories run before
// imports resolve.
const { chain, fetchSpy } = vi.hoisted(() => {
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
  return { chain: c, fetchSpy: vi.fn() };
});

vi.mock('../supabaseClient', () => ({ supabase: chain }));
vi.stubGlobal('fetch', fetchSpy);

// Imported AFTER vi.mock so the service sees the stub.
import { boards } from './boards';

beforeEach(() => {
  fetchSpy.mockReset();
  chain.setResult({ data: null, error: null });
  chain.resetCalls();
});

describe('boards.list', () => {
  it('queries non-template boards, newest first, mapped to BoardListItem', async () => {
    chain.setResult({
      data: [{
        id: 'b1', updated_at: '2026-04-01', archived: false, team_id: 't1', is_template: false,
        users: { u1: { id: 'u1', name: 'Ana' } },
        postIts: { p1: {}, p2: {} },
        sections: { s1: {} },
        actions: { a1: {} },
        sessionName: 'Cycle 24', teamName: 'Platform',
        cycleStats: { linearSourceId: 'cyc-1', source: 'cycle' },
      }],
      error: null,
    });
    const result = await boards.list();
    expect(chain.from).toHaveBeenCalledWith('boards');
    expect(chain.or).toHaveBeenCalledWith('is_template.is.null,is_template.eq.false');
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'b1',
      sessionName: 'Cycle 24',
      teamName: 'Platform',
      teamId: 't1',
      stickyCount: 2,
      sectionCount: 1,
      actionCount: 1,
      participants: [{ id: 'u1', name: 'Ana' }],
      linearSourceId: 'cyc-1',
      linearSourceType: 'cycle',
    });
  });

  it('throws when supabase returns an error', async () => {
    chain.setResult({ data: null, error: { message: 'boom' } });
    await expect(boards.list()).rejects.toEqual({ message: 'boom' });
  });
});

describe('boards.listGlobalActions', () => {
  it('only includes boards where the viewer is in users', async () => {
    chain.setResult({
      data: [
        { id: 'b1', team_id: 't1', users: { u1: { id: 'u1' } }, actions: { a1: { id: 'a1', text: 'do thing', done: false, authorName: 'Ana', createdAt: 100 } }, sessionName: 'one', teamName: 'P' },
        { id: 'b2', team_id: null, users: { other: { id: 'other' } }, actions: { a2: { id: 'a2', text: 'skip me', done: false, authorName: 'Other', createdAt: 200 } }, sessionName: 'two', teamName: '' },
      ],
      error: null,
    });
    const result = await boards.listGlobalActions('u1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
    expect(result[0].boardId).toBe('b1');
  });

  it('sorts actions newest first across boards', async () => {
    chain.setResult({
      data: [
        { id: 'b1', team_id: 't1', users: { u1: { id: 'u1' } }, actions: { a1: { id: 'a1', text: 'old', done: false, authorName: 'Ana', createdAt: 100 } }, sessionName: '', teamName: '' },
        { id: 'b2', team_id: 't1', users: { u1: { id: 'u1' } }, actions: { a2: { id: 'a2', text: 'newer', done: false, authorName: 'Ana', createdAt: 200 } }, sessionName: '', teamName: '' },
      ],
      error: null,
    });
    const result = await boards.listGlobalActions('u1');
    expect(result.map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});

describe('boards.getState', () => {
  it('returns the parsed state row', async () => {
    chain.setResult({ data: { state: { sections: {}, sessionName: 'x' } }, error: null });
    const state = await boards.getState('b1');
    expect(chain.from).toHaveBeenCalledWith('boards');
    expect(chain.eq).toHaveBeenCalledWith('id', 'b1');
    expect(state).toEqual({ sections: {}, sessionName: 'x' });
  });

  it('returns null when row not found (PGRST116)', async () => {
    chain.setResult({ data: null, error: { code: 'PGRST116' } });
    expect(await boards.getState('missing')).toBeNull();
  });
});

describe('boards.setArchived / remove / updateState', () => {
  it('setArchived updates archived flag on the row', async () => {
    await boards.setArchived('b1', true);
    expect(chain.from).toHaveBeenCalledWith('boards');
    expect(chain.update).toHaveBeenCalledWith({ archived: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('remove deletes the row by id', async () => {
    await boards.remove('b1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('updateState replaces the state column', async () => {
    await boards.updateState('b1', { foo: 'bar' });
    expect(chain.update).toHaveBeenCalledWith({ state: { foo: 'bar' } });
  });
});

describe('boards.* — server endpoints', () => {
  function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), { status: 200, ...init });
  }

  it('createBlank POSTs /api/rooms', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'new' }));
    const out = await boards.createBlank();
    expect(fetchSpy).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST' }));
    expect(out).toEqual({ id: 'new' });
  });

  it('createFromTemplate POSTs to /api/rooms/template with payload', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'new' }));
    await boards.createFromTemplate({ userId: 'u1', userName: 'Ana', sections: [{ title: 'A', colorIdx: 0 }] });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ userId: 'u1', sections: [{ title: 'A', colorIdx: 0 }] });
  });

  it('cloneTemplate POSTs to /api/rooms/clone/:id with body', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'new' }));
    await boards.cloneTemplate('tpl-1', { userId: 'u1', userName: 'Ana' });
    expect(fetchSpy).toHaveBeenCalledWith('/api/rooms/clone/tpl-1', expect.objectContaining({ method: 'POST' }));
  });

  it('getAccessMode GETs /api/rooms/access/:id', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ accessMode: 'public' }));
    const out = await boards.getAccessMode('abcd1234');
    expect(fetchSpy).toHaveBeenCalledWith('/api/rooms/access/abcd1234', expect.objectContaining({ method: 'GET' }));
    expect(out).toEqual({ accessMode: 'public' });
  });
});


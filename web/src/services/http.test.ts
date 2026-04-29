import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpError } from './http';

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('http.get', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'b1' }));
    expect(await http.get<{ id: string }>('/api/rooms/access/b1')).toEqual({ id: 'b1' });
    expect(fetchSpy).toHaveBeenCalledWith('/api/rooms/access/b1', expect.objectContaining({ method: 'GET' }));
  });

  it('throws HttpError with status on non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(http.get('/api/x')).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      path: '/api/x',
    });
  });

  it('returns null for empty bodies', async () => {
    // jsdom won't accept a body on a 204; build the response without one.
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await http.get('/api/empty')).toBeNull();
  });
});

describe('http.post', () => {
  it('serialises the body as JSON and sets content-type', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'new' }));
    const out = await http.post<{ id: string }>('/api/rooms', { hello: 'world' });
    expect(out).toEqual({ id: 'new' });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('omits the body and content-type when none is supplied', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'new' }));
    await http.post('/api/rooms');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});

describe('HttpError', () => {
  it('exposes status, path, and a default message', () => {
    const e = new HttpError(404, '/x');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('HTTP 404 /x');
  });
});

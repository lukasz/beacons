/**
 * Tiny fetch wrapper used by service modules. Normalises error handling
 * so callers can `try { ... } catch (e) { if (e instanceof HttpError) ... }`
 * instead of inspecting raw Response objects.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} ${path}`);
    this.name = 'HttpError';
  }
}

interface JsonRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(path: string, init?: JsonRequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    body = JSON.stringify(init.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...init, headers, body });
  if (!res.ok) {
    let message = `HTTP ${res.status} ${path}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch { /* ignore */ }
    throw new HttpError(res.status, path, message);
  }
  // Tolerate empty bodies (e.g. 204 No Content).
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const http = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },
};

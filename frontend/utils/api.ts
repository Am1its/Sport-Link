import { API_BASE } from '../constants/api';

export class UnauthorizedError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'UnauthorizedError';
  }
}

let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

type Options = RequestInit & { token?: string | null };

export async function apiFetch(path: string, { token, ...options }: Options = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    _onUnauthorized?.();
    throw new UnauthorizedError();
  }

  return res;
}

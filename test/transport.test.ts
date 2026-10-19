import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import HttpTransport from '../src/http/transport';
import TaktError from '../src/errors';

interface Call {
  url: string;
  init: RequestInit;
}

function sequencedFetch(responses: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  let i = 0;
  const fn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const make = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return make();
  };
  return { fn, calls, count: () => i };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function transport(fetchFn: typeof fetch, over: Partial<{ timeoutMs: number; retries: number }> = {}) {
  return new HttpTransport({
    baseUrl: 'https://api.takt.test/api/v1',
    apiKey: 'sk_test',
    fetch: fetchFn,
    timeoutMs: over.timeoutMs ?? 1000,
    retries: over.retries ?? 0,
  });
}

describe('HttpTransport', () => {
  it('sends the bearer token and builds the URL with query', async () => {
    const stub = sequencedFetch([() => json(200, { ok: true })]);
    const t = transport(stub.fn);
    const params = new URLSearchParams({ period: '7d' });
    const out = await t.request<{ ok: boolean }>('GET', '/sites/x/stats/summary', { query: params });
    expect(out.ok).toBe(true);
    expect(stub.calls[0]!.url).toBe('https://api.takt.test/api/v1/sites/x/stats/summary?period=7d');
    const headers = stub.calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk_test');
    expect(headers.accept).toBe('application/json');
  });

  it('serializes a JSON body and sets content-type', async () => {
    const stub = sequencedFetch([() => json(200, {})]);
    const t = transport(stub.fn);
    await t.request('POST', '/p', { body: { a: 1 } });
    expect(stub.calls[0]!.init.method).toBe('POST');
    expect(stub.calls[0]!.init.body).toBe('{"a":1}');
    const headers = stub.calls[0]!.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
  });

  it('maps a non-ok response to a TaktError', async () => {
    const stub = sequencedFetch([() => json(402, { error: { code: 'quota_api_depasse', message: 'q' } })]);
    const t = transport(stub.fn);
    await expect(t.request('GET', '/p')).rejects.toMatchObject({ status: 402, code: 'quota_api_depasse' });
  });

  it('does not retry a 4xx', async () => {
    const stub = sequencedFetch([() => json(400, { error: { code: 'bad' } })]);
    const t = transport(stub.fn, { retries: 3 });
    await expect(t.request('GET', '/p')).rejects.toBeInstanceOf(TaktError);
    expect(stub.count()).toBe(1);
  });

  it('retries a 5xx then succeeds', async () => {
    const stub = sequencedFetch([() => json(503, {}), () => json(200, { ok: 1 })]);
    const t = transport(stub.fn, { retries: 2 });
    const out = await t.request<{ ok: number }>('GET', '/p');
    expect(out.ok).toBe(1);
    expect(stub.count()).toBe(2);
  });

  it('retries a network error then gives up as erreur_reseau', async () => {
    const stub = sequencedFetch([
      () => {
        throw new TypeError('fetch failed');
      },
    ]);
    const t = transport(stub.fn, { retries: 1 });
    await expect(t.request('GET', '/p')).rejects.toMatchObject({ code: 'erreur_reseau' });
    expect(stub.count()).toBe(2);
  });

  const abortAwareFetch: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    });

  it('times out a slow request', async () => {
    const t = transport(abortAwareFetch, { timeoutMs: 20, retries: 0 });
    await expect(t.request('GET', '/p')).rejects.toMatchObject({ code: 'timeout' });
  });

  it('propagates an external abort', async () => {
    const t = transport(abortAwareFetch, { timeoutMs: 1000, retries: 2 });
    const ac = new AbortController();
    const p = t.request('GET', '/p', { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});

describe('HttpTransport redirects', () => {
  interface Hit {
    server: 'origin' | 'target';
    path: string;
    authorization?: string;
  }

  const hits: Hit[] = [];
  let origin: Server;
  let target: Server;
  let originBase: string;
  let targetBase: string;

  function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<Server> {
    const server = createServer(handler);
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
  }

  function portOf(server: Server): string {
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function recording(server: 'origin' | 'target', route: (req: IncomingMessage, res: ServerResponse) => void) {
    return (req: IncomingMessage, res: ServerResponse) => {
      hits.push({ server, path: req.url ?? '', authorization: req.headers.authorization });
      route(req, res);
    };
  }

  function sendJson(res: ServerResponse, status: number, location?: string) {
    res.writeHead(status, location ? { location } : { 'content-type': 'application/json' });
    res.end(location ? undefined : '{"ok":true}');
  }

  beforeAll(async () => {
    target = await listen(recording('target', (_req, res) => sendJson(res, 200)));
    targetBase = portOf(target);
    origin = await listen(
      recording('origin', (req, res) => {
        const match = /^\/(cross|same)\/(\d{3})$/.exec(req.url ?? '');
        if (!match) return sendJson(res, 200);
        const [, kind, status] = match;
        const location = kind === 'cross' ? `${targetBase}/landing` : `${originBase}/landing`;
        sendJson(res, Number(status), location);
      }),
    );
    originBase = portOf(origin);
  });

  afterAll(async () => {
    await Promise.all([new Promise((r) => origin.close(r)), new Promise((r) => target.close(r))]);
  });

  function realTransport() {
    return new HttpTransport({
      baseUrl: originBase,
      apiKey: 'sk_test',
      fetch: globalThis.fetch,
      timeoutMs: 2000,
      retries: 0,
    });
  }

  it.each([302, 307])('does not forward authorization on a %i cross-origin redirect', async (status) => {
    hits.length = 0;
    const out = await realTransport().request<{ ok: boolean }>('GET', `/cross/${status}`);
    expect(out.ok).toBe(true);
    const first = hits.find((h) => h.server === 'origin' && h.path === `/cross/${status}`);
    const landed = hits.find((h) => h.server === 'target');
    expect(first?.authorization).toBe('Bearer sk_test');
    expect(landed?.path).toBe('/landing');
    expect(landed?.authorization).toBeUndefined();
  });

  it.each([302, 307])('keeps authorization on a %i same-origin redirect', async (status) => {
    hits.length = 0;
    const out = await realTransport().request<{ ok: boolean }>('GET', `/same/${status}`);
    expect(out.ok).toBe(true);
    const landed = hits.find((h) => h.server === 'origin' && h.path === '/landing');
    expect(landed?.authorization).toBe('Bearer sk_test');
  });
});

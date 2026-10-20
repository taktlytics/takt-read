import { describe, it, expect } from 'vitest';
import TaktClient from '../src/client';
import StatsResource from '../src/resources/stats';
import TaktError from '../src/errors';

const ok: typeof fetch = async () =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

function client(over: Partial<ConstructorParameters<typeof TaktClient>[0]> = {}) {
  return new TaktClient({
    apiKey: 'sk',
    domain: 'example.com',
    baseUrl: 'https://api.takt.test/api/v1',
    fetch: ok,
    ...over,
  });
}

describe('TaktClient', () => {
  it('exposes a stats resource', () => {
    expect(client().stats).toBeInstanceOf(StatsResource);
  });

  it('rejects a missing apiKey', () => {
    expect(() => client({ apiKey: '' })).toThrow(TaktError);
  });

  it('rejects a missing domain', () => {
    expect(() => client({ domain: '' })).toThrow(TaktError);
  });

  it('defaults baseUrl to the hosted Takt read API root when omitted', async () => {
    const calls: string[] = [];
    const spy: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const takt = new TaktClient({ apiKey: 'sk', domain: 'example.com', fetch: spy });
    await takt.stats.summary();
    // the default base must include the /api/v1 prefix, otherwise the request hits the marketing
    // SPA and comes back as HTML, not JSON
    expect(calls[0]).toBe('https://taktlytics.com/api/v1/sites/example.com/stats/summary');
  });

  it('still validates and normalises an explicit baseUrl', async () => {
    const calls: string[] = [];
    const spy: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    await client({ baseUrl: 'https://api.takt.test/api/v1/', fetch: spy }).stats.summary();
    // trailing slash on an explicit baseUrl is normalised away
    expect(calls[0]).toBe('https://api.takt.test/api/v1/sites/example.com/stats/summary');
  });

  it('rejects an invalid baseUrl', () => {
    expect(() => client({ baseUrl: 'not a url' })).toThrowError(/baseUrl invalide/);
  });

  it('rejects a non-http(s) baseUrl scheme', () => {
    for (const baseUrl of ['file:///etc/passwd', 'ftp://host/x', 'javascript:alert(1)']) {
      expect(() => client({ baseUrl })).toThrowError(/schéma http/);
    }
  });

  it('refuses plain http outside the loopback interface', () => {
    for (const baseUrl of ['http://example.com/api/v1', 'http://10.0.0.5/api/v1', 'http://takt.internal/api/v1']) {
      expect(() => client({ baseUrl })).toThrowError(/réservé à la boucle locale/);
    }
  });

  it('accepts plain http on the loopback interface', () => {
    for (const baseUrl of ['http://localhost:8080/api/v1', 'http://127.0.0.1:8080/api/v1', 'http://[::1]:8080/api/v1']) {
      expect(() => client({ baseUrl })).not.toThrow();
    }
  });

  it('accepts https on any host', () => {
    expect(() => client({ baseUrl: 'https://takt.example.com/api/v1' })).not.toThrow();
  });

  it('drives a real call through the stats resource', async () => {
    const calls: string[] = [];
    const spy: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response('{"visitors":3}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const out = await client({ baseUrl: 'https://api.takt.test/api/v1/', fetch: spy }).stats.summary();
    expect(out.visitors).toBe(3);
    // trailing slash on baseUrl is normalised away
    expect(calls[0]).toBe('https://api.takt.test/api/v1/sites/example.com/stats/summary');
  });
});

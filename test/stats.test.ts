import { describe, it, expect } from 'vitest';
import HttpTransport from '../src/http/transport';
import StatsResource from '../src/resources/stats';

function recorder(
  body: unknown = {},
  opts: { org?: string; text?: string; headers?: Record<string, string> } = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    if (opts.text !== undefined) {
      return new Response(opts.text, {
        status: 200,
        headers: { 'content-type': 'text/csv', ...opts.headers },
      });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json', ...opts.headers },
    });
  };
  const transport = new HttpTransport({
    baseUrl: 'https://api.takt.test/api/v1',
    apiKey: 'k',
    fetch: fn,
    timeoutMs: 1000,
    retries: 0,
  });
  return { stats: new StatsResource(transport, 'example.com', opts.org), calls };
}

function urlOf(call: { url: string }): URL {
  return new URL(call.url);
}

describe('StatsResource', () => {
  it('routes summary with serialized query', async () => {
    const r = recorder({ visitors: 1 });
    await r.stats.summary({ period: '7d', compare: true });
    const u = urlOf(r.calls[0]!);
    expect(u.pathname).toBe('/api/v1/sites/example.com/stats/summary');
    expect(u.searchParams.get('period')).toBe('7d');
    expect(u.searchParams.get('compare')).toBe('true');
  });

  it('encodes a single segment without a join', async () => {
    const r = recorder();
    await r.stats.breakdown({ dimension: 'pages', segment: [{ dim: 'countries', op: 'is', val: 'FR' }] });
    const u = urlOf(r.calls[0]!);
    expect(u.pathname).toBe('/api/v1/sites/example.com/stats/breakdown');
    expect(u.searchParams.get('dimension')).toBe('pages');
    expect(u.searchParams.getAll('segment')).toEqual(['countries:is:FR']);
    expect(u.searchParams.getAll('segment_join')).toEqual([]);
  });

  it('offsets segment_join by one for multiple segments', async () => {
    const r = recorder();
    await r.stats.summary({
      segment: [
        { dim: 'countries', op: 'is', val: 'FR' },
        { dim: 'browsers', op: 'is', val: 'Firefox', join: 'or' },
        { dim: 'pages', op: 'not', val: '/blog' },
      ],
    });
    const u = urlOf(r.calls[0]!);
    expect(u.searchParams.getAll('segment')).toEqual([
      'countries:is:FR',
      'browsers:is:Firefox',
      'pages:not:/blog',
    ]);
    expect(u.searchParams.getAll('segment_join')).toEqual(['or', 'and']);
  });

  it('requires event for properties', async () => {
    const r = recorder(['a', 'b']);
    const out = await r.stats.properties('signup', { period: 'day' });
    expect(out).toEqual(['a', 'b']);
    const u = urlOf(r.calls[0]!);
    expect(u.pathname).toBe('/api/v1/sites/example.com/stats/properties');
    expect(u.searchParams.get('event')).toBe('signup');
    expect(u.searchParams.get('period')).toBe('day');
  });

  it('requires event and key for property-breakdown', async () => {
    const r = recorder();
    await r.stats.propertyBreakdown('signup', 'plan');
    const u = urlOf(r.calls[0]!);
    expect(u.pathname).toBe('/api/v1/sites/example.com/stats/property-breakdown');
    expect(u.searchParams.get('event')).toBe('signup');
    expect(u.searchParams.get('key')).toBe('plan');
  });

  it('posts a JSON body for the batch breakdown', async () => {
    const r = recorder({ items: [] });
    await r.stats.propertyBreakdownBatch({ items: [{ event: 'signup', key: 'plan' }] });
    const call = r.calls[0]!;
    expect(urlOf(call).pathname).toBe('/api/v1/sites/example.com/stats/property-breakdown/batch');
    expect(call.init.method).toBe('POST');
    expect(call.init.body).toBe('{"items":[{"event":"signup","key":"plan"}]}');
  });

  it('joins dimensions for the batch breakdowns endpoint', async () => {
    const r = recorder({ breakdowns: {} });
    await r.stats.breakdowns(['pages', 'sources'], { period: '7d' });
    const u = urlOf(r.calls[0]!);
    expect(u.pathname).toBe('/api/v1/sites/example.com/stats/breakdowns');
    expect(u.searchParams.get('dimensions')).toBe('pages,sources');
    expect(u.searchParams.get('period')).toBe('7d');
  });

  it('rejects an empty dimensions list without a request', async () => {
    const r = recorder();
    await expect(r.stats.breakdowns([])).rejects.toMatchObject({ code: 'config_invalide' });
    expect(r.calls).toHaveLength(0);
  });

  it('exports CSV as raw text on the org-scoped route', async () => {
    const csv = 'label,visitors,pageviews\n/,3,5\n';
    const r = recorder({}, { org: 'acme', text: csv });
    const out = await r.stats.export({ period: '30d' });
    expect(out).toBe(csv);
    const call = r.calls[0]!;
    expect(urlOf(call).pathname).toBe('/api/v1/orgs/acme/sites/example.com/stats/export');
    expect(urlOf(call).searchParams.get('format')).toBe('csv');
    expect((call.init.headers as Record<string, string>).accept).toBe('text/csv');
  });

  it('exports JSON rows when format is json', async () => {
    const rows = [{ label: '/', visitors: 3, pageviews: 5 }];
    const r = recorder(rows, { org: 'acme' });
    const out = await r.stats.export({ format: 'json' });
    expect(out).toEqual(rows);
    expect(urlOf(r.calls[0]!).searchParams.get('format')).toBe('json');
  });

  it('keeps export returning the bare body when the server truncates', async () => {
    const rows = [{ label: '/', visitors: 3, pageviews: 5 }];
    const r = recorder(rows, { org: 'acme', headers: { 'x-takt-truncated': 'true' } });
    expect(await r.stats.export({ format: 'json' })).toEqual(rows);
  });

  it('flags a truncated JSON export from the X-Takt-Truncated header', async () => {
    const rows = [{ label: '/', visitors: 3, pageviews: 5 }];
    const r = recorder(rows, { org: 'acme', headers: { 'X-Takt-Truncated': 'true' } });
    const out = await r.stats.exportResult({ format: 'json' });
    expect(out).toEqual({ data: rows, truncated: true });
    expect(urlOf(r.calls[0]!).searchParams.get('format')).toBe('json');
  });

  it('flags a truncated CSV export from the X-Takt-Truncated header', async () => {
    const csv = 'label,visitors,pageviews\n/,3,5\n';
    const r = recorder({}, { org: 'acme', text: csv, headers: { 'X-Takt-Truncated': 'true' } });
    const out = await r.stats.exportResult({ period: '30d' });
    expect(out).toEqual({ data: csv, truncated: true });
    expect((r.calls[0]!.init.headers as Record<string, string>).accept).toBe('text/csv');
  });

  it('reports a complete export when the header says false', async () => {
    const r = recorder([], { org: 'acme', headers: { 'X-Takt-Truncated': 'false' } });
    expect(await r.stats.exportResult({ format: 'json' })).toEqual({ data: [], truncated: false });
  });

  it('reports a complete export when the header is absent', async () => {
    const r = recorder({}, { org: 'acme', text: '' });
    expect(await r.stats.exportResult()).toEqual({ data: '', truncated: false });
  });

  it('requires org for exportResult', async () => {
    const r = recorder();
    await expect(r.stats.exportResult()).rejects.toMatchObject({ code: 'config_invalide' });
    expect(r.calls).toHaveLength(0);
  });

  it('requires org for export', async () => {
    const r = recorder();
    await expect(r.stats.export()).rejects.toMatchObject({ code: 'config_invalide' });
    expect(r.calls).toHaveLength(0);
  });

  it('escapes the domain in the path', async () => {
    const r = recorder();
    const transport = new HttpTransport({
      baseUrl: 'https://api.takt.test/api/v1',
      apiKey: 'k',
      fetch: async (input) => {
        r.calls.push({ url: String(input), init: {} });
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
      timeoutMs: 1000,
      retries: 0,
    });
    await new StatsResource(transport, 'a/b').realtime();
    expect(urlOf(r.calls[0]!).pathname).toBe('/api/v1/sites/a%2Fb/stats/realtime');
  });
});

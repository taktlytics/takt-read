import TaktError from './errors';
import HttpTransport from './http/transport';
import StatsResource from './resources/stats';

export interface TaktClientOptions {
  apiKey: string;
  domain: string;
  org?: string;
  /**
   * Root of the Takt read API: the value the resource paths (`/sites/:domain/stats/...`) are
   * appended to, so it must include the API prefix. Optional: defaults to the hosted Takt read
   * API root (`https://taktlytics.com/api/v1`) so the SDK works out of the box. Provide it to
   * target another host, such as a first-party proxy or a test environment (e.g.
   * `https://proxy.example.com/api/v1`). When provided it must be a valid http(s) URL; any
   * trailing slash is stripped.
   */
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_BASE_URL = 'https://taktlytics.com/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export default class TaktClient {
  readonly stats: StatsResource;

  constructor(options: TaktClientOptions) {
    if (!options.apiKey) throw new TaktError(0, 'config_invalide', 'apiKey requis');
    if (!options.domain) throw new TaktError(0, 'config_invalide', 'domain requis');

    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new TaktError(0, 'config_invalide', 'baseUrl invalide');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TaktError(0, 'config_invalide', 'baseUrl doit utiliser le schéma http(s)');
    }
    if (parsed.protocol === 'http:' && !LOOPBACK_HOSTS.has(parsed.hostname)) {
      throw new TaktError(0, 'config_invalide', 'baseUrl en http réservé à la boucle locale (localhost, 127.0.0.1, [::1]) ; utilisez https');
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new TaktError(0, 'config_invalide', 'fetch indisponible : fournissez options.fetch');
    }

    const transport = new HttpTransport({
      baseUrl: parsed.toString().replace(/\/$/, ''),
      apiKey: options.apiKey,
      fetch: fetchImpl,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retries: Math.max(0, options.retries ?? DEFAULT_RETRIES),
    });

    this.stats = new StatsResource(transport, options.domain, options.org);
  }
}

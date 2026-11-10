import TaktError from '../errors';

export type HttpMethod = 'GET' | 'POST';

export interface TransportConfig {
  baseUrl: string;
  apiKey: string;
  fetch: typeof fetch;
  timeoutMs: number;
  retries: number;
}

export interface RequestOptions {
  query?: URLSearchParams;
  body?: unknown;
  signal?: AbortSignal;
  accept?: string;
  raw?: boolean;
}

export interface HttpResponse<T> {
  body: T;
  headers: Headers;
}

const MAX_BACKOFF_MS = 2000;

export default class HttpTransport {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #retries: number;

  constructor(config: TransportConfig) {
    this.#baseUrl = config.baseUrl;
    this.#apiKey = config.apiKey;
    this.#fetch = config.fetch;
    this.#timeoutMs = config.timeoutMs;
    this.#retries = config.retries;
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.requestWithHeaders<T>(method, path, options)).body;
  }

  async requestWithHeaders<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const url = this.#url(path, options.query);
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.#apiKey}`,
      accept: options.accept ?? 'application/json',
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    for (let attempt = 0; ; attempt++) {
      let timedOut = false;
      const controller = new AbortController();
      const relayAbort = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) controller.abort(options.signal.reason);
      else options.signal?.addEventListener('abort', relayAbort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.#timeoutMs);

      try {
        const res = await this.#fetch(url, { method, headers, body, signal: controller.signal });
        if (res.ok) {
          const body = (options.raw ? await res.text() : await res.json()) as T;
          return { body, headers: res.headers };
        }
        if (attempt < this.#retries && this.#retryable(res.status)) {
          await this.#sleep(this.#delay(attempt, res));
          continue;
        }
        throw await TaktError.fromResponse(res);
      } catch (err) {
        if (err instanceof TaktError) throw err;
        if (timedOut) throw new TaktError(0, 'timeout', `requête expirée après ${this.#timeoutMs} ms`);
        if (options.signal?.aborted) throw err;
        if (attempt < this.#retries) {
          await this.#sleep(this.#delay(attempt));
          continue;
        }
        throw new TaktError(0, 'erreur_reseau', err instanceof Error ? err.message : 'erreur réseau');
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', relayAbort);
      }
    }
  }

  #url(path: string, query?: URLSearchParams): string {
    const qs = query?.toString();
    return `${this.#baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  #retryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  #delay(attempt: number, res?: Response): number {
    const retryAfter = res?.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }
    return Math.min(MAX_BACKOFF_MS, 200 * 2 ** attempt);
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

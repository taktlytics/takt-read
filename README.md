# @vskstudio/takt-read


> 📚 **Documentation**: [taktlytics.com/docs/reference/takt-read](https://taktlytics.com/docs/reference/takt-read)

Server-only TypeScript SDK for the Takt read API. Query your analytics: summary, timeseries, breakdowns, realtime, goals, funnels, custom properties and revenue, with a typed client.

> **Server-only.** Your read API key is a secret. Use this SDK on a server (API route, cron, backend service). Never ship it to a browser bundle.

## Install

```bash
npm install @vskstudio/takt-read
# or: pnpm add @vskstudio/takt-read
```

Requires Node.js 20+ (uses the global `fetch`).

## Quick start

```ts
import TaktClient from '@vskstudio/takt-read';

const takt = new TaktClient({
  apiKey: process.env.TAKT_API_KEY!, // secret: keep it server-side
  domain: 'example.com',
  org: 'my-org', // optional, only needed for stats.export() (org-scoped route)
  // baseUrl defaults to the hosted Takt read API root (https://taktlytics.com/api/v1).
  // Set it to target another host (a first-party proxy, a test environment), e.g. 'https://proxy.example.com/api/v1'.
  timeoutMs: 30_000, // optional, default 30s
  retries: 2, // optional, default 2 (retries 429 + 5xx with backoff)
});

const summary = await takt.stats.summary({ period: '30d' });
console.log(summary.visitors, summary.pageviews);
```

`baseUrl` is optional: it defaults to the hosted Takt read API root (`https://taktlytics.com/api/v1`).
It is the value resource paths (`/sites/:domain/stats/...`) are appended to, so a custom `baseUrl`
(a first-party proxy, for instance) must include the `/api/v1` prefix, e.g. `https://proxy.example.com/api/v1`.
Plain `http://` is accepted only on the loopback interface (`localhost`, `127.0.0.1`, `[::1]`); any other host must use `https://`, otherwise the constructor throws `config_invalide`.
The constructor validates options and throws a `TaktError` (`code: 'config_invalide'`) on bad input.

## Stats methods

All read endpoints live under `takt.stats`. Each method takes an optional final
`{ signal }` argument for cancellation via an `AbortController`.

| Method | Returns |
| --- | --- |
| `stats.summary(query?)` | `StatsSummary` |
| `stats.timeseries(query?)` | `StatsTimeseries` |
| `stats.breakdown(query & { dimension })` | `StatsBreakdown` |
| `stats.breakdowns(dimensions, query?)` | `StatsBreakdowns` |
| `stats.realtime()` | `StatsRealtime` |
| `stats.goals(query?)` | `StatsGoals` |
| `stats.funnels(query?)` | `FunnelReports` |
| `stats.properties(event, query?)` | `string[]` |
| `stats.propertyBreakdown(event, key, query?)` | `PropertyBreakdown` |
| `stats.propertyBreakdownBatch(request, query?)` | `PropertyBatchResponse` |
| `stats.revenue(event, query?)` | `RevenueByCurrency` |
| `stats.export(query?)` | `string` (CSV) or `StatsExportRow[]` (JSON), and it requires `org` |

```ts
// Several rankings in one request:
const { breakdowns } = await takt.stats.breakdowns(['pages', 'sources', 'countries'], {
  period: '30d',
});
console.log(breakdowns.pages.rows, breakdowns.sources.rows);

// Exact figures for one specific URL. Segment on the raw pathname:
const page = await takt.stats.summary({
  period: '30d',
  segment: [{ dim: 'pages', op: 'is', val: '/servers/1025426969745182741' }],
});
console.log(page.visitors, page.pageviews);

// Export the page ranking (needs `org` on the client):
const csv = await takt.stats.export({ period: '30d' }); // raw CSV string
const rows = await takt.stats.export({ period: '30d', format: 'json' }); // StatsExportRow[]
```

```ts
const ac = new AbortController();
const realtime = await takt.stats.realtime({ signal: ac.signal });
```

## Query options

All read methods accept an optional `StatsQuery`:

```ts
await takt.stats.timeseries({
  period: '30d',          // 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo'
  interval: 'day',        // 'hour' | 'day' | 'week' | 'month'
  tz: 'Europe/Paris',
  compare: true,          // include the previous period
  country: 'FR',
  segment: [
    { dim: 'browsers', op: 'is', val: 'Firefox' },
    { dim: 'pages', op: 'not', val: '/blog', join: 'or' },
  ],
});
```

Use `from`/`to` (ISO dates) instead of `period` for a custom window.

`dimension` (breakdown), `segment[].dim` and `segment[].op` are typed unions (`StatsDimension` / `SegmentOperator`), so your editor autocompletes them and the compiler rejects invalid names. Dimensions: `pages`, `sources`, `countries`, `regions`, `cities`, `os`, `browsers`, `devices`, `utm_source`, `utm_medium`, `utm_campaign` (note the plural: the singular `page`/`source` forms are not valid). Segment operators: `is`, `not`.

## Error handling

Non-2xx responses throw a `TaktError` carrying the HTTP status and the API's error code:

```ts
import { TaktError } from '@vskstudio/takt-read';

try {
  await takt.stats.summary();
} catch (err) {
  if (err instanceof TaktError) {
    console.error(err.status, err.code, err.message);
    if (err.code === 'quota_api_depasse') {
      // read quota exhausted
    }
  }
}
```

## License

UNLICENSED: proprietary. © vskstudio.

---

# @vskstudio/takt-read (Français)

SDK TypeScript côté serveur pour l'API de lecture Takt. Interrogez vos statistiques (résumé, séries temporelles, répartitions, temps réel, objectifs, tunnels, propriétés personnalisées et revenus) avec un client typé.

> **Côté serveur uniquement.** Votre clé d'API de lecture est secrète. Utilisez ce SDK sur un serveur (route API, cron, service backend). Ne l'embarquez jamais dans un bundle navigateur.

## Installation

```bash
npm install @vskstudio/takt-read
```

Nécessite Node.js 20+ (utilise le `fetch` global).

## Démarrage rapide

```ts
import TaktClient from '@vskstudio/takt-read';

const takt = new TaktClient({
  apiKey: process.env.TAKT_API_KEY!, // secret, à garder côté serveur
  domain: 'example.com',
  // baseUrl pointe par défaut vers la racine de l'API read Takt hébergée (https://taktlytics.com/api/v1).
  // Renseignez-le pour cibler un autre hôte (proxy first-party, environnement de test), ex. 'https://proxy.example.com/api/v1'.
  timeoutMs: 30_000, // optionnel, 30s par défaut
  retries: 2, // optionnel, 2 par défaut (réessaie 429 + 5xx avec backoff)
});

const resume = await takt.stats.summary({ period: '30d' });
```

`baseUrl` est optionnel : il pointe par défaut vers la racine de l'API read Takt hébergée
(`https://taktlytics.com/api/v1`). C'est la valeur à laquelle les chemins des ressources
(`/sites/:domain/stats/...`) sont ajoutés, donc un `baseUrl` personnalisé (proxy first-party, par exemple) doit inclure le préfixe
`/api/v1`, ex. `https://proxy.example.com/api/v1`.
Le `http://` n'est accepté que sur la boucle locale (`localhost`, `127.0.0.1`, `[::1]`) ; tout autre hôte doit utiliser `https://`, sinon le constructeur lève `config_invalide`.
Les méthodes vivent sous `takt.stats` et acceptent un `{ signal }` final pour l'annulation.

## Gestion des erreurs

Les réponses non-2xx lèvent une `TaktError` portant le statut HTTP et le code d'erreur de l'API (par exemple `quota_api_depasse` lorsque le quota de lecture est dépassé). Le constructeur valide ses options et lève une `TaktError` (`config_invalide`) en cas d'entrée invalide ; un dépassement de délai lève le code `timeout`, une panne réseau `erreur_reseau`.

## Licence

UNLICENSED, propriétaire. © vskstudio.

# @vskstudio/takt-read

## 0.5.0

### Minor Changes

- d2ad85b: Breaking: `baseUrl` over plain `http://` is now refused unless the host is loopback (`localhost`, `127.0.0.1`, `[::1]`). Self-hosted instances must be served over `https://`. Node 18 is no longer supported: the minimum Node.js version is now 20.

  The HTTP transport's cross-origin redirect behavior (the `Authorization` header is dropped when a redirect leaves the origin) is now covered by tests.

## 0.4.0

### Minor Changes

- dd61176: Add the two remaining read endpoints so the SDK covers the full stats surface:

  - `stats.breakdowns(dimensions, query?)`: several rankings in a single request
    (`GET /stats/breakdowns?dimensions=…`), returning a `StatsBreakdowns` map indexed by
    dimension. Throws `config_invalide` on an empty dimensions list (no request sent).
  - `stats.export(query?)`: page ranking export on the org-scoped route
    (`GET /orgs/:org/sites/:domain/stats/export`). Default `format: 'csv'` returns the raw CSV
    string; `format: 'json'` returns typed `StatsExportRow[]`. Requires the new optional `org`
    client option; calling it without one throws `config_invalide`.

  Also exports the new `StatsBreakdowns` and `StatsExportRow` types, and adds the `org` field to
  `TaktClientOptions`.

## 0.3.0

### Minor Changes

- 13f168b: Initial release: server-only TypeScript SDK for the Takt read API. Class-based architecture: `TaktClient` with a `stats` resource (summary, timeseries, breakdown, realtime, goals, funnels, properties, property breakdown, batch breakdown, revenue), a hardened HTTP transport (configurable timeout, retry with backoff on 429/5xx, `AbortSignal` support, bearer auth), option validation, and `TaktError` for typed error handling. Zero runtime dependencies, ESM + CJS.

### Patch Changes

- 4180c43: Fix the default `baseUrl` so the SDK works out of the box against the hosted API.

  The default pointed at the bare site origin (`https://taktlytics.com`), but resource paths are
  `/sites/:domain/stats/...` with no `/api/v1` prefix, so an out-of-the-box
  `new TaktClient({ apiKey, domain })` requested `https://taktlytics.com/sites/...`, which serves the
  marketing SPA and fails with `TaktError: Unexpected token '<' ... is not valid JSON`. The default is
  now the hosted read API root (`https://taktlytics.com/api/v1`), matching the `baseUrl` contract
  (the value paths are appended to). Explicit `baseUrl` values are unaffected, since they already had to
  include `/api/v1`.

## 0.2.0

### Minor

- `baseUrl` is now optional and defaults to the hosted Takt origin
  (`https://taktlytics.com`), so `TaktClient` works out of the box and stays
  consistent with the other Takt SDKs. Pass `baseUrl` to target a self-hosted
  instance; when provided it is still validated (http(s) scheme) and normalised
  (trailing slash stripped) exactly as before.

### Hardening

- `TaktClient` now rejects a `baseUrl` whose scheme is not `http:`/`https:`
  (e.g. `file:`, `ftp:`, `javascript:`), aligning the read SDK with the
  scheme validation already enforced in `@vskstudio/takt-core` and `takt-mcp`.

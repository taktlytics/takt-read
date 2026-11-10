---
'@vskstudio/takt-read': minor
---

Add `stats.exportResult(query?)`, which returns `{ data, truncated }` for the page ranking export.
The server caps the export at 999 rows and 256 KB and reports a cut with the `X-Takt-Truncated`
header, in CSV as in JSON. `truncated` reflects that header (`false` when it is `false` or absent),
and `data` has the same type as the `stats.export()` result for the same `format`.

`stats.export()` keeps its return type and still resolves to the bare body.
Exports the new `StatsExportResult` type.

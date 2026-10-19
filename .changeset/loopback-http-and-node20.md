---
"@vskstudio/takt-read": minor
---

Breaking: `baseUrl` over plain `http://` is now refused unless the host is loopback (`localhost`, `127.0.0.1`, `[::1]`). Self-hosted instances must be served over `https://`. Node 18 is no longer supported: the minimum Node.js version is now 20.

The HTTP transport's cross-origin redirect behavior (the `Authorization` header is dropped when a redirect leaves the origin) is now covered by tests.

YYYY-MM-DD — Global Error Handling
Learning: Express does not automatically handle uncaught synchronous errors cleanly. Malformed URIs caused Express to crash and leak internal HTML stack traces instead of providing standard JSON error responses. Unhandled `new URL()` instantiation errors would completely stop request handling and crash the server.
Action: Implement standard global Express error handlers as the last middleware step to catch these generic framework errors and serialize them as JSON. Wrap synchronous URL parsing in try/catch blocks within the proxy.

## 2024-05-01 — Process Stability & Memory Growth Limits

Learning:
Unbounded caches (`mockDataCache`) in long-running processes pose an OOM risk if malicious requests populate them with large unique keys, or if users load tens of thousands of mock files. Similarly, unhandled `error` events on piped Node.js streams (`proxyRes.pipe(res)`) are a severe process-level stability risk if the upstream target connection drops abruptly.

Action:
Ensure bounded constraints are implemented on all memory data structures (added a 10,000 entry eviction ceiling for `mockDataCache`). In proxy stream patterns, always explicitly listen for the 'error' event on both sides of a pipe to destroy downstream and prevent the `node:events` default handler from crashing the main application thread.
2024-04-03 — Chokidar Startup Optimization
Learning: By default, `chokidar.watch` emits `add` events for every existing file when it initializes. In a mock server with many files, this caused O(N) cache clears and console logs during startup.
Action: Future watchers handling hot-reload patterns should use `ignoreInitial: true` and implement a debounce for batch file updates to avoid rapid repetitive cache invalidation.

2024-05-23 — Prevent crash on proxy response headers
Learning: Setting dynamic HTTP headers via `res.setHeader()` in Express/Node.js can throw synchronous exceptions (e.g. `ERR_INVALID_CHAR`) if the values are malformed. If this happens inside an asynchronous callback (like `http.request`), it bypasses the Express global error handler and crashes the entire Node process.
Action: Always wrap `res.setHeader()` calls with a `try-catch` block when dealing with upstream proxy targets.

YYYY-MM-DD — Cache Stampede Prevention
Learning: Caching the result of an asynchronous operation *after* it completes leaves the system vulnerable to a "cache stampede" (thundering herd) under high concurrency, where multiple requests trigger the exact same expensive I/O and parsing operation simultaneously.
Action: Store a `Promise` of the operation in the cache *before* it resolves. Ensure rejected promises attach a `.catch(() => {})` handler before being stored to avoid unhandled rejection crashes in modern Node.js environments.

## 2026-04-09 — Optimize Directory Scanning

Learning:
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.sep).join('/')`) on every file, which is heavily inefficient and generates excess garbage, causing ~36ms overhead on medium directories. By incrementally tracking the relative path during recursion and using simple string concatenation, scanning is significantly faster (~15ms) and allocates far less memory.

Action:
Avoid using `path.relative` in hot paths or tight loops. Instead, compute relative paths incrementally using string concatenation or `path.posix.join` to avoid unnecessary array allocations and platform-specific separator patching.
## 2025-04-11 — Strict URL decoding for path traversal prevention

Learning:
Relying on simple substring checks like `includes('..')` or specific URL-encoded variations like `includes('%2e%2e')` is insufficient for directory traversal protection. Attackers can bypass this using mixed encoding (e.g., `%2E.`, `%2E%2E`, or `.%2e`).

Action:
Always fully decode the URI component using `decodeURIComponent` (wrapped in a `try/catch` to safely handle malformed `URIError` exceptions) before validating against directory traversal sequences like `..`.

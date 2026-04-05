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

## 2024-04-05 — Prevent process crash from invalid proxy headers

Learning:
In Express proxy handlers, `res.setHeader(key, value)` can throw synchronous exceptions (e.g., `ERR_INVALID_HTTP_TOKEN`, `ERR_INVALID_CHAR`) when proxying upstream response headers. Because this happens inside the `http.request` response callback, it bypasses Express's global error middleware and causes an unhandled exception that crashes the entire Node.js process.

Action:
Always wrap dynamic header assignments (`res.setHeader`) from external/untrusted upstream sources in a `try-catch` block to prevent process termination.

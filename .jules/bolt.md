YYYY-MM-DD — Global Error Handling
Learning: Express does not automatically handle uncaught synchronous errors cleanly. Malformed URIs caused Express to crash and leak internal HTML stack traces instead of providing standard JSON error responses. Unhandled `new URL()` instantiation errors would completely stop request handling and crash the server.
Action: Implement standard global Express error handlers as the last middleware step to catch these generic framework errors and serialize them as JSON. Wrap synchronous URL parsing in try/catch blocks within the proxy.

## 2024-05-01 — Process Stability & Memory Growth Limits

Learning:
Unbounded caches (`mockDataCache`) in long-running processes pose an OOM risk if malicious requests populate them with large unique keys, or if users load tens of thousands of mock files. Similarly, unhandled `error` events on piped Node.js streams (`proxyRes.pipe(res)`) are a severe process-level stability risk if the upstream target connection drops abruptly.

Action:
Ensure bounded constraints are implemented on all memory data structures (added a 10,000 entry eviction ceiling for `mockDataCache`). In proxy stream patterns, always explicitly listen for the 'error' event on both sides of a pipe to destroy downstream and prevent the `node:events` default handler from crashing the main application thread.
## 2024-05-23 — Prevent crash on proxy response headers
Learning: Setting dynamic HTTP headers via `res.setHeader()` in Express/Node.js can throw synchronous exceptions (e.g. `ERR_INVALID_CHAR`) if the values are malformed. If this happens inside an asynchronous callback (like `http.request`), it bypasses the Express global error handler and crashes the entire Node process.
Action: Always wrap `res.setHeader()` calls with a `try-catch` block when dealing with upstream proxy targets.

## 2024-05-02 — Chokidar O(N) Startup & Batch Debounce

Learning:
Chokidar's default behavior emits an `add` event for every single file it discovers during initialization. For repositories or folders with many files, this triggers an O(N) cascade of synchronous callback executions (e.g., calling `reloadMocks()` thousands of times consecutively). Furthermore, batch file operations (like `git checkout` or `cp -r`) trigger rapid bursts of `add`/`change`/`unlink` events, severely degrading performance and spamming logs.

Action:
Always configure Chokidar with `ignoreInitial: true` when watching pre-existing directories unless the initial discovery phase is strictly required by the application logic. Furthermore, when watching files for high-level operations like "reload cache" or "recompile", always debounce the file watcher events to collapse rapid bursts into a single execution frame.

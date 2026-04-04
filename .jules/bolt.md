YYYY-MM-DD — Global Error Handling
Learning: Express does not automatically handle uncaught synchronous errors cleanly. Malformed URIs caused Express to crash and leak internal HTML stack traces instead of providing standard JSON error responses. Unhandled `new URL()` instantiation errors would completely stop request handling and crash the server.
Action: Implement standard global Express error handlers as the last middleware step to catch these generic framework errors and serialize them as JSON. Wrap synchronous URL parsing in try/catch blocks within the proxy.

## 2024-05-01 — Process Stability & Memory Growth Limits

Learning:
Unbounded caches (`mockDataCache`) in long-running processes pose an OOM risk if malicious requests populate them with large unique keys, or if users load tens of thousands of mock files. Similarly, unhandled `error` events on piped Node.js streams (`proxyRes.pipe(res)`) are a severe process-level stability risk if the upstream target connection drops abruptly.

Action:
Ensure bounded constraints are implemented on all memory data structures (added a 10,000 entry eviction ceiling for `mockDataCache`). In proxy stream patterns, always explicitly listen for the 'error' event on both sides of a pipe to destroy downstream and prevent the `node:events` default handler from crashing the main application thread.

2024-04-04 — Chokidar Startup Performance Fix
Learning: The mock server suffered from an O(N) startup cost when hot-reloading was enabled. Chokidar fires `add` events for every existing file during initialization, leading to redundant, cascading clear operations on all caches.
Action: Implemented `ignoreInitial: true` in Chokidar configuration and added a debounce wrapper (`scheduleReload`) around `reloadMocks()` to gracefully handle batch modifications without blocking or spamming the console. This should be applied to any future directory-watching implementations to prevent OOM or extreme start times.

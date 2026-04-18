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

## 2026-04-16 — Fix directory traversal bypass with decoded routes

Learning:
The directory traversal prevention was previously performed on the raw route. A double URL encoded sequence like `%252E%252E` bypasses a simple `route.includes('..') || route.includes('%2e%2e')` check. When the decoded path isn't used as the single source of truth for validation, the application is vulnerable.

Action:
Always fully decode the URI component using `decodeURIComponent` (wrapped in a `try/catch` to gracefully return `null` on malformed URLs) before performing path sequence validation.

## 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined

Learning:
When caching rejected promises, chaining `.catch(() => {})` directly onto `Promise.reject()` returns a new promise that resolves to `undefined`. This incorrectly stores a successful but empty cache entry instead of a cached rejection.

Action:
Always create the rejected promise first, attach the `.catch()` handler to it to prevent `unhandledRejection` warnings, but store the original rejected promise instance in the cache so subsequent awaits properly throw the cached error.

2024-05-18 — Preserve Original JSON Errors in Cache Rejections
Learning: When modifying caching logic to retain promise rejections (e.g., for invalid JSON), it is important not to override the original `SyntaxError` with a generic Error object to bypass deletion checks. Overriding the error degrades Developer Experience (DX) and observability.
Action: Mutate the original error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
## 2026-04-18 — Route matching of URL-encoded paths
Learning:
In Express route matching against the filesystem, `req.path` retains URL-encoded characters. Exact file lookups must use the fully decoded path to correctly match filesystem templates containing spaces. For dynamic route matching, the path must be split into segments before decoding to ensure encoded slashes (%2F) do not incorrectly alter the path's segment count.
Action:
Implement safe path matching where exact matches utilize `decodeURIComponent` and dynamic matches preserve path boundaries by splitting on un-decoded routes first, before safely decoding and comparing individual components.

2024-05-18 — Hot-path route resolution optimization
Learning: Performing expensive operations (like URI decoding, string replacement, directory traversal validation, and repetitive segment mapping) on every route lookup leads to continuous CPU exhaustion, particularly on hot paths or against malicious continuous probes.
Action: Normalize caching upfront before any expensive operations occur. Use the normalized inputs to immediately short-circuit. Additionally, cache invalid/malformed routes (like those generating URIError) as negative results (`null`) to immediately drop successive bad requests without redundant recalculations.

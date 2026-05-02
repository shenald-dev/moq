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

## 2024-05-18 — Route Cache OOM & Performance Improvement
Learning:
Moving the route cache key generation and check earlier in `resolveMockPath` optimizes performance. By generating the key and checking the cache before expensive operations like `decodeURIComponent`, regex manipulation, and directory traversal checks, we can serve repeated valid requests significantly faster. However, we MUST NOT cache invalid requests (like malformed URIs or traversal attempts) as null, because malicious fuzzing tools generate unique paths. Caching them would rapidly fill the cache, trigger the eviction policy, and cause cache thrashing for legitimate users.
Action:
Always perform caching checks at the very beginning of a lookup function before executing expensive parsing, decoding, or validation. Never cache unvalidated or maliciously formed input keys, as this creates a cache thrashing vulnerability.
2024-04-19 — Cache dynamic route segment decoding
Learning: `decodeURIComponent` inside a nested loop for every dynamic route candidate caused a substantial performance bottleneck during path resolution when many dynamic routes exist.
Action: Hoist segment decoding out of the candidate loop to evaluate exactly once, reducing redundant parsing on the hot path and significantly speeding up worst-case route lookup times.

## 2024-06-25 — Prevent Unhandled Stream Errors on Proxies

Learning:
When utilizing direct stream piping (`req.pipe(proxyReq)` and `proxyRes.pipe(res)`) in Express apps operating as reverse proxies, `error` events from one stream do not automatically propagate and safely destroy the other. Unhandled `error` events on either the client's Request (`req`) or Response (`res`) stream—such as abrupt client disconnects or aborted connections—will propagate to the global process and crash the Node.js application.

Action:
Always attach explicit `.on('error', err => target.destroy(err))` listeners on both sides of a proxy pipe in Node.js (i.e., attach an error listener to `req` to destroy `proxyReq`, and to `res` to destroy `proxyRes`).

## 2026-04-21 — Disable Express Etag and X-Powered-By

Learning:
Express calculates `ETag` headers automatically for responses, which involves an expensive hashing operation (using MD5 by default). For large JSON payloads served by mock servers, this creates a significant performance bottleneck (e.g. dropping throughput by over 30%). Additionally, the `X-Powered-By` header leaks the framework type and requires unnecessary processing overhead.

Action:
Always disable both `etag` and `x-powered-by` via `app.disable('etag')` and `app.disable('x-powered-by')` when the application does not strictly rely on standard HTTP client-side caching to boost overall throughput and reduce CPU overhead on large payload delivery.

2026-04-21 — Prevent proxy connection leaks on response close
Learning:
When acting as a reverse proxy, if the downstream client response (`res`) abruptly closes (e.g. client disconnects prematurely), the upstream HTTP request (`proxyReq`) and response (`proxyRes`) aren't necessarily torn down immediately by node stream mechanisms, which can leak open keep-alive connections to the upstream target.
Action:
In addition to handling stream `error` events, always attach a `.on('close')` event listener to the client response object (`res.on('close')`) that explicitly calls `proxyReq.destroy()` and `proxyRes.destroy()` to aggressively clean up pending requests and prevent socket exhaustion when clients disconnect.

2024-05-18 — Dynamic Route O(1) Candidate Retrieval
Learning:
Previously, dynamic route matching for unmocked endpoints (e.g., proxied requests or 404s) resulted in an O(N) traversal across the entire `dynamicRoutes` array on every request, creating a performance bottleneck on hot paths since we deliberately do not cache `null` lookup results to prevent cache thrashing.
Action:
Group `dynamicRoutes` into a `Map` structured by `${method}:${parts.length}`. This optimization enables O(1) retrieval of applicable route candidates, bypassing the array allocation and iterative evaluation loop entirely for requests that do not match the expected path segment count.

## 2024-05-18 — Dynamic Route Matching Optimization

Learning:
Using a Map to group dynamic routes by HTTP method and route part count replaces O(N) array iteration with an O(1) retrieval for candidate matches, avoiding CPU overhead during fallback routing.

Action:
Prefer indexed collections like Maps and Sets over array scans on critical paths with many lookups to ensure performance scalability.

2024-06-26 — Prevent Synchronous Crashes on Proxy Client Request Initialization
Learning:
When utilizing `http.request` or `https.request` in Node.js to proxy requests, constructing the client request (e.g., `transport.request(options, ...)`) can throw synchronous exceptions (such as `ERR_INVALID_CHAR` or `ERR_INVALID_HTTP_TOKEN`) if the incoming request contains invalid or malformed header characters. Because this exception is thrown synchronously during initialization, it bypasses standard asynchronous error event listeners and the Express global error handler, crashing the entire Node process.
Action:
Always wrap the instantiation of outgoing `transport.request` calls in a `try-catch` block to safely catch synchronous initialization errors and return an appropriate gateway error response, ensuring process stability against malformed upstream proxy requests.

## 2024-04-25 — Optimize decodeURIComponent Hot Path
Learning: Calling `decodeURIComponent` (and initializing its associated `try...catch` block) incurs unnecessary overhead for standard strings. By definition, URL encoding relies on the `%` character. Strings lacking a `%` will remain unmodified.
Action: Always wrap `decodeURIComponent` inside an `if (string.includes('%'))` check on hot paths (like routing) to bypass expensive native execution and V8 deoptimizations when decoding is not required.
2024-04-26 — Optimize hot path string operations
Learning: Using regex like `replace(/\/+$/, '')`, `startsWith`, and array allocations (like splitting an unencoded URL path) inside hot paths like Express middleware (`resolveMockPath` and `proxyRequest`) adds measurable overhead per request.
Action: Replaced regex and simple prefix checks with fast manual string traversal using `charCodeAt()` and `slice()` to reduce memory allocation and string parsing time. Always prefer `charCodeAt(0)` over `startsWith(char)` for single characters on critical paths.

## 2026-04-26 — Optimize Proxy URL Parsing

Learning:
When handling proxied requests, allocating and executing `new URL(targetUrl)` inside the `proxyRequest` method on every single incoming proxy request creates an expensive O(1) allocation/parsing cost that heavily degrades reverse proxy throughput.

Action:
Pre-parse the `proxyTarget` in the `MoqServer` constructor just once when proxying is enabled, and store the resulting hostname, port, and base path. Use fast string concatenation on the hot path in `proxyRequest` to build the target path rather than re-parsing the entire URL.

## 2024-04-27 — Optimize Dynamic Route String Allocation

Learning:
Calling `String.prototype.split('/')` unconditionally on the hot path for dynamic route resolution creates unnecessary O(N) array allocations per un-cached miss. This negatively impacts throughput when handling unrecognized paths or fallback routing.

Action:
Manually count the number of expected string segments by traversing the string (`charCodeAt(47)`) and conditionally execute `split('/')` only if dynamic route candidates actually exist for that determined segment length.
## 2024-04-28 — Path Validation Refactoring for Deep Directory Traversal

Learning:
URL decoding mechanisms inside path resolution routines must loop until no URL-encoded characters remain, capped by a safe depth limit, to avoid deep or multiple-encoded bypasses (e.g. `/%2525252E%2525252E/`). Hardcoding decoding passes is insufficient against malicious encoding schemes.

Action:
Ensure all path resolution logic utilizing `decodeURIComponent` globally applies a capped `while` loop (e.g. depth < 5) to robustly normalize deeply-encoded URI components before proceeding to validations like directory traversal checks (`..`).
## 2024-11-20 — Avoid intermediate array allocations in hot paths

Learning:
`Object.entries(headers)` creates an intermediate array of tuples on every proxy response, wasting memory and GC cycles. `parts.map()` creates a new array during every dynamic route path matching. Double `Map` lookups (`has()` then `get()`) create unnecessary operations.

Action:
Use `for...in` for header iteration, mutate temporary split arrays in-place when url decoding, and cache `.get()` results for Maps instead of checking `.has()`.
2024-04-29 — Map Retrieval Optimization
Learning: Avoid O(2) double-lookups (`Map.has(key)` followed by `Map.get(key)`) in hot paths like route mapping and payload fetching.
Action: Assign `Map.get(key)` result directly and check truthiness instead to cut redundant dictionary searches in Express routing flows.

## 2026-05-02 — Route Cache Key Optimization

Learning:
Performing string manipulation (like trailing slash trimming) on every hot-path request before checking the cache bypasses the true O(1) benefit of memoization.

Action:
Always perform cache lookups using the raw, unmodified input string first. Only execute string normalizations or allocations when a cache miss occurs to maximize throughput.

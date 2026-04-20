We need to merge two markdown files. They are largely similar but with some differences.

We need to compare sections.

Base (master) content:

```
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
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 2070 characters truncated (middle section) ...

 error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
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

```

Now Head branch (perf/resolve-mock-path-cache-hoisting-6306742892147498615) content:

```
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
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 644 characters truncated (middle section) ...

raversal prevention was previously performed on the raw route. A double URL encoded sequence like `%252E%252E` bypasses a simple `route.includes('..') || route.includes('%2e%2e')` check. When the decoded path isn't used as the single source of truth for validation, the application is vulnerable.

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

```

We need to merge.

Observations:

- The sections are similar up to "YYYY-MM-DD — Cache Stampede Prevention". Both have same content.

- After that, base has:

```
## 2026-04-09 — Optimize Directory Scanning

Learning:
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 2070 characters truncated (middle section) ...

 error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
## 2026-04-18 — Route matching of URL-encoded paths
...
```

Head has:

```
## 2026-04-09 — Optimize Directory Scanning

Learning:
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 644 characters truncated (middle section) ...

raversal prevention was previously performed on the raw route. A double URL encoded sequence like `%252E%252E` bypasses a simple `route.includes('..') || route.includes('%2e%2e')` check. When the decoded path isn't used as the single source of truth for validation, the application is vulnerable.

Action:
Always fully decode the URI component using `decodeURIComponent` (wrapped in a `try/catch` to gracefully return `null` on malformed URLs) before performing path sequence validation.

## 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined
...
```

Thus head includes new sections: "2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined", "2024-05-18 — Preserve Original JSON Errors in Cache Rejections", and "2024-05-18 — Hot-path route resolution optimization". Also head's "2026-04-09 — Optimize Directory Scanning" has different content (different learning and action). Base's "2026-04-09 — Optimize Directory Scanning" seems truncated and then leads into "2026-04-18 — Route matching of URL-encoded paths". Actually base after that truncated part goes into " error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability." That seems like part of the "2024-05-18 — Preserve Original JSON Errors in Cache Rejections" maybe? Actually base had earlier "2024-05-18 — Route Cache OOM & Performance Improvement" and "2024-04-19 — Cache dynamic route segment decoding". Then later "## 2024-06-25 — Prevent Unhandled Stream Errors on Proxies". The base does not have the sections about invalid JSON cache rejection, preserving original JSON errors, hot-path route resolution optimization. It does have "2026-04-09 — Optimize Directory Scanning" but truncated and then seems to continue with something about error object flag (maybe part of preserving original JSON errors). Actually base's truncated part ends with " error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability." That looks like the content from "2024-05-18 — Preserve Original JSON Errors in Cache Rejections". So base includes that but maybe misplaced.

Let's examine base more precisely after the truncation:

Base snippet:

```
## 2026-04-09 — Optimize Directory Scanning

Learning:
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 2070 characters truncated (middle section) ...

 error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
## 2026-04-18 — Route matching of URL-encoded paths
```

Thus after the truncated part, there is a line that starts with a space then "error object ...". That seems to be the continuation of the truncated section? Actually the truncated section likely omitted some content, and after that we see the error object line, which is likely part of the same section (maybe the "Learning" continues). Then after that we see "## 2026-04-18 — Route matching of URL-encoded paths". So base's section 2026-04-09 includes learning about readDirRecursive and then some truncated middle, then error object line (maybe about caching JSON errors). Then directly goes to 2026-04-18 section.

Head's 2026-04-09 section includes learning about readDirRecursive, truncated middle, then a different learning about traversal prevention and double URL encoded sequence, then action about fully decode URI component.

Thus we need to merge: we should keep both learnings? The base's error object line seems unrelated to directory scanning; maybe it's actually part of a different section that got misplaced due to truncation. But we need to produce a coherent merged file.

We also have head's extra sections: 2024-04-17, 2024-05-18 (Preserve Original JSON Errors), 2024-05-18 (Hot-path route resolution optimization). Base has 2024-05-18 (Route Cache OOM & Performance Improvement) and 2024-04-19 (Cache dynamic route segment decoding). Base also has 2024-06-25 section.

Head does not have 2024-06-25 section? Actually head ends after the hot-path route resolution optimization; no 2024-06-25 section. Base has that section.

Thus we need to include all sections from both, preferring head where conflicts.

Let's list sections in order as they appear in base:

1. YYYY-MM-DD — Global Error Handling
2. ## 2024-05-01 — Process Stability & Memory Growth Limits
3. 2024-04-03 — Chokidar Startup Optimization
4. 2024-05-23 — Prevent crash on proxy response headers
5. YYYY-MM-DD — Cache Stampede Prevention
6. ## 2026-04-09 — Optimize Directory Scanning
7. (truncated middle) ... error object line ...
8. ## 2026-04-18 — Route matching of URL-encoded paths
9. ## 2024-05-18 — Route Cache OOM & Performance Improvement
10. 2024-04-19 — Cache dynamic route segment decoding
11. ## 2024-06-25 — Prevent Unhandled Stream Errors on Proxies

Head sections:

1. YYYY-MM-DD — Global Error Handling (same)
2. ## 2024-05-01 — Process Stability & Memory Growth Limits (same)
3. 2024-04-03 — Chokidar Startup Optimization (same)
4. 2024-05-23 — Prevent crash on proxy response headers (same)
5. YYYY-MM-DD — Cache Stampede Prevention (same)
6. ## 2026-04-09 — Optimize Directory Scanning (different content)
7. ## 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined
8. 2024-05-18 — Preserve Original JSON Errors in Cache Rejections
9. ## 2026-04-18 — Route matching of URL-encoded paths (same as base? same content)
10. 2024-05-18 — Hot-path route resolution optimization

Note: head does not have the base's 2024-05-18 Route Cache OOM & Performance Improvement, nor 2024-04-19 Cache dynamic route segment decoding, nor 2024-06-25 Prevent Unhandled Stream Errors on Proxies.

But head does have 2024-05-18 Preserve Original JSON Errors and Hot-path route resolution optimization.

We need to keep all meaningful changes from both branches. So we should include sections from base that are not in head, and sections from head that are not in base, and for overlapping sections we need to merge content preferring head unless base has obvious bug fix.

Overlapping sections:

- Global Error Handling: identical.
- Process Stability & Memory Growth Limits: identical.
- Chokidar Startup Optimization: identical.
- Prevent crash on proxy response headers: identical.
- Cache Stampede Prevention: identical.
- Optimize Directory Scanning (2026-04-09): different. Need to merge.
- Route matching of URL-encoded paths (2026-04-18): identical? Let's compare: base's section:

```
## 2026-04-18 — Route matching of URL-encoded paths
Learning:
In Express route matching against the filesystem, `req.path` retains URL-encoded characters. Exact file lookups must use the fully decoded path to correctly match filesystem templates containing spaces. For dynamic route matching, the path must be split into segments before decoding to ensure encoded slashes (%2F) do not incorrectly alter the path's segment count.
Action:
Implement safe path matching where exact matches utilize `decodeURIComponent` and dynamic matches preserve path boundaries by splitting on un-decoded routes first, before safely decoding and comparing individual components.
```

Head's section:

```
## 2026-04-18 — Route matching of URL-encoded paths
Learning:
In Express route matching against the filesystem, `req.path` retains URL-encoded characters. Exact file lookups must use the fully decoded path to correctly match filesystem templates containing spaces. For dynamic route matching, the path must be split into segments before decoding to ensure encoded slashes (%2F) do not incorrectly alter the path's segment count.
Action:
Implement safe path matching where exact matches utilize `decodeURIComponent` and dynamic matches preserve path boundaries by splitting on un-decoded routes first, before safely decoding and comparing individual components.
```

Identical. So we can keep that.

- Route Cache OOM & Performance Improvement (2024-05-18) base only.
- Cache dynamic route segment decoding (2024-04-19) base only.
- Prevent Unhandled Stream Errors on Proxies (2024-06-25) base only.
- Fix Invalid JSON Cache Rejection Resolving to Undefined (2024-04-17) head only.
- Preserve Original JSON Errors in Cache Rejections (2024-05-18) head only.
- Hot-path route resolution optimization (2024-05-18) head only.

Now we need to decide ordering. The base's order after Cache Stampede Prevention is:

- Optimize Directory Scanning (2026-04-09)
- Route matching of URL-encoded paths (2026-04-18)
- Route Cache OOM & Performance Improvement (2024-05-18)
- Cache dynamic route segment decoding (2024-04-19)
- Prevent Unhandled Stream Errors on Proxies (2024-06-25)

Head's order after Cache Stampede Prevention is:

- Optimize Directory Scanning (2026-04-09) (different)
- Fix Invalid JSON Cache Rejection Resolving to Undefined (2024-04-17)
- Preserve Original JSON Errors in Cache Rejections (2024-05-18)
- ## 2026-04-18 — Route matching of URL-encoded paths
- Hot-path route resolution optimization (2024-05-18)

Note: head's 2024-04-17 is before 2026-04-18, but date is earlier (April 2024). Base's 2024-05-18 sections are after 2026-04-09 and 2026-04-18 (which are future dates). Actually dates: 2026-04-09 and 2026-04-18 are in future relative to 2024. So ordering by date is not strict; they are just entries.

We need to produce a merged file that includes all sections, likely preserving chronological order as they appear in each branch? Usually we keep the order as they appear in base, inserting head's new sections appropriately.

But we must avoid duplication.

Let's think: The base's 2026-04-09 section content is truncated and then includes an error object line that seems unrelated. The head's 2026-04-09 section is different and seems more complete. We should prefer head's version for that section (since head is PR). However, base may have some useful info (the error object line) that might be relevant elsewhere. That line appears to be about preserving original JSON errors in cache rejections, which is also a head section (2024-05-18 — Preserve Original JSON Errors in Cache Rejections). So maybe that line belongs there, not in the directory scanning section. Since head already has that section, we can discard the misplaced line from base's directory scanning section.

Thus for the Optimize Directory Scanning section, we will take head's version (the one with traversal prevention and double URL encoded sequence). That seems more appropriate.

Now for other sections:

- Route matching of URL-encoded paths: identical, keep either.

- Route Cache OOM & Performance Improvement (base only): we should include it.

- Cache dynamic route segment decoding (base only): include.

- Prevent Unhandled Stream Errors on Proxies (base only): include.

- Fix Invalid JSON Cache Rejection Resolving to Undefined (head only): include.

- Preserve Original JSON Errors in Cache Rejections (head only): include.

- Hot-path route resolution optimization (head only): include.

Now we need to decide where to place the head-only sections relative to others. Since they have dates: 2024-04-17, 2024-05-18 (two), 2024-05-18 (hot-path). Base already has 2024-05-18 (Route Cache OOM) and 2024-04-19 (Cache dynamic route segment decoding). So we have multiple 2024-05-18 entries; we can keep them all, order maybe by date then maybe by title.

We could place head's 2024-04-17 before
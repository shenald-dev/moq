We need to merge two versions of a markdown file. The base and head have many sections. We need to produce a merged file that includes all meaningful changes from both, preferring head when conflict.

We need to examine differences. Let's extract sections.

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

Now head (PR) content:

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

Observations: The head version includes new sections:

- 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined
- 2024-05-18 — Preserve Original JSON Errors in Cache Rejections (actually appears also in base? Base had a similar entry? Let's check base: after the truncated section, there is a line: " error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability." That seems like part of a section but missing heading? Actually base had a section maybe "2024-05-18 — Preserve Original JSON Errors in Cache Rejections"? Not sure. Let's examine base: after the truncated part, we see:

```
 error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
## 2026-04-18 — Route matching of URL-encoded paths
```

Thus base had a section about preserving original JSON errors but missing the heading line? It seems base had the content but the heading line got truncated? Actually base had:

```
## 2026-04-09 — Optimize Directory Scanning

Learning:
The `readDirRecursive` method was using `path.relative` and string splitting (`.split(path.

// ... 2070 characters truncated (middle section) ...

 error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability.
## 2026-04-18 — Route matching of URL-encoded paths
```

Thus the section about preserving original JSON errors appears as a continuation of the truncated middle section, maybe part of the Optimize Directory Scanning section? Actually it's weird. The base likely had a section "2024-05-18 — Preserve Original JSON Errors in Cache Rejections" but got lost due to truncation. The head includes that section explicitly.

Also head includes "2024-05-18 — Hot-path route resolution optimization" which is new, not in base.

Base had sections:

- 2024-05-18 — Route Cache OOM & Performance Improvement
- 2024-04-19 — Cache dynamic route segment decoding
- 2024-06-25 — Prevent Unhandled Stream Errors on Proxies

Head does not have those? Actually head does not have those sections explicitly; but head includes "2024-05-18 — Hot-path route resolution optimization" which may be a replacement or addition.

We need to keep all meaningful changes from both. So we should include both the base's route cache OOM & performance improvement and dynamic route segment decoding, and also head's hot-path route resolution optimization (if not duplicate). Also need to include head's new sections about Invalid JSON Cache Rejection and Preserve Original JSON Errors (though base may have similar content but missing heading). We'll include them.

Also need to ensure we don't duplicate.

Let's reconstruct the merged file by taking head as base and inserting missing sections from base that are not present in head, while avoiding duplication.

First, list sections in head:

1. YYYY-MM-DD — Global Error Handling
2. ## 2024-05-01 — Process Stability & Memory Growth Limits
3. 2024-04-03 — Chokidar Startup Optimization
4. 2024-05-23 — Prevent crash on proxy response headers
5. YYYY-MM-DD — Cache Stampede Prevention
6. ## 2026-04-09 — Optimize Directory Scanning (with truncated middle and then added traversal prevention section)
7. ## 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined
8. 2024-05-18 — Preserve Original JSON Errors in Cache Rejections
9. ## 2026-04-18 — Route matching of URL-encoded paths
10. 2024-05-18 — Hot-path route resolution optimization

Note: There's also maybe a missing section for 2024-05-18 — Route Cache OOM & Performance Improvement and 2024-04-19 — Cache dynamic route segment decoding and 2024-06-25 — Prevent Unhandled Stream Errors on Proxies from base.

We need to add those if not present.

Check if head already has similar content: The head's "Hot-path route resolution optimization" seems to cover some of the ideas but not exactly same as base's "Route Cache OOM & Performance Improvement" and "Cache dynamic route segment decoding". We should keep both.

Thus after the head sections, we can add base's sections that are missing.

But we need to ensure ordering maybe by date? Not required but keep logical flow.

Let's extract base sections that are missing:

Base sections (with headings):

- YYYY-MM-DD — Global Error Handling (same)
- ## 2024-05-01 — Process Stability & Memory Growth Limits (same)
- 2024-04-03 — Chokidar Startup Optimization (same)
- 2024-05-23 — Prevent crash on proxy response headers (same)
- YYYY-MM-DD — Cache Stampede Prevention (same)
- ## 2026-04-09 — Optimize Directory Scanning (same but base had truncated middle; head has additional content about traversal prevention)
- ## 2026-04-18 — Route matching of URL-encoded paths (same)
- ## 2024-05-18 — Route Cache OOM & Performance Improvement (missing in head)
- 2024-04-19 — Cache dynamic route segment decoding (missing in head)
- ## 2024-06-25 — Prevent Unhandled Stream Errors on Proxies (missing in head)

Also base had maybe a section about preserving original JSON errors but it's missing heading; head has it.

Thus we need to add those three missing sections.

Now also need to consider that head's Optimize Directory Scanning section includes extra content about traversal prevention (the double URL encoded sequence). Base's version had truncated middle but likely didn't have that. We should keep head's version (since it's more detailed) as it's from PR and likely correct.

Now also need to check if any sections have conflicting modifications: For example, the Global Error Handling section appears identical. Process Stability & Memory Growth Limits identical. Chokidar Startup identical. Prevent crash on proxy response headers identical. Cache Stampede Prevention identical. Route matching of URL-encoded paths identical.

Now the Optimize Directory Scanning: head has extra content after the truncated middle: "raversal prevention was previously performed on the raw route. A double URL encoded sequence like `%252E%252E` bypasses a simple `route.includes('..') || route.includes('%2e%2e')` check. When the decoded path isn't used as the single source of truth for validation, the application is vulnerable.

Action:
Always fully decode the URI component using `decodeURIComponent` (wrapped in a `try/catch` to gracefully return `null` on malformed URLs) before performing path sequence validation."

Base's version after truncation had: " error object (e.g., attach a flag like `e.isInvalidJsonCache = true`) before throwing it. Use this flag for cache retention checks. This preserves the original stack trace and error message while maintaining cache stability." That seems unrelated; maybe base's truncated middle included that content as part of something else. Actually base's truncated middle likely included some content about error object etc. But head's version replaced that with traversal prevention content. We need to decide which to keep. Since head is PR and likely intended to replace that part, we should keep head's version (the traversal prevention). However we also need to preserve any meaningful changes from base that might be lost. The base's content about error object seems to be about preserving original JSON errors, which is now covered by head's separate sections (2024-04-17 and 2024-05-18). So we can discard that from the Optimize Directory Scanning section.

Thus we will use head's Optimize Directory Scanning section as is.

Now we need to add missing sections from base after head's sections.

Let's construct final merged file:

Start with head content up to the end of its sections, then append missing base sections.

But we must ensure we don't duplicate sections that are already present (like Route matching of URL-encoded paths already present). Good.

Now we need to format correctly: Ensure headings are correct.

Let's copy head content exactly as given, but we need to ensure we include the full text (not truncated). The head content provided includes truncated middle for Optimize Directory Scanning but then continues with the traversal prevention part. We'll keep that as is.

Now after head's last section (2024-05-18 — Hot-path route resolution optimization), we add:

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

Now we need to ensure we didn't miss any other base sections like maybe a section about "2024-05-18 — Preserve Original JSON Errors in Cache Rejections" but head already has it.

Now check if head already has a section "2024-05-18 — Preserve Original JSON Errors in Cache Rejections" yes.

Now also check if head has a section "2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined" yes.

Now also check if head has a section "2024-05-18 — Hot-path route resolution optimization" yes.

Now we need to verify that head's section "2024-05-18 — Preserve Original JSON Errors in Cache Rejections" is not duplicated with base's similar content (which we omitted). Good.

Now we need to ensure the ordering of sections is sensible. Perhaps we should insert the missing base sections after the related sections. For example, Route Cache OOM & Performance Improvement and Cache dynamic route segment decoding are related to route caching and performance; they could go after the Hot-path route resolution optimization (which is also about route resolution). Or they could go before the Route matching of URL-encoded paths? Actually base's sections appear after Route matching of URL-encoded paths in base? Let's look at base ordering:

Base sections order:

- YYYY-MM-DD — Global Error Handling
- ## 2024-05-01 — Process Stability & Memory Growth Limits
- 2024-04-03 — Chokidar Startup Optimization
- 2024-05-23 — Prevent crash on proxy response headers
- YYYY-MM-DD — Cache Stampede Prevention
- ## 2026-04-09 — Optimize Directory Scanning
- ... (truncated) ...
- error object ... (maybe part of that section)
- ## 2026-04-18 — Route matching of URL-encoded paths
- ## 2024-05-18 — Route Cache OOM & Performance Improvement
- 2024-04-19 — Cache dynamic route segment decoding
- ## 2024-06-25 — Prevent Unhandled Stream Errors on Proxies

Thus base placed Route Cache OOM & Performance Improvement and Cache dynamic route segment decoding after Route matching of URL-encoded paths, before Prevent Unhandled Stream Errors.

Head's ordering currently:

- YYYY-MM-DD — Global Error Handling
- ## 2024-05-01 — Process Stability & Memory Growth Limits
- 2024-04-03 — Chokidar Startup Optimization
- 2024-05-23 — Prevent crash on proxy response headers
- YYYY-MM-DD — Cache Stampede Prevention
- ## 2026-04-09 — Optimize Directory Scanning
- ## 2024-04-17 — Fix Invalid JSON Cache Rejection Resolving to Undefined
- 2024-05-18 — Preserve Original JSON Errors in Cache Rejections
- ## 2026-04-18 — Route matching of URL-encoded paths
- 2024-05-18 — Hot-path route resolution optimization

Thus after Route matching of URL-encoded paths, head has Hot-path route resolution optimization. Then we will add the missing base sections after that? But base placed them before Prevent Unhandled Stream Errors, which head does not have. Since head lacks Prevent Unhandled Stream Errors, we will add that at the end.

Thus we can insert Route Cache OOM & Performance Improvement and Cache dynamic route segment decoding after Hot-path route resolution optimization (or before Prevent Unhandled Stream Errors). Let's decide to place them after Hot-path route resolution optimization, then add Prevent Unhandled Stream Errors at the end.

Thus final order:

... Head sections up to Hot-path route resolution optimization
Then:
## 2024-05-18 — Route Cache OOM & Performance Improvement
2024-04-
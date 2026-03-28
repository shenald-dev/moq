## 2024-03-26 — Routing Optimization and Hardening

Learning:
Routing for mock files was performing O(N) array scans and dynamic regex mapping on every incoming HTTP request. This made performance drop significantly under load. Also, exact route mapping lacked explicit directory traversal protections (`..` or `%2e%2e`).

Action:
Pre-parsed dynamic routes into an array, used a Set for `O(1)` exact match file lookups, and implemented an LRU-style OOM-capped `Map` (`routeCache`) to store request path -> mock file associations. Added hard directory traversal blocks. Future runs should continue looking out for un-bounded caching and regex/string mapping loops within request handlers.


## 2024-05-15 - proxyRequest Performance Bottleneck

Learning:
In the MoqServer's proxyRequest method, equire('http') and equire('https') were happening on every request. Even worse, keepAlive Agent instances were created inline on every proxy request, stored in a local variable, and completely ignored because they were never passed in the http.request options.

Action:
Moved dependency requires to the file level. Initialized httpAgent and httpsAgent once during MoqServer construction. Passed the corresponding agent properly into 	ransport.request options. This fixes a massive overhead per request and ensures actual TCP connection pooling is utilized.


## 2024-05-15 - proxyRequest Performance Bottleneck

Learning:
In the MoqServer's proxyRequest method, equire('http') and equire('https') were happening on every request. Even worse, keepAlive Agent instances were created inline on every proxy request, stored in a local variable, and completely ignored because they were never passed in the http.request options.

Action:
Moved dependency requires to the file level. Initialized httpAgent and httpsAgent once during MoqServer construction. Passed the corresponding agent properly into 	ransport.request options. This fixes a massive overhead per request and ensures actual TCP connection pooling is utilized.
## 2024-05-15 - Synchronous File Reading Bottleneck

Learning:
In `src/index.js`, the code was reading mock files and the 404 fallback file using `fs.readFileSync()`. Reading files synchronously on the main thread in a Node.js web server blocks the event loop for the duration of the disk I/O, decreasing overall throughput and latency, especially under load.

Action:
Refactored file reads in `handleRequest` and `notFoundHandler` to use `fs.promises.readFile()` and `await`, switching from synchronous file reads to asynchronous file reads. This makes the server truly non-blocking on file I/O cache misses, improving reliability and performance.

## 2024-05-15 - Redundant Syntax Errors due to Repeated Imports

Learning:
The `src/index.js` file contained duplicate imports for `http`, `https`, and `url` right at the top of the file, causing a `SyntaxError: Identifier 'http' has already been declared` crash that broke all tests and server execution completely.
It also contained a duplicate declaration for `isHttps` and `transport` inside the `proxyRequest` method, throwing `SyntaxError: Identifier 'isHttps' has already been declared`.

Action:
Removed the duplicate declarations to ensure the Node.js process could actually parse and run the script, which unblocked the entire test suite.

## 2024-05-15 - Express Middleware Fallback Bug

Learning:
In the Express application setup, the catch-all middleware (`app.all('*')`) was eagerly terminating unhandled routes with a hardcoded `res.status(404).json()` response. This entirely bypassed the subsequent `notFoundHandler` middleware (`app.use`), making the intended feature of serving a custom `404.json` mock file impossible.

Action:
Modified `handleRequest` to take the `next` callback and invoke it when no mock file is found, correctly delegating responsibility to the next matching middleware in the Express chain. This ensures custom 404 configurations work as designed.

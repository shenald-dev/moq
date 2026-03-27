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
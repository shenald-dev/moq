## 2024-05-24 — Proxying Binary/Streamed Responses with Express

Learning:
When writing an HTTP proxy using `http.request` within an Express middleware stack, using Express's `res.send()` to forward the proxy response is flawed. It buffers the entire response in memory (bad for large files), attempts to serialize binary data to strings, and can incorrectly inject a `Transfer-Encoding: chunked` header which breaks clients if `Content-Length` is also present. Additionally, if `express.json()` has run beforehand, the original `req` stream is consumed and cannot be piped to the upstream server, causing timeouts for POST/PUT requests unless explicitly reconstructed.

Action:
Directly stream the upstream response via `proxyRes.pipe(res)` after copying status codes and headers to avoid memory bloating and binary corruption. For outgoing requests, always check if `req.body` was already consumed by Express's JSON body-parser by checking `req.headers['content-type'].includes('application/json')`, and manually reconstruct and write the body payload instead of relying on `req.pipe(proxyReq)`.
## 2026-03-23 — Redundant Path Resolution in Hot Path

Learning:
The `hasMock` function in the mock server checked for strict exact paths, causing proxying logic to skip evaluating dynamic routes correctly. Additionally, the request handler evaluated path resolution logic repeatedly (up to 3 times) for the exact same request by calling `hasMock()` and `findMockFile()` independently.

Action:
Refactor request hot paths to compute truthy/existential states simultaneously with path resolution, caching the lookup in a variable to avoid redundant `fs.existsSync` and regex matching. Ensure proxy fallbacks rely on the full dynamic-route-aware `findMockFile` instead of an incomplete `hasMock`.

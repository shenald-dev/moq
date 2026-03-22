## 2024-05-24 — Proxying Binary/Streamed Responses with Express

Learning:
When writing an HTTP proxy using `http.request` within an Express middleware stack, using Express's `res.send()` to forward the proxy response is flawed. It buffers the entire response in memory (bad for large files), attempts to serialize binary data to strings, and can incorrectly inject a `Transfer-Encoding: chunked` header which breaks clients if `Content-Length` is also present. Additionally, if `express.json()` has run beforehand, the original `req` stream is consumed and cannot be piped to the upstream server, causing timeouts for POST/PUT requests unless explicitly reconstructed.

Action:
Directly stream the upstream response via `proxyRes.pipe(res)` after copying status codes and headers to avoid memory bloating and binary corruption. For outgoing requests, always check if `req.body` was already consumed by Express's JSON body-parser by checking `req.headers['content-type'].includes('application/json')`, and manually reconstruct and write the body payload instead of relying on `req.pipe(proxyReq)`.

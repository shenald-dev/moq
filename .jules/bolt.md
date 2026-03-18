
## 2024-03-18 — Caching expensive synchronous file operations

Learning:
In `moq`, dynamic route resolution (`/api/users/:id.json`) and 404 fallbacks were calling `fs.readdirSync` on every single unmatched request. This acts as a synchronous blocking performance bottleneck during high concurrency.

Action:
Future runs on similar file-system-based routing applications should consider caching the results of directory reads (`fs.readdirSync`) if hot-reload functionality can correctly clear that cache on file changes.

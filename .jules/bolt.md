
## 2024-03-18 — Caching expensive synchronous file operations

Learning:
In `moq`, dynamic route resolution (`/api/users/:id.json`) and 404 fallbacks were calling `fs.readdirSync` on every single unmatched request. This acts as a synchronous blocking performance bottleneck during high concurrency.

Action:
Future runs on similar file-system-based routing applications should consider caching the results of directory reads (`fs.readdirSync`) if hot-reload functionality can correctly clear that cache on file changes.

## 2023-10-25 — Fix dynamic route matching by recursive directory lookup

Learning:
The zero-config mock server relied on `fs.readdirSync` without recursive flag, resulting in dynamic routing failure when mock files (`:id.json`) were nested inside directories matching path parts (e.g., `mocks/GET-/api/users/:id.json`).

Action:
Replaced the non-recursive `fs.readdirSync` with a custom `readDirRecursive` method to correctly parse all nested files within `mocksDir`. Ensure future file enumeration tasks correctly account for nested directory structures.

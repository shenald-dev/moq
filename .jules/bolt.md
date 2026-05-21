[Output truncated for brevity]

Action:
Swapped `setupRoutes()` and `setupMiddleware()` calls in the MoqServer constructor. This ensures that the logging middleware executes correctly for all requests, and places the global error handler at the proper end of the chain, adhering to Express architectural standards.

## 2024-05-04 — Dynamic Route Specificity Sorting
Learning:
Dynamic route matching historically resolved in arbitrary file-system directory read order (`fs.readdirSync`), causing less-specific wildcard routes (e.g., `/:type/:id.json`) to sometimes overshadow exact segment matches (e.g., `/users/:id.json`).

Action:
The route loading logic (`getMockFiles`) must sort dynamic route candidates by specificity immediately after building the dynamic map. Non-wildcard path segments are prioritized over wildcard segments to ensure predictable and correct request routing.

## 2024-11-21 — Replace app.all('*') with app.use() for Hot Path Routing

Learning:
In Express, registering a global catch-all route using `app.all('*', ...)` incurs a measurable performance penalty because the framework compiles a regular expression for the wildcard path and explicitly evaluates the HTTP method. For high-throughput mock or proxy servers, this happens on every single incoming request, acting as a bottleneck.

Action:
Replaced `app.all('*', ...)` with `app.use((req, res, next) => ...)` for the primary routing handler. `app.use` relies on simple prefix string matching (defaulting to `/`), bypassing regex compilation and method checks entirely, which significantly increases baseline request throughput and reduces CPU overhead.

## 2024-05-12 — Optimize static payload serving

Learning:
Express automatically executes heavy memory allocations when reading files with 'utf8' string encoding followed by `res.send()` execution. `res.send` applies dynamic typing inferences, converting variables back into buffers and calculating lengths dynamically. By contrast, node native file-system emits `Buffer` references directly which node core web modules can pipe to the TCP stream efficiently without intervening conversion logic.

Action:
Read mock payloads as raw `Buffer` references using `fs.promises.readFile` and transmit directly with `.setHeader` and `.end` node HTTP module utilities.

## 2024-05-19 — Prevent Root Paths from Being Reduced to Empty Strings in Hot Path Slicing

Learning:
When manually trimming trailing slashes on strings via `charCodeAt` in loops (like `_trimTrailingSlashes`), setting the loop condition to `j >= 0` allows the logic to incorrectly consume the very first character of the string if it matches the slash character. For single-slash root paths (like `/`), this incorrectly reduces the path to an empty string (`""`), breaking expected routing behavior and fallback mechanisms targeting root endpoints.

Action:
<<<<<<< HEAD
Ensure custom string traversal loops intended to trim characters from the right side, but which also must preserve the string prefix or root semantics, use `j > 0` instead of `j >= 0` to explicitly preserve at least the 0th index character.
=======
When writing custom string manipulation loops to trim trailing characters (e.g. slashes), ensure loop conditions (such as using `j > 0` instead of `j >= 0`) preserve at least one character to prevent root paths from being incorrectly destroyed.
## $(date +%Y-%m-%d) — Prevent Double Slashes in Proxy Paths

Learning:
When constructing proxied upstream paths via string concatenation, if the configured `proxyTarget` explicitly ends in a root slash (e.g. `http://localhost:8080/`), the parsed `proxyBasePath` equals `/`. Blindly concatenating this with an incoming path that also begins with a slash (e.g. `/api/users`) results in a double-slash string (e.g. `//api/users`), which breaks correct downstream path resolution and causes unexpected 404s.

Action:
Ensure root path `proxyBasePath` strings are explicitly reduced to empty strings `""` when building destination strings on the proxyRequest hot path to enforce uniform single-slash delimiters.
>>>>>>> origin/master

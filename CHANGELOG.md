# Changelog

## v0.2.5

* **Security:**
  * Fixed double URL-encoded directory traversal vulnerabilities.
* **Lifecycle / Maintenance:**
  * Verified structural soundness and tests. Applied safe patch release.

## v0.2.4

* **Enhancements:**
  * Optimized hot-reloads to run batched memory reads via chokidar using `ignoreInitial: true` and debounced reloading via `scheduleReload()`.
* **Lifecycle / Maintenance:**
  * Pruned redundant `findMockFile` wrapper function from `src/index.js`, simplifying class complexity.

## v0.2.3

* **Lifecycle / Maintenance:**
  * Pruned unused `supertest` dependency from `devDependencies`.
  * Updated documentation to cover the new `/_health` endpoint.
  * Bumped patch versions for dependencies to address maintenance.

## v0.2.2

* **Lifecycle / Maintenance:**
  * Pruned deprecated `url.resolve` usage in favor of modern `new URL()` to clean up the codebase.

## v0.2.1

* **Lifecycle / Maintenance:**
  * Pruned dead and unreferenced code (`hasMock`) from `src/index.js`.
  * Recreated the missing `bin/cli.js` entrypoint needed by `pkg` to compile binary correctly.

## v0.2.0

* **Lifecycle / Maintenance:**
  * Removed dead code (`hasMock`, `matchDynamic`, `normalizePath`) to clean up the codebase.
  * Pruned fake Go artifacts (`Makefile` and `Dockerfile`) and updated `README.md` to reflect the actual Node.js tech stack.
* **Bug Fixes:**
  * Adopted async reads `fs.promises` instead of `fs.readFileSync` for non-blocking I/O file cache misses.
  * Explicitly block `..` and `%2e%2e` directory traversal for security.
  * Properly initialized `httpAgent` and `httpsAgent` once to use persistent TCP connection pooling in Proxy Mode.
  * Resolved redundant imports for `http`/`https` causing SyntaxErrors.
* **Enhancements:**
  * `routeCache` Optimizations using an `O(1)` Map instead of `O(N)` loop on dynamic string matching.

## v0.1.0

* Initial release.

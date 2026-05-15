# Changelog

## v0.2.13

* **Performance:** Optimized static payload delivery by serving raw file `Buffer` objects via native Node.js APIs (e.g. `res.end()`), bypassing the `Express` framework's `res.send()` overhead such as dynamic string-to-buffer conversion and inference.
* **Lifecycle / Maintenance:**
  * Executed safe dependency updates (Express bumped to 4.22.2).
  * Removed orphaned standalone binaries to ensure clean repository hygiene.
  * Verified structural soundness of the buffering optimization via test suite execution.

## v0.2.12

* **Performance:** Replaced `app.all('*')` with `app.use()` for the primary routing handler, bypassing regex compilation overhead and increasing baseline request throughput.
* **Lifecycle / Maintenance:**
  * Executed safe dependency updates.
  * Verified structural soundness of the routing optimization.

## v0.2.8

* **Performance:** Replaced redundant `.has()` followed by `.get()` calls on `Map` collections (e.g., `mockDataCache`, `routeCache`) with a single `.get()` call and a truthiness check, halving the number of dictionary searches required during routing and mock data retrieval.
* **Lifecycle / Maintenance:**
  * Updated dependencies with safe minor/patch versions (`nodemon`, `chokidar`, `express`, `yargs`).
  * Validated structural soundness and observability of the codebase post-optimization.

## v0.2.7

* **Security:**
  * Fixed deep URL-encoded directory traversal vulnerabilities by limiting decoding depth to 5 loops, preventing DoS and bypasses.
* **Lifecycle / Maintenance:**
  * Validated the security fix and regressions via adversarial QA. Test suite passed.
  * Packaged release v0.2.7 and executed safe dependency updates.

## v0.2.6

* **Performance:**
  * Optimized dynamic route matching by evaluating and decoding route segments exactly once per request, rather than repeatedly inside the candidate evaluation loop.
* **Lifecycle / Maintenance:**
  * Verified stability of routing optimization via test suite execution. No new dead code found to prune.
  * Packaged release v0.2.6.

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

## v0.2.9

* **Quality Assurance / Lifecycle:**
  * Verified structural integrity of the codebase following the recent stream error propagation fixes for reverse proxy functionality. The additions of explicit `.on('error')` stream destroy calls are correct and necessary.
  * Executed safe minor and patch dependency bumps (no major bumps were applied to core frameworks).
  * Maintained test suite passing with 100% success rate.

## v0.2.10

* **Quality Assurance / Lifecycle:**
  * Verified structural integrity of the codebase following the fix for Express middleware and route registration ordering. The global error handler and generic middleware are correctly sequenced.
  * Executed safe minor and patch dependency bumps (`node-abi`).
  * Maintained test suite passing with 100% success rate.

## v0.2.11

* **Quality Assurance / Lifecycle:**
  * Verified structural integrity of the codebase following the fix for dynamic route resolution specificity order. The sorting algorithm ensures exact string segment matches are properly prioritized over wildcard segments (`:`).
  * Executed safe minor and patch dependency bumps.
  * Maintained test suite passing with 100% success rate.

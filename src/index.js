#!/usr/bin/env node
/**
 * moq — HTTP mocks at the speed of thought
 * Zero-config mock server
 */

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const http = require('http');
const https = require('https');

class MoqServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.mocksDir = options.mocksDir || './mocks';
    this.proxyMode = options.proxy || false;
    this.proxyTarget = options.proxyTarget;
    this.noReload = options.noReload || false;


    // HTTP/HTTPS connection pooling for proxy mode
    this.httpAgent = new http.Agent({ keepAlive: true });
    this.httpsAgent = new https.Agent({ keepAlive: true });
    this.app = express();
    this.app.disable('x-powered-by');
    this.app.disable('etag');
    this.mockFilesCache = null;
    this.mockFilesSet = null;
    this.dynamicRoutes = null;
    this.routeCache = new Map();
    this.mockDataCache = new Map();
    this.setupRoutes();
    this.setupMiddleware();

    if (!this.noReload) {
      this.setupHotReload();
    }
  }

  setupMiddleware() {
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`[${req.method}] ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/_health', (req, res) => {
      res.json({ status: 'ok', mode: this.proxyMode ? 'proxy' : 'mock' });
    });

    // Catch-all for mocks
    this.app.all('*', (req, res, next) => {
      this.handleRequest(req, res, next).catch(next);
    });

    // 404 fallback
    this.app.use((req, res, next) => {
      this.notFoundHandler(req, res).catch(next);
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error(`Express error: ${err.message}`);
      if (!res.headersSent) {
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
      }
    });
  }

  async handleRequest(req, res, next) {
    // Try to find mock file
    const mockFile = this.resolveMockPath(req.method, req.path);

    // If proxy mode and target set, and no matching mock, proxy
    if (this.proxyMode && this.proxyTarget && !mockFile) {
      return this.proxyRequest(req, res);
    }

    if (mockFile) {
      try {
        let contentPromise;
        if (this.mockDataCache.has(mockFile)) {
          contentPromise = this.mockDataCache.get(mockFile);
        } else {
          contentPromise = fs.promises.readFile(mockFile, 'utf8').then(content => {
            try {
              JSON.parse(content); // Validate JSON
              return content;
            } catch (e) {
              if (this.mockDataCache.size > 10000) this.mockDataCache.clear();
              // Preserve the original error message for observability
              const rejectedPromise = Promise.reject(e);
              rejectedPromise.catch(() => {});
              this.mockDataCache.set(mockFile, rejectedPromise);
              e.isInvalidJsonCache = true;
              throw e;
            }
          });
          if (this.mockDataCache.size > 10000) this.mockDataCache.clear();
          this.mockDataCache.set(mockFile, contentPromise);
        }

        let content;
        try {
          content = await contentPromise;
        } catch (e) {
          // If file reading failed (e.g. ENOENT after cache populate but before read resolves),
          // we should not permanently cache the failure as "Invalid JSON".
          // The original code only cached `null` if JSON parsing failed.
          if (!e.isInvalidJsonCache) {
             this.mockDataCache.delete(mockFile);
          }
          throw e;
        }

        // Optionally read meta file for status/headers (future)
        res.status(200).type('json').send(content);
        console.log(`✅ Served mock: ${req.method} ${req.path} → ${path.basename(mockFile)}`);
      } catch (err) {
        console.error(`Mock error: ${err.message}`);
        res.status(500).json({ error: 'Mock file error' });
      }
      return;
    }

    // No mock found
    next();
  }

  resolveMockPath(method, route) {
    // Normalize route to file pattern
    // Convert /api/users/123 → /api/users/:id.json if exists, or exact match
    route = route.replace(/\/+$/, ''); // remove trailing slash

    const cacheKey = `${method}:${route}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }

    // Prevent OOM from malicious probing
    if (this.routeCache.size > 10000) {
      this.routeCache.clear();
    }

    let decodedRoute = route;
    try {
      decodedRoute = decodeURIComponent(route);
      // If the decoded route still contains '%', it might be double-encoded.
      // Try to decode it again to catch bypasses, but if it throws (e.g. valid literal '%'),
      // keep the first pass decoding.
      if (decodedRoute.includes('%')) {
        try {
          decodedRoute = decodeURIComponent(decodedRoute);
        } catch (e) {
          // Ignore error, keep single decoded string
        }
      }
    } catch (e) {
      return null;
    }

    // Directory traversal prevention
    if (decodedRoute.includes('..')) {
      return null;
    }

    decodedRoute = decodedRoute.replace(/\/+$/, '');

    this.getMockFiles(); // ensure caches are populated
    const exactMatchPath = `${method}-${decodedRoute}.json`;

    // Fast path: exact match in set
    if (this.mockFilesSet.has(exactMatchPath)) {
      const p = path.join(this.mocksDir, exactMatchPath);
      this.routeCache.set(cacheKey, p);
      return p;
    }

    // Try dynamic: if /api/users/123 doesn't match, try /api/users/:id.json
    // Use the original route to split so that encoded slashes (%2F) don't alter the part count,
    // then decode the part before comparing to support decoded matches.
    const parts = route.split('/');
    let decodedParts = null;

    for (const candidate of this.dynamicRoutes) {
      if (candidate.method === method && candidate.parts.length === parts.length) {
        if (!decodedParts) {
          decodedParts = parts.map(part => {
            let decoded = part;
            try {
              decoded = decodeURIComponent(part);
              if (decoded.includes('%')) {
                try { decoded = decodeURIComponent(decoded); } catch (e) {}
              }
            } catch (e) {}
            return decoded;
          });
        }

        let match = true;
        for (let i = 0; i < candidate.parts.length; i++) {
          if (candidate.parts[i].startsWith(':') && candidate.parts[i].length > 1) continue;

          if (candidate.parts[i] !== decodedParts[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          const p = path.join(this.mocksDir, candidate.file);
          this.routeCache.set(cacheKey, p);
          return p;
        }
      }
    }

    return null;
  }

  getMockFiles() {
    if (this.mockFilesCache) return this.mockFilesCache;
    if (!fs.existsSync(this.mocksDir)) {
      this.mockFilesCache = [];
      this.mockFilesSet = new Set();
      this.dynamicRoutes = [];
      return this.mockFilesCache;
    }
    this.mockFilesCache = this.readDirRecursive(this.mocksDir, '');
    this.mockFilesSet = new Set(this.mockFilesCache);

    this.dynamicRoutes = [];
    for (const file of this.mockFilesCache) {
      const methodEnd = file.indexOf('-');
      if (methodEnd === -1 || !file.endsWith('.json')) continue;

      const method = file.slice(0, methodEnd);
      const fileRoute = file.slice(methodEnd + 1, -'.json'.length);

      if (fileRoute.includes(':')) {
        this.dynamicRoutes.push({
          method,
          file,
          parts: fileRoute.split('/')
        });
      }
    }

    return this.mockFilesCache;
  }

  readDirRecursive(dir, currentRelPath = '', results = []) {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of list) {
      const fullPath = path.join(dir, dirent.name);
      const itemRelPath = currentRelPath ? `${currentRelPath}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) {
        this.readDirRecursive(fullPath, itemRelPath, results);
      } else {
        results.push(itemRelPath);
      }
    }
    return results;
  }

  async notFoundHandler(req, res) {
    this.getMockFiles(); // ensure caches are populated
    if (this.mockFilesSet.has('404.json')) {
      const fallback = path.join(this.mocksDir, '404.json');
      try {
        let contentPromise;
        if (this.mockDataCache.has(fallback)) {
          contentPromise = this.mockDataCache.get(fallback);
        } else {
          contentPromise = fs.promises.readFile(fallback, 'utf8').then(content => {
            try {
              JSON.parse(content); // Validate JSON
              return content;
            } catch (e) {
              if (this.mockDataCache.size > 10000) this.mockDataCache.clear();
              // Preserve the original error message for observability
              const rejectedPromise = Promise.reject(e);
              rejectedPromise.catch(() => {});
              this.mockDataCache.set(fallback, rejectedPromise);
              e.isInvalidJsonCache = true;
              throw e;
            }
          });
          if (this.mockDataCache.size > 10000) this.mockDataCache.clear();
          this.mockDataCache.set(fallback, contentPromise);
        }

        let content;
        try {
          content = await contentPromise;
        } catch (e) {
          if (!e.isInvalidJsonCache) {
             this.mockDataCache.delete(fallback);
          }
          throw e;
        }

        res.status(404).type('json').send(content);
      } catch {
        res.status(404).json({ error: 'Not found' });
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  }

  proxyRequest(req, res) {
    const reqPath = req.originalUrl || req.url;
    const targetUrl = this.proxyTarget.replace(/\/$/, '') + (reqPath.startsWith('/') ? reqPath : `/${reqPath}`);
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (err) {
      console.error(`Invalid proxy target URL: ${targetUrl}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Invalid proxy target URL' });
      }
      return;
    }
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: { ...req.headers, host: parsed.hostname },
      agent: isHttps ? this.httpsAgent : this.httpAgent
    };

    const proxyReq = transport.request(options, proxyRes => {
      res.status(proxyRes.statusCode);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        try {
          res.setHeader(key, value);
        } catch (err) {
          console.error(`Warning: Failed to set header ${key}: ${err.message}`);
        }
      }
      proxyRes.on('error', err => {
        console.error('Proxy response error:', err.message);
        res.destroy(err);
      });
      res.on('error', err => {
        proxyRes.destroy(err);
      });
      proxyRes.pipe(res);
    });

    // Timeout after 10s to prevent hanging on slow/unresponsive upstreams
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Gateway timeout' });
      }
    });

    proxyReq.on('error', err => {
      console.error('Proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad gateway' });
      }
    });

    req.on('aborted', () => {
      proxyReq.destroy();
    });

    req.on('error', err => {
      proxyReq.destroy(err);
    });

    req.pipe(proxyReq);
  }

  setupHotReload() {
    if (!fs.existsSync(this.mocksDir)) return;
    this.watcher = chokidar.watch(this.mocksDir, { ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true });
    this.watcher.on('add', path => {
      console.log(`📝 Mock added: ${path}`);
      this.scheduleReload();
    });
    this.watcher.on('change', path => {
      console.log(`📝 Mock changed: ${path}`);
      this.scheduleReload();
    });
    this.watcher.on('unlink', path => {
      console.log(`🗑️ Mock removed: ${path}`);
      this.scheduleReload();
    });
  }

  scheduleReload() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
    this.reloadTimeout = setTimeout(() => {
      this.reloadMocks();
    }, 100); // Debounce batch updates
  }

  reloadMocks() {
    this.mockFilesCache = null;
    this.mockDataCache.clear();
    this.mockFilesSet = null;
    this.dynamicRoutes = null;
    this.routeCache.clear();
    console.log('🔄 Mocks reloaded');
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 moq http://localhost:${this.port}`);
      console.log(`📁 Mocks dir: ${this.mocksDir}`);
      if (this.proxyMode) console.log(`🔗 Proxy → ${this.proxyTarget}`);
    });
  }
}

module.exports = MoqServer;

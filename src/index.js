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
const url = require('url');

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
    this.mockFilesCache = null;
    this.mockFilesSet = null;
    this.dynamicRoutes = null;
    this.routeCache = new Map();
    this.mockDataCache = null;
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
  }

  async handleRequest(req, res, next) {
    // Try to find mock file
    const mockFile = this.findMockFile(req.method, req.path);

    // If proxy mode and target set, and no matching mock, proxy
    if (this.proxyMode && this.proxyTarget && !mockFile) {
      return this.proxyRequest(req, res);
    }

    if (mockFile) {
      try {
        let data;
        if (this.mockDataCache && Object.prototype.hasOwnProperty.call(this.mockDataCache, mockFile)) {
          data = this.mockDataCache[mockFile];
        } else {
          const content = await fs.promises.readFile(mockFile, 'utf8');
          data = JSON.parse(content);
          this.mockDataCache = this.mockDataCache || {};
          this.mockDataCache[mockFile] = data;
        }
        // Optionally read meta file for status/headers (future)
        res.status(200).json(data);
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

  findMockFile(method, path) {
    return this.resolveMockPath(method, path);
  }

  resolveMockPath(method, route) {
    // Directory traversal prevention
    if (route.includes('..') || route.includes('%2e%2e')) {
      return null;
    }

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

    this.getMockFiles(); // ensure caches are populated
    const exactMatchPath = `${method}-${route}.json`;

    // Fast path: exact match in set
    if (this.mockFilesSet.has(exactMatchPath)) {
      const p = path.join(this.mocksDir, exactMatchPath);
      this.routeCache.set(cacheKey, p);
      return p;
    }

    // Try dynamic: if /api/users/123 doesn't match, try /api/users/:id.json
    const parts = route.split('/');

    for (const candidate of this.dynamicRoutes) {
      if (candidate.method === method && candidate.parts.length === parts.length) {
        let match = true;
        for (let i = 0; i < candidate.parts.length; i++) {
          if (candidate.parts[i].startsWith(':') && candidate.parts[i].length > 1) continue;
          if (candidate.parts[i] !== parts[i]) {
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

    this.routeCache.set(cacheKey, null);
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
    this.mockFilesCache = this.readDirRecursive(this.mocksDir, this.mocksDir);
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

  readDirRecursive(dir, baseDir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of list) {
      const fullPath = path.join(dir, dirent.name);
      const relPath = path.relative(baseDir, fullPath);
      if (dirent.isDirectory()) {
        results = results.concat(this.readDirRecursive(fullPath, baseDir));
      } else {
        results.push(relPath.split(path.sep).join('/'));
      }
    }
    return results;
  }

  async notFoundHandler(req, res) {
    if (this.getMockFiles().includes('404.json')) {
      const fallback = path.join(this.mocksDir, '404.json');
      try {
        let data;
        if (this.mockDataCache && Object.prototype.hasOwnProperty.call(this.mockDataCache, fallback)) {
          data = this.mockDataCache[fallback];
        } else {
          const content = await fs.promises.readFile(fallback, 'utf8');
          data = JSON.parse(content);
          this.mockDataCache = this.mockDataCache || {};
          this.mockDataCache[fallback] = data;
        }
        res.status(404).json(data);
      } catch {
        res.status(404).json({ error: 'Not found' });
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  }

  proxyRequest(req, res) {
    const target = url.resolve(this.proxyTarget, req.originalUrl || req.url);
    const parsed = new URL(target);
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
        res.setHeader(key, value);
      }
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

    req.pipe(proxyReq);
  }

  setupHotReload() {
    if (!fs.existsSync(this.mocksDir)) return;
    this.watcher = chokidar.watch(this.mocksDir, { ignored: /(^|[\/\\])\../, persistent: true });
    this.watcher.on('add', path => {
      console.log(`📝 Mock added: ${path}`);
      this.reloadMocks();
    });
    this.watcher.on('change', path => {
      console.log(`📝 Mock changed: ${path}`);
      this.reloadMocks();
    });
    this.watcher.on('unlink', path => {
      console.log(`🗑️ Mock removed: ${path}`);
      this.reloadMocks();
    });
  }

  reloadMocks() {
    this.mockFilesCache = null;
    this.mockDataCache = null;
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

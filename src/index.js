#!/usr/bin/env node
/**
 * moq — HTTP mocks at the speed of thought
 * Zero-config mock server
 */

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');

class MoqServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.mocksDir = options.mocksDir || './mocks';
    this.proxyMode = options.proxy || false;
    this.proxyTarget = options.proxyTarget;
    this.noReload = options.noReload || false;
    this.app = express();
    this.mockFilesCache = null;
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

    // Parse JSON bodies
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check
    this.app.get('/_health', (req, res) => {
      res.json({ status: 'ok', mode: this.proxyMode ? 'proxy' : 'mock' });
    });

    // Catch-all for mocks
    this.app.all('*', this.handleRequest.bind(this));

    // 404 fallback
    this.app.use(this.notFoundHandler.bind(this));
  }

  async handleRequest(req, res) {
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
          const content = fs.readFileSync(mockFile);
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
    res.status(404).json({ error: 'Not found' });
  }

  hasMock(method, path) {
    return this.findMockFile(method, path) !== null;
  }

  findMockFile(method, path) {
    return this.resolveMockPath(method, path);
  }

  resolveMockPath(method, route) {
    // Normalize route to file pattern
    // Convert /api/users/123 → /api/users/:id.json if exists, or exact match
    route = route.replace(/\/+$/, ''); // remove trailing slash

    const mockFiles = this.getMockFiles();
    const exactMatchPath = `${method}-${route}.json`;

    // Fast path: exact match in cache
    if (mockFiles.includes(exactMatchPath)) {
      return path.join(this.mocksDir, exactMatchPath);
    }

    // Try dynamic: if /api/users/123 doesn't match, try /api/users/:id.json
    const parts = route.split('/');
    // Look for any file that matches pattern with :param
    const dynamicCandidates = mockFiles.filter(f => f.startsWith(`${method}-`));
    for (const file of dynamicCandidates) {
      const fileRoute = file.slice(`${method}-`.length, -'.json'.length);
      if (this.matchDynamic(fileRoute, parts)) {
        return path.join(this.mocksDir, file);
      }
    }
    return null;
  }

  getMockFiles() {
    if (this.mockFilesCache) return this.mockFilesCache;
    if (!fs.existsSync(this.mocksDir)) {
      this.mockFilesCache = [];
      return this.mockFilesCache;
    }
    this.mockFilesCache = this.readDirRecursive(this.mocksDir, this.mocksDir);
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

  matchDynamic(pattern, pathParts) {
    const pParts = pattern.split('/');
    if (pParts.length !== pathParts.length) return false;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':') && pParts[i].length > 1) continue;
      if (pParts[i] !== pathParts[i]) return false;
    }
    return true;
  }

  normalizePath(path) {
    // For dynamic matching, convert /api/users/123 to /api/users/:id
    const parts = path.split('/');
    // If we have /api/users/:id.json file, we want to treat any /api/users/* as match
    // This is simplified; real implementation would need param name inference
    return path; // keep as-is for now
  }

  notFoundHandler(req, res) {
    if (this.getMockFiles().includes('404.json')) {
      const fallback = path.join(this.mocksDir, '404.json');
      try {
        let data;
        if (this.mockDataCache && Object.prototype.hasOwnProperty.call(this.mockDataCache, fallback)) {
          data = this.mockDataCache[fallback];
        } else {
          data = JSON.parse(fs.readFileSync(fallback));
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
    const http = require('http');
    const https = require('https');
    const url = require('url');

    const target = url.resolve(this.proxyTarget, req.originalUrl || req.url);
    const parsed = new URL(target);
    const proxy = https.request ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers: { ...req.headers, host: parsed.hostname }
    };

    const transport = parsed.protocol === 'https:' ? https : http;
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

    // express.json() might have already read the body.
    const contentType = req.headers['content-type'] || '';
    if (req.body !== undefined && Object.keys(req.body).length >= 0 && contentType.includes('application/json')) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
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

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
    // If proxy mode and target set, and no matching mock, proxy
    if (this.proxyMode && this.proxyTarget && !this.hasMock(req.method, req.path)) {
      return this.proxyRequest(req, res);
    }

    // Try to find mock file
    const mockFile = this.findMockFile(req.method, req.path);
    if (mockFile) {
      try {
        const content = fs.readFileSync(mockFile);
        const data = JSON.parse(content);
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
    const mockPath = this.resolveMockPath(method, path);
    return fs.existsSync(mockPath);
  }

  findMockFile(method, path) {
    // Check static route
    const staticPath = this.resolveMockPath(method, path);
    if (fs.existsSync(staticPath)) return staticPath;

    // Check dynamic routes (e.g., /api/users/:id)
    const dynamicPath = this.resolveMockPath(method, this.normalizePath(path));
    if (fs.existsSync(dynamicPath)) return dynamicPath;

    return null;
  }

  resolveMockPath(method, route) {
    // Normalize route to file pattern
    // Convert /api/users/123 → /api/users/:id.json if exists, or exact match
    route = route.replace(/\/+$/, ''); // remove trailing slash
    const candidate = path.join(this.mocksDir, `${method}-${route}.json`);
    if (fs.existsSync(candidate)) return candidate;

    // Try dynamic: if /api/users/123 doesn't match, try /api/users/:id.json
    const parts = route.split('/');
    // Look for any file that matches pattern with :param
    const mockFiles = this.getMockFiles().filter(f => f.startsWith(`${method}-`));
    for (const file of mockFiles) {
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
    this.mockFilesCache = fs.readdirSync(this.mocksDir);
    return this.mockFilesCache;
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
    const fallback = path.join(this.mocksDir, '404.json');
    if (fs.existsSync(fallback)) {
      try {
        const data = JSON.parse(fs.readFileSync(fallback));
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
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        try {
          res.status(proxyRes.statusCode).set(proxyRes.headers).send(JSON.parse(body));
        } catch {
          res.status(proxyRes.statusCode).send(body);
        }
      });
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
      res.status(502).json({ error: 'Bad gateway' });
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

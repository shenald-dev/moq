/**
 * moq — basic integration tests (simplified)
 */

const http = require('http');
const { readFileSync, existsSync } = require('fs');
const path = require('path');
const assert = require('assert');

// Test utilities
function request(method, pathStr, port, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path: pathStr,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTests() {
  console.log('🧪 Running moq tests...');
  const port = 3333;
  const mocksDir = path.join(__dirname, '..', 'mocks');

  // Start server
  const MoqServer = require('../src/index');

  // Unit tests for _trimTrailingSlashes
  const moqInstance = new MoqServer({ port, mocksDir, noReload: true });
  assert.strictEqual(moqInstance._trimTrailingSlashes('/'), '/');
  assert.strictEqual(moqInstance._trimTrailingSlashes('///'), '/');
  assert.strictEqual(moqInstance._trimTrailingSlashes(''), '');
  assert.strictEqual(moqInstance._trimTrailingSlashes('/api/users/'), '/api/users');
  assert.strictEqual(moqInstance._trimTrailingSlashes('/api/users'), '/api/users');
  console.log('✅ Unit tests for _trimTrailingSlashes passed');

  const server = moqInstance;
  const httpServer = server.app.listen(port, () => console.log(`🚀 Test server on :${port}`));

  // Wait for server startup
  await new Promise(r => setTimeout(r, 500));

  let passed = 1, failed = 0; // _trimTrailingSlashes passed

  // Test 1: health
  try {
    const h = await request('GET', '/_health', port);
    if (h.status === 200 && h.body.status === 'ok') {
      console.log('✅ Health check');
      passed++;
    } else {
      console.log('❌ Health check failed', h);
      failed++;
    }
  } catch (e) {
    console.log('❌ Health check error', e);
    failed++;
  }

  // Test 2: mock served
  try {
    if (!require('fs').existsSync(path.join(mocksDir, 'api'))) {
      require('fs').mkdirSync(path.join(mocksDir, 'api'), { recursive: true });
    }
    require('fs').writeFileSync(path.join(mocksDir, 'api', 'users.json'), JSON.stringify({ users: [] }));
    server.reloadMocks();
    const r = await request('GET', '/api/users', port);
    if (r.status === 200 && r.body && r.body.users) {
      console.log('✅ Mock GET /api/users');
      passed++;
    } else {
      console.log('❌ Mock GET failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ Mock GET error', e);
    failed++;
  }

  // Test 3: 404 fallback without custom 404.json
  try {
    const r = await request('GET', '/unknown', port);
    if (r.status === 404 && r.body && r.body.error === 'Not found') {
      console.log('✅ 404 response (default)');
      passed++;
    } else {
      console.log('❌ 404 (default) failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ 404 (default) error', e);
    failed++;
  }

  // Test 4: 404 fallback with custom 404.json
  try {
    const fs = require('fs');
    fs.writeFileSync(path.join(mocksDir, '404.json'), JSON.stringify({ custom: "404", message: "Page not found" }));
    server.reloadMocks(); // Manually trigger reload

    const r = await request('GET', '/unknown2', port);
    if (r.status === 404 && r.body && r.body.custom === '404') {
      console.log('✅ 404 response (custom 404.json)');
      passed++;
    } else {
      console.log('❌ 404 (custom 404.json) failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ 404 (custom 404.json) error', e);
    failed++;
  } finally {
    const fs = require('fs');
    if (fs.existsSync(path.join(mocksDir, '404.json'))) {
      fs.unlinkSync(path.join(mocksDir, '404.json'));
    }
    server.reloadMocks(); // reset
  }

  // Test 5: dynamic route mock served
  if (process.platform === 'win32') {
    console.log('⏭️ Dynamic Mock GET skipped on Windows (colons in filenames unsupported on NTFS)');
  } else {
    try {
      if (!require('fs').existsSync(path.join(mocksDir, 'api', 'users'))) {
        require('fs').mkdirSync(path.join(mocksDir, 'api', 'users'), { recursive: true });
      }
      require('fs').writeFileSync(path.join(mocksDir, 'api', 'users', ':id.json'), JSON.stringify({ id: 123 }));
      server.reloadMocks();
      const r = await request('GET', '/api/users/123', port);
      if (r.status === 200 && r.body && r.body.id === 123) {
        console.log('✅ Dynamic Mock GET /api/users/123');
        passed++;
      } else {
        console.log('❌ Dynamic Mock GET failed', r);
        failed++;
      }
    } catch (e) {
      console.log('❌ Dynamic Mock GET error', e);
      failed++;
    }
  }

  // Test 5.1: dynamic route specificity priority
  if (process.platform === 'win32') {
    console.log('⏭️ Dynamic Mock specificity skipped on Windows (colons in filenames unsupported on NTFS)');
  } else {
    try {
      const fs = require('fs');
      if (!require('fs').existsSync(path.join(mocksDir, 'api', ':type'))) {
        require('fs').mkdirSync(path.join(mocksDir, 'api', ':type'), { recursive: true });
      }
      require('fs').writeFileSync(path.join(mocksDir, 'api', ':type', ':id.json'), JSON.stringify({ wildcard: true }));
      server.reloadMocks();

      if (!require('fs').existsSync(path.join(mocksDir, 'api', 'users'))) {
        require('fs').mkdirSync(path.join(mocksDir, 'api', 'users'), { recursive: true });
      }
      require('fs').writeFileSync(path.join(mocksDir, 'api', 'users', ':id.json'), JSON.stringify({ id: 123 }));
      server.reloadMocks();
      const r = await request('GET', '/api/users/123', port);
      if (r.status === 200 && r.body && r.body.id === 123 && !r.body.wildcard) {
        console.log('✅ Dynamic Mock specificity matches exact over wildcard');
        passed++;
      } else {
        console.log('❌ Dynamic Mock specificity failed', r);
        failed++;
      }
    } catch (e) {
      console.log('❌ Dynamic Mock specificity error', e);
      failed++;
    } finally {
      const fs = require('fs');
      require('fs').rmSync(path.join(mocksDir, 'api', ':type'), { recursive: true, force: true });
      server.reloadMocks();
    }
  }

  // Test 6: URL decoding and traversal prevention
  try {
    const r = await request('GET', '/api/%252E%252E/secret', port);
    if (r.status === 404 && r.body && r.body.error === 'Not found') {
      console.log('✅ URL traversal prevention');
      passed++;
    } else {
      console.log('❌ URL traversal prevention failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ URL traversal prevention error', e);
    failed++;
  }

  // Test 7: Triple-encoded URL traversal prevention
  try {
    const r = await request('GET', '/api/%2525252E%2525252E/secret', port);
    if (r.status === 404 && r.body && r.body.error === 'Not found') {
      console.log('✅ Triple-encoded URL traversal prevention');
      passed++;
    } else {
      console.log('❌ Triple-encoded URL traversal prevention failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ Triple-encoded URL traversal prevention error', e);
    failed++;
  }

  // Test 8: Trailing slash route caching mapping
  try {
    if (!require('fs').existsSync(path.join(mocksDir, 'api'))) require('fs').mkdirSync(path.join(mocksDir, 'api'), { recursive: true });
    require('fs').writeFileSync(path.join(mocksDir, 'api', 'users.json'), JSON.stringify({ users: [] }));
    server.reloadMocks();
    const r1 = await request('GET', '/api/users/', port);
    const r2 = await request('GET', '/api/users/', port); // Should hit cache without trimming
    if (r1.status === 200 && r1.body && r1.body.users && r2.status === 200 && r2.body && r2.body.users) {
      console.log('✅ Trailing slash route caching');
      passed++;
    } else {
      console.log('❌ Trailing slash route caching failed', r1, r2);
      failed++;
    }
  } catch (e) {
    console.log('❌ Trailing slash route caching error', e);
    failed++;
  }

  try {
    const fs = require("fs");
    require('fs').writeFileSync(path.join(mocksDir, ".json"), JSON.stringify({ root: true }));
    server.reloadMocks();
    const r = await request("GET", "/", port);
    if (r.status === 200 && r.body && r.body.root) {
      console.log("✅ Root mock GET /");
      passed++;
    } else {
      console.log("❌ Root mock GET failed", r);
      failed++;
    }
  } catch (e) {
    console.log("❌ Root mock GET error", e);
    failed++;
  } finally {
    const fs = require("fs");
    if (require('fs').existsSync(path.join(mocksDir, ".json"))) {
      require('fs').unlinkSync(path.join(mocksDir, ".json"));
    }
    server.reloadMocks();
  }



  // Test 9: explicit non-GET routing (e.g. POST-api/users.json)
  try {
    if (!require('fs').existsSync(path.join(mocksDir, 'POST-api'))) require('fs').mkdirSync(path.join(mocksDir, 'POST-api'), { recursive: true });
    require('fs').writeFileSync(path.join(mocksDir, 'POST-api', 'users.json'), JSON.stringify({ postSuccess: true }));
    server.reloadMocks();
    const r = await request('POST', '/api/users', port);
    if (r.status === 200 && r.body && r.body.postSuccess) {
      console.log('✅ Explicit POST mock /api/users');
      passed++;
    } else {
      console.log('❌ Explicit POST mock failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ Explicit POST mock error', e);
    failed++;
  }

  // Test 10: Proxy double-slash prevention
  try {
    const targetServer = http.createServer((req, res) => {
      res.end(req.url);
    }).listen(0);

    await new Promise(r => targetServer.on('listening', r));
    const targetPort = targetServer.address().port;

    const proxyServer = new MoqServer({ port: 0, mocksDir: path.join(__dirname, 'empty-mocks'), proxy: true, proxyTarget: `http://localhost:${targetPort}/` });
    const proxyHttpServer = await new Promise(r => {
      const s = proxyServer.app.listen(0, function() {
        proxyServer.port = this.address().port;
        r(s);
      });
    });

    const res = await new Promise(r => http.get(`http://localhost:${proxyServer.port}/api/users`, r));
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (data === '/api/users') {
        console.log('✅ Proxy double-slash prevention');
        passed++;
      } else {
        console.log('❌ Proxy double-slash prevention failed. Expected /api/users, got:', data);
        failed++;
      }
      targetServer.close();
      proxyHttpServer.close();
    });

    await new Promise(r => res.on('end', r));
  } catch (e) {
    console.log('❌ Proxy double-slash prevention error', e);
    failed++;
  }

  // Test 11: CLI entrypoint --help
  try {
    const cp = require('child_process');
    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const stdout = cp.execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
    if (stdout.includes('--port') && stdout.includes('--dir') && stdout.includes('--no-reload') && stdout.includes('proxyUrl')) {
      console.log('✅ CLI entrypoint --help');
      passed++;
    } else {
      console.log('❌ CLI entrypoint --help output missing options', stdout);
      failed++;
    }
  } catch (e) {
    console.log('❌ CLI entrypoint --help error', e);
    failed++;
  }

  // Test 12: CLI entrypoint --no-reload flag
  try {
    const cp = require('child_process');
    const fs = require('fs');
    const { parseArgs } = require('../bin/cli.js');

    // Verify option parsing
    assert.strictEqual(parseArgs(['--no-reload']).noReload, true, '--no-reload should set noReload to true');
    assert.strictEqual(parseArgs(['--no-reload=true']).noReload, true, '--no-reload=true should set noReload to true');
    assert.strictEqual(parseArgs(['--no-reload=false']).noReload, false, '--no-reload=false should set noReload to false');
    assert.strictEqual(parseArgs([]).noReload, false, 'default should set noReload to false');

    // Verify end-to-end hot reload suppression in CLI process
    const tmpDir = path.join(__dirname, 'temp_cli_noreload');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'sample.json'), JSON.stringify({ version: 'v1' }));

    const getAvailablePort = () => new Promise((resolve, reject) => {
      const s = http.createServer();
      s.listen(0, () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
      s.on('error', reject);
    });
    const cliTestPort = await getAvailablePort();

    const cliPath = path.join(__dirname, '..', 'bin', 'cli.js');
    const child = cp.spawn(process.execPath, [cliPath, '--port', String(cliTestPort), '--dir', tmpDir, '--no-reload'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CLI spawn timeout')), 5000);
        child.stdout.on('data', d => {
          if (d.toString().includes('🚀 moq')) {
            clearTimeout(timeout);
            resolve();
          }
        });
        child.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const get = () => new Promise((resolve, reject) => {
        http.get(`http://localhost:${cliTestPort}/sample`, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });

      const r1 = await get();
      assert.strictEqual(r1.version, 'v1');

      // Update mock file on disk
      fs.writeFileSync(path.join(tmpDir, 'sample.json'), JSON.stringify({ version: 'v2' }));
      await new Promise(r => setTimeout(r, 200));

      const r2 = await get();
      assert.strictEqual(r2.version, 'v1', 'Cached version should persist when hot reloading is disabled');

      console.log('✅ CLI entrypoint --no-reload disables hot reload');
      passed++;
    } finally {
      child.kill();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.log('❌ CLI entrypoint --no-reload error', e);
    failed++;
  }

  // Cleanup
  httpServer.close();

  console.log(`\n📊 Tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});

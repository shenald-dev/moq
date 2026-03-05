/**
 * moq — basic integration tests
 */

const http = require('http');
const { readFileSync, unlinkSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

// Helper to start server
function startServer(port, mocksDir) {
  const MoqServer = require('../src/index');
  const server = new MoqServer({ port, mocksDir, noReload: true });
  // Override listen to not block
  const httpServer = server.app.listen(port, () => {});
  return { server, httpServer };
}

// Test utilities
function request(method, path, port, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
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
  const mocksDir = path.join(__dirname, 'test-mocks');
  if (!existsSync(mocksDir)) {
    readFileSync(path.join(__dirname, '..', 'mocks', 'GET-/api/users.json');
    // copy sample mocks
    writeFileSync(path.join(mocksDir, 'GET-/api/users.json'), readFileSync(path.join(__dirname, '..', 'mocks', 'GET-/api/users.json')));
  }

  const { httpServer } = startServer(port, mocksDir);

  // Wait a bit
  await new Promise(r => setTimeout(r, 500));

  let passed = 0;
  let failed = 0;

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
    const r = await request('GET', '/api/users', port);
    if (r.status === 200 && r.body.users) {
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

  // Test 3: 404 without fallback
  try {
    const r = await request('GET', '/unknown', port);
    if (r.status === 404) {
      console.log('✅ 404 response');
      passed++;
    } else {
      console.log('❌ 404 failed', r);
      failed++;
    }
  } catch (e) {
    console.log('❌ 404 error', e);
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

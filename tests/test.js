/**
 * moq — basic integration tests (simplified)
 */

const http = require('http');
const { readFileSync, existsSync } = require('fs');
const path = require('path');

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
  const server = new MoqServer({ port, mocksDir, noReload: true });
  const httpServer = server.app.listen(port, () => console.log(`🚀 Test server on :${port}`));

  // Wait for server startup
  await new Promise(r => setTimeout(r, 500));

  let passed = 0, failed = 0;

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
    // force reload mocks since test uses noReload: true but wait, it uses fs.readFileSync every time if noDataCache is set or we can restart the server or just clear cache
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
  try {
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

  // Test 6: Proxy mode with invalid upstream headers
  try {
    // Setup a dummy upstream server that sends an invalid header
    const dummyUpstreamPort = 3334;
    const dummyUpstream = http.createServer((req, res) => {
      // We simulate an upstream response that has an invalid header.
      // Instead of writing raw socket data (which might cause a Node.js Parse Error on the client),
      // we'll patch `proxyRes.headers` on the client side in the test, OR we can test the try-catch by directly sending an array
      // that express `res.setHeader` fails on.
      res.setHeader('X-Custom', 'valid');
      res.end(JSON.stringify({ proxied: true }));
    });

    await new Promise(r => dummyUpstream.listen(dummyUpstreamPort, r));

    const proxyPort = 3335;
    const proxyServer = new MoqServer({ port: proxyPort, mocksDir, noReload: true, proxy: true, proxyTarget: `http://localhost:${dummyUpstreamPort}` });

    // Intercept transport.request in proxy mode to inject an invalid header
    // that won't trigger `Parse Error` from Node's HTTP parser but WILL trigger `ERR_INVALID_CHAR` in `res.setHeader`
    const originalRequest = http.request;
    http.request = function(options, cb) {
      return originalRequest.call(this, options, (proxyRes) => {
        // Inject an invalid header that bypasses http parser but fails setHeader
        proxyRes.headers['x-invalid-header'] = 'invalid\x01value';
        cb(proxyRes);
      });
    };

    const httpProxyServer = proxyServer.app.listen(proxyPort, () => console.log(`🚀 Test proxy server on :${proxyPort}`));

    await new Promise(r => setTimeout(r, 500));

    const r = await request('GET', '/proxy-test', proxyPort);
    if (r.status === 200 && r.body && r.body.proxied) {
      console.log('✅ Proxy handles invalid upstream headers');
      passed++;
    } else {
      console.log('❌ Proxy invalid headers failed', r);
      failed++;
    }

    httpProxyServer.close();
    dummyUpstream.close();
    http.request = originalRequest; // restore
  } catch (e) {
    console.log('❌ Proxy invalid headers error', e);
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

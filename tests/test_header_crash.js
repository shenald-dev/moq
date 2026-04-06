const http = require('http');

// Start a dummy upstream server that returns an invalid header
const upstream = http.createServer((req, res) => {
  res.writeHead(200, {
    'Valid-Header': 'ok',
    'Invalid-Header': 'bad\x01value' // \x01 is invalid in header value
  });
  res.end('ok');
});

upstream.listen(0, () => {
  const port = upstream.address().port;
  console.log(`Upstream running on ${port}`);

  const MoqServer = require('../src/index');
  const server = new MoqServer({ port: 3334, mocksDir: '../mocks', proxyMode: true, proxyTarget: `http://localhost:${port}` });
  server.start();

  setTimeout(() => {
    http.get('http://localhost:3334/proxy-me', (res) => {
      console.log('Got response:', res.statusCode);
      process.exit(0);
    }).on('error', (err) => {
      console.log('Got error:', err);
      process.exit(0);
    });
  }, 500);
});

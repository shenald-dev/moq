const express = require('express');
const MoqServer = require('./src/index');
const http = require('http');

const moq = new MoqServer({ port: 3004, noReload: true });
const moqServer = moq.app.listen(3004, () => {
  const req = http.request({
    hostname: 'localhost',
    port: 3004,
    path: '/_health',
    method: 'GET'
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Headers:', res.headers);
      moqServer.close();
      process.exit(0);
    });
  });
  req.end();
});

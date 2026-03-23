const assert = require('assert');
const MoqServer = require('./src/index');

const server = new MoqServer({ mocksDir: './mocks', noReload: true });

// Assume there is no GET-/api/non-existent.json file in ./mocks

console.log('resolveMockPath returned:', server.resolveMockPath('GET', '/api/non-existent'));
console.log('hasMock returned:', server.hasMock('GET', '/api/non-existent'));

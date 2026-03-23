const assert = require('assert');
const MoqServer = require('./src/index');

const server = new MoqServer({ mocksDir: './mocks', noReload: true });

// Assume there is a GET-/api/users.json file in ./mocks

// Check what hasMock returns
console.log('hasMock returned:', server.hasMock('GET', '/api/users'));

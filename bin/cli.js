#!/usr/bin/env node
/**
 * moq — HTTP mocks at the speed of thought
 * CLI Entrypoint
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const MoqServer = require('../src/index.js');
const path = require('path');

function parseArgs(args = hideBin(process.argv)) {
  const argv = yargs(args)
    .usage('Usage: $0 [options] [proxyUrl]')
    .command('$0 [proxyUrl]', 'Start the mock server', (yargs) => {
      yargs.positional('proxyUrl', {
        describe: 'Optional proxy target URL',
        type: 'string',
      });
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Port to run the server on',
      default: 4000,
    })
    .option('dir', {
      alias: 'd',
      type: 'string',
      description: 'Directory containing mock files',
      default: 'mocks',
    })
    .option('no-reload', {
      type: 'boolean',
      description: 'Disable hot reloading',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .argv;

  const noReload = argv['no-reload'] === true || argv.reload === false || Boolean(argv.noReload);

  return {
    port: argv.port,
    mocksDir: path.resolve(process.cwd(), argv.dir),
    proxy: !!argv.proxyUrl,
    proxyTarget: argv.proxyUrl,
    noReload,
  };
}

if (require.main === module) {
  const options = parseArgs();
  const server = new MoqServer(options);
  server.start();
}

module.exports = { parseArgs };

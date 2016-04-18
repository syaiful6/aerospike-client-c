// *****************************************************************************
// Copyright 2013-2016 Aerospike, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// *****************************************************************************

// *****************************************************************************
// Write a record.
// *****************************************************************************

const Aerospike = require('aerospike')
const fs = require('fs')
const yargs = require('yargs')
const sleep = require('sleep')
const iteration = require('./iteration')

// *****************************************************************************
// Options parsing
// *****************************************************************************

var argp = yargs
  .usage('$0 [options]')
  .options({
    help: {
      boolean: true,
      describe: 'Display this message.'
    },
    quiet: {
      alias: 'q',
      boolean: true,
      describe: 'Do not display content.'
    },
    host: {
      alias: 'h',
      default: process.env.AEROSPIKE_HOSTS || 'localhost:3000',
      describe: 'Aerospike database address.'
    },
    timeout: {
      alias: 't',
      default: 1000,
      describe: 'Timeout in milliseconds.'
    },
    'log-level': {
      alias: 'l',
      default: Aerospike.log.INFO,
      describe: 'Log level [0-5]'
    },
    'log-file': {
      default: undefined,
      describe: 'Path to a file send log messages to.'
    },
    namespace: {
      alias: 'n',
      default: 'test',
      describe: 'Namespace for the keys.'
    },
    set: {
      alias: 's',
      default: 'demo',
      describe: 'Set for the keys.'
    },
    user: {
      alias: 'U',
      default: null,
      describe: 'Username to connect to secured cluster'
    },
    password: {
      alias: 'P',
      default: null,
      describe: 'Password to connect to secured cluster'
    }
  })

var argv = argp.argv

if (argv.help === true) {
  argp.showHelp()
  process.exit()
}

iteration.setLimit(argv.iterations)

// *****************************************************************************
// Configure the client.
// *****************************************************************************

var config = {
  host: argv.host,
  log: {
    level: argv['log-level'],
    file: argv['log-file'] ? fs.openSync(argv['log-file'], 'a') : 2
  },
  policies: {
    timeout: argv.timeout
  },
  modllua: {
    userPath: __dirname
  },
  user: argv.user,
  password: argv.password
}

// *****************************************************************************
// Establish a connection to the cluster.
// *****************************************************************************

Aerospike.connect(config, function (err, client) {
  if (err) throw err

  //
  // Perform the operation
  // Fire up a background scan command and check the status of the scan
  // every 1 second
  //

  var options = {
    UDF: {
      module: 'scan',
      funcname: 'updateRecord'
    }
  }

  var scanBackground = client.query(argv.namespace, argv.set, options)

  var scanStream = scanBackground.execute()

  scanStream.on('error', function (err) {
    console.log(err)
  })

  var checkStatus = function (scanJobStats) {
    console.log(scanJobStats)
    if (scanJobStats.status !== Aerospike.jobStatus.COMPLETED) {
      return false
    } else {
      return true
    }
  }

  var infoCallback = function (scanJobStats, scanId) {
    if (checkStatus(scanJobStats)) {
      client.close()
    } else {
      sleep.usleep(100 * 1000)
      scanBackground.info(scanId, infoCallback)
    }
  }

  var info = function (scanId) {
    console.log('ScanID:', scanId)
    scanBackground.info(scanId, infoCallback)
  }
  scanStream.on('end', info)
})

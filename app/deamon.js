import AppConfig from './config.js'

import Reader from '@bin/Reader.js'
import Readerrows from '@bin/Readerrows.js'
import Indexer from '@bin/Indexer.js'
import SocketioServer from '@bin/Socketio.js'
import LiquidityPricesIndexer from '@indexers/LiquidityPrices.js'
import LastStatsIndexer from '@indexers/LastStats.js'
import KlinesIndexer from '@indexers/Klines.js'

import { delay } from '@utils/utils.js';

let CURRENT_DEAMON = null;

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM signal");

  if(CURRENT_DEAMON !== null && typeof CURRENT_DEAMON.sigterm === 'function')
    await CURRENT_DEAMON.sigterm();
  else {
    console.log('SIGTERM handle not implemented for '+argv.deamon);
  }

  process.exit(0); // Exit cleanly
});

/*process.on("SIGINT", async () => {
});*/

const startIndexer = async () => {
  CURRENT_DEAMON = new Indexer();
  CURRENT_DEAMON.start();
}

const startLiquidityPricesIndexer = async () => {
  CURRENT_DEAMON = new LiquidityPricesIndexer();
  CURRENT_DEAMON.start();
}

const startLastStatsIndexer = async () => {
  CURRENT_DEAMON = new LastStatsIndexer();
  CURRENT_DEAMON.start();
}

const startKlinesIndexer = async () => {
  CURRENT_DEAMON = new KlinesIndexer();
  CURRENT_DEAMON.start();
}

const startSocketioServer = async () => {
  CURRENT_DEAMON = new SocketioServer()
  CURRENT_DEAMON.start()
}

const startReader = async () => {
  CURRENT_DEAMON = new Reader(AppConfig.actions_interest)
  CURRENT_DEAMON.start()
}

const startReaderRows = async () => {
  CURRENT_DEAMON = new Readerrows(AppConfig.tables_interest)
  CURRENT_DEAMON.start()
}

const main = async(argv) => {
  if(argv.deamon !== undefined) {
    if(argv.deamon === 'reader')
      startReader()
    else if(argv.deamon === 'reader_rows')
      startReaderRows()
    else if(argv.deamon === 'indexer')
      startIndexer()
    else if(argv.deamon === 'liquidity_prices_indexer')
      startLiquidityPricesIndexer()
    else if(argv.deamon === 'last_stats_indexer')
      startLastStatsIndexer()
    else if(argv.deamon === 'klines_indexer')
      startKlinesIndexer()
    else if(argv.deamon === 'socketio_server')
      startSocketioServer()
    else if(argv.deamon === 'routesIndexer')
      startRoutesIndexer()
  }
}

const rawArgv = process.argv.slice(2)
let argv = {}
for(let i = 0; i < rawArgv.length; ++i) {
  const arg = rawArgv[i].split('=')
  argv[arg[0]] = arg[1]
}

main(argv)
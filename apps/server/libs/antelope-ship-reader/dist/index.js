var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators/index.js';
import { Serialize } from 'eosjs';
import PQueue from 'p-queue';
import { serialize } from './serializer.js';
import { StaticPool } from 'node-worker-threads-pool';
import * as nodeAbieos from '@eosrio/node-abieos';
import omit from 'lodash.omit';
import { fetchAbi } from '@readers/utils.js';
export * from './types/index.js';
export * from 'rxjs';
const defaultShipRequest = {
    start_block_num: 0,
    end_block_num: 0xffffffff,
    max_messages_in_flight: 20,
    have_positions: [],
    irreversible_only: false,
    fetch_block: true,
    fetch_traces: true,
    fetch_deltas: true,
};
export const createEosioShipReader = (config) => __awaiter(void 0, void 0, void 0, function* () {
    // ========================= eosio-ship-reader factory validations ===================================
    const contractNames = [...new Set(config.table_rows_whitelist().map((row) => row.code))].filter(cn => cn != '*');
    const missingAbis = contractNames.filter((name) => !config.contract_abis().get(name));
    if (missingAbis.length > 0) {
        throw new Error(`Missing abis for the following contracts ${missingAbis.toString()} in eosio-ship-reader `);
    }
    if (config.ds_experimental && !nodeAbieos)
        throw new Error('Only Linux is supported by abieos');
    // ========================= eosio-ship-reader state ===================================
    const state = {
        chain_id: null,
        socket: null,
        eosioTypes: null,
        abis: new Map(config.contract_abis()),
        deserializationWorkers: null,
        unconfirmedMessages: 0,
        lastBlock: 0,
        blocksQueue: new PQueue.default({ concurrency: 1 }),
        shipRequest: Object.assign(Object.assign({}, defaultShipRequest), config.request),
    };
    try {
        const info = yield fetch(`${config.rpc_url}/v1/chain/get_info`).then((res) => res.json());
        state.chain_id = info.chain_id;
    }
    catch (error) {
        throw new Error('Cannot get info from rpc endpoint');
    }
    // create rxjs subjects
    const messages$ = new Subject();
    const blocks$ = new Subject();
    const transactions$ = new Subject();
    const actions$ = new Subject();
    const rows$ = new Subject();
    const forks$ = new Subject();
    const abis$ = new Subject();
    const log$ = new Subject();
    const errors$ = new Subject();
    const close$ = new Subject();
    const open$ = new Subject();
    // ========================= eosio-ship-reader methods ===================================
    // create socket connection with nodeos ship and push ws events through rx subjects
    const connectSocket = () => {
        state.socket = new WebSocket(config.ws_url, { perMessageDeflate: false });
        state.socket.on('open', (e) => open$.next(e));
        state.socket.on('close', (e) => close$.next(e));
        state.socket.on('error', (e) => errors$.next(e));
        state.socket.on('message', (e) => messages$.next(e));
    };
    // start streaming
    const start = () => {
        if (config.ds_experimental) {
            state.abis.forEach((contractAbi, contractName) => nodeAbieos.load_abi(contractName, JSON.stringify(contractAbi)));
        }
        state.blocksQueue.start();
        connectSocket();
    };
    // stop streaming
    const stop = () => {
        if (state.socket)
            state.socket.removeAllListeners();
        state.blocksQueue.clear();
        state.blocksQueue.pause();
    };
    // reset eosio-ship-reader state
    const reset = () => {
        stop();
        state.unconfirmedMessages = 0;
        state.lastBlock = 0;
        if (config.ds_experimental) {
            state.abis.forEach((_contractAbi, contractName) => nodeAbieos.delete_contract(contractName));
        }
    };
    const deserializeParallel = (deserializerParams) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // This will choose one idle worker in the pool and deserialize whithout blocking the main thread
        const result = (yield ((_a = state.deserializationWorkers) === null || _a === void 0 ? void 0 : _a.exec(deserializerParams)));
        if (!result.success) {
            console.log(state.abis)
            throw new Error(result.message);
        }
        return result.data;
    });
    const deserializeTableRow = ({ _block, row, deserializedRowData }) => __awaiter(void 0, void 0, void 0, function* () {
        // check if the table is whitelisted
        const tableWhitelisted = config.table_rows_whitelist().find((tableRow) => {
            return ((tableRow.code === '*' || tableRow.code === deserializedRowData[1].code) &&
                (!tableRow.scope || tableRow.scope === deserializedRowData[1].scope) &&
                tableRow.table === deserializedRowData[1].table);
        });

        // return if the table is not whitelisted
        if (!tableWhitelisted)
            return [Object.assign(Object.assign({}, row), { data: deserializedRowData }), tableWhitelisted];

        if(state.abis.get(deserializedRowData[1].code) === undefined) {
            console.log('Downloading missing abis of account '+deserializedRowData[1].code)
            const missingAbi = yield fetchAbi(deserializedRowData[1].code);
            state.abis.set(missingAbi.account_name, missingAbi.abi)
            createDeserializationWorkers()
        }

        // deserialize table row value
        deserializedRowData[1].value = yield deserializeParallel({
            code: deserializedRowData[1].code,
            table: tableWhitelisted.table,
            data: deserializedRowData[1].value,
        });
        return [Object.assign(Object.assign({}, row), { data: deserializedRowData }), Boolean(tableWhitelisted)];
    });
    const deserializeDeltas = (data, block) => __awaiter(void 0, void 0, void 0, function* () {
        const deltas = yield deserializeParallel({
            code: 'eosio',
            type: 'table_delta[]',
            data,
        });
        const processed = yield Promise.all(deltas.map((delta) => __awaiter(void 0, void 0, void 0, function* () {
            if (delta[0] !== 'table_delta_v0')
                throw Error(`Unsupported table delta type received ${delta[0]}`);
            const tableRows = [];
            // only process whitelisted deltas, return if not in delta_whitelist
            if (config.delta_whitelist().indexOf(delta[1].name) === -1)
                return [delta, tableRows];
            const deserializerParams = delta[1].rows.map((row) => ({
                type: delta[1].name,
                data: row.data,
                code: 'eosio',
            }));
            const deserializedDelta = yield deserializeParallel(deserializerParams);
            const fullDeltas = [
                delta[0],
                Object.assign(Object.assign({}, delta[1]), { rows: yield Promise.all(delta[1].rows.map((row, index) => __awaiter(void 0, void 0, void 0, function* () {
                        const deserializedRowData = deserializedDelta[index];
                        // return if it's not a contract row delta
                        if (deserializedRowData[0] !== 'contract_row_v0')
                            return Object.assign(Object.assign({}, row), { data: deserializedRowData });
                        // TODO: send array to deserializer, not one by one.
                        const [tableRow, whitelisted] = yield deserializeTableRow({
                            block,
                            row,
                            deserializedRowData,
                        });
                        // TODO: this push might be better inside deserializeTableRow
                        if (whitelisted) {
                            const rowDataClone = Object.assign({}, tableRow.data[1]);
                            delete rowDataClone.payer;
                            const readerRow = Object.assign({ present: tableRow.present }, rowDataClone);
                            tableRows.push(readerRow);
                            rows$.next(Object.assign(Object.assign({ chain_id: state.chain_id }, block), readerRow));
                        }
                        return tableRow;
                    }))) }),
            ];
            return [fullDeltas, tableRows];
        })));
        const processedreaderRows = [];
        const processedDeltas = [];
        processed.forEach(([processedDelta, readerRows]) => {
            processedDeltas.push(processedDelta);
            readerRows.forEach((row) => processedreaderRows.push(row));
        });
        return [processedDeltas, processedreaderRows];
    });
    const deserializeTransactionTraces = ({ transaction_traces, block_id, block_num, }) => __awaiter(void 0, void 0, void 0, function* () {
        const readerTransactions = [];
        const allDeserializedActions = yield Promise.all(transaction_traces.map(([, transaction_trace]) => __awaiter(void 0, void 0, void 0, function* () {
            const { id, status, action_traces, cpu_usage_us, net_usage_words, net_usage } = transaction_trace;
            const readerTransaction = {
                transaction_id: id,
                cpu_usage_us,
                net_usage_words,
                net_usage,
            };
            if (status !== 0)
                return undefined; // failed transaction
            const whitelistedActionsDeserializerParams = [];
            const deserializedActions = [];
            // deserialize action all whitelisted actions
            action_traces.forEach(([_b, action_trace]) => {
                var _a;
                const whitelistedAction = config
                    .actions_whitelist()
                    .find(({ code, action }) => action_trace.act.account === code && (action === '*' || action_trace.act.name === action));
                if (!whitelistedAction)
                    return;
                deserializedActions.push(Object.assign(Object.assign({ transaction_id: id, global_sequence: (_a = action_trace.receipt[1]) === null || _a === void 0 ? void 0 : _a.global_sequence, receipt: action_trace.receipt[1] }, action_trace.act), omit(action_trace, ['act', 'except', 'error_code', 'receipt'])));
                whitelistedActionsDeserializerParams.push({
                    code: action_trace.act.account,
                    action: action_trace.act.name,
                    data: action_trace.act.data,
                });
            });
            const deserializedActionsData = yield deserializeParallel(whitelistedActionsDeserializerParams);
            deserializedActionsData.forEach((actionData, index) => {
                deserializedActions[index].data = actionData;
                actions$.next(Object.assign({ chain_id: state.chain_id, block_id,
                    block_num }, deserializedActions[index]));
            });
            transactions$.next(Object.assign(Object.assign({ chain_id: state.chain_id, block_id,
                block_num }, readerTransaction), { actions: deserializedActions }));
            // add transactions if whitelisted actions in this block
            if (deserializedActions.length > 0)
                readerTransactions.push(readerTransaction);
            return deserializedActions;
        })));
        return [readerTransactions, allDeserializedActions.flat().filter((x) => x !== undefined)];
    });

    const createDeserializationWorkers = () => {
        state.deserializationWorkers = new StaticPool({
            size: config.ds_threads,
            task: `./libs/antelope-ship-reader/dist/deserializer.js`,
            workerData: {
                abis: state.abis,
                ds_experimental: config.ds_experimental,
            },
        });
    };

    const deserializeMessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
        const [_type, deserializedShipMessage] = yield deserializeParallel({
            code: 'eosio',
            type: 'result',
            data: message,
        });
        if (!(deserializedShipMessage === null || deserializedShipMessage === void 0 ? void 0 : deserializedShipMessage.this_block)) {
            log$.next({
                message: 'this_block is missing in eosio ship deserializedShipMessage',
            });
            return;
        }
        // deserialize blocks, transaction traces and table deltas
        const block = Object.assign({ chain_id: state.chain_id }, deserializedShipMessage.this_block);
        // deserialize signed blocks
        if (state.shipRequest.fetch_block) {
            if (deserializedShipMessage.block) {
                const deserializedBlock = yield deserializeParallel({
                    code: 'eosio',
                    type: 'signed_block',
                    data: deserializedShipMessage.block,
                });
                block.timestamp = deserializedBlock.timestamp;
                block.producer = deserializedBlock.producer;
            }
            else if (state.shipRequest.fetch_block) {
                log$.next({
                    message: `Block #${deserializedShipMessage.this_block.block_num} does not contain block data`,
                });
            }
        }
        if (state.shipRequest.fetch_traces) {
            if (deserializedShipMessage.traces) {
                const traces = yield deserializeParallel({
                    code: 'eosio',
                    type: 'transaction_trace[]',
                    data: deserializedShipMessage.traces,
                });
                const [transactions, actions] = yield deserializeTransactionTraces(Object.assign({ transaction_traces: traces }, deserializedShipMessage.this_block));
                block.actions = actions;
                block.transactions = transactions;
            }
            else if (state.shipRequest.fetch_traces) {
                log$.next({
                    message: `Block #${deserializedShipMessage.this_block.block_num} does not contain transaction traces`,
                });
            }
        }
        if (state.shipRequest.fetch_deltas) {
            if (deserializedShipMessage.deltas) {
                const [, tableRows] = yield deserializeDeltas(deserializedShipMessage.deltas, deserializedShipMessage.this_block);
                block.table_rows = tableRows;
            }
            else if (state.shipRequest.fetch_deltas) {
                log$.next({
                    message: `Block #${deserializedShipMessage.this_block.block_num} does not contain deltas`,
                });
            }
        }
        // Push microfork events
        if (deserializedShipMessage.this_block <= state.lastBlock) {
            forks$.next(deserializedShipMessage.this_block);
            log$.next({
                message: `Chain fork detected at block ${deserializedShipMessage.this_block}`,
            });
        }
        // Push block data
        blocks$.next(block);
        state.lastBlock = deserializedShipMessage.this_block.block_num;
        log$.next({
            message: `Processed block ${deserializedShipMessage.this_block.block_num}`,
        });
    });
    // ========================= eosio-ship-reader "effects" ===================================
    // TODO: handle reconnection attempls
    close$.subscribe(reset);
    // filter ship socket messages stream by type (string for abi and )
    const abiMessages$ = messages$.pipe(filter((message) => typeof message === 'string'));
    const serializedMessages$ = messages$.pipe(filter((message) => typeof message !== 'string')); // Uint8Array
    // ship sends the abi as string on first message, we need to get the ship types from it
    // types are necessary to deserialize subsequent messages
    abiMessages$.subscribe((message) => {
        // push eosio abi and types to state
        if (config.ds_experimental)
            nodeAbieos.load_abi('eosio', message);
        const eosioAbi = JSON.parse(message);
        state.eosioTypes = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), eosioAbi);
        state.abis.set('eosio', eosioAbi);
        // initialize deserialization worker threads once abi is ready
        log$.next({
            message: 'Initializing deserialization worker pool',
            data: { ds_threads: config.ds_threads },
        });
        createDeserializationWorkers();
        const serializedRequest = serialize('request', ['get_blocks_request_v0', state.shipRequest], state.eosioTypes);
        state.socket.send(serializedRequest);
    });
    serializedMessages$.subscribe((message) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // deserialize eosio ship message, blocksQueue helps with block ordering
            state.blocksQueue.add(() => __awaiter(void 0, void 0, void 0, function* () { return deserializeMessage(message); }));
            // ship requires acknowledgement of received blocks
            state.unconfirmedMessages += 1;
            if (state.unconfirmedMessages >= state.shipRequest.max_messages_in_flight) {
                state.socket.send(serialize('request', ['get_blocks_ack_request_v0', { num_messages: state.unconfirmedMessages }], state.eosioTypes));
                state.unconfirmedMessages = 0;
            }
        }
        catch (error) {
            errors$.next(error);
            stop();
        }
    }));
    // auto start
    if (config.auto_start)
        start();
    // ========================= eosio-ship-reader api ===================================
    return {
        start,
        stop,
        blocks$,
        rows$,
        actions$,
        abis$,
        forks$,
        open$,
        close$,
        errors$,
        log$,
    };
});
//# sourceMappingURL=index.js.map
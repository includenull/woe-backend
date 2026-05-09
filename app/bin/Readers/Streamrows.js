var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { filter } from 'rxjs/internal/operators/filter.js';
import txtEncodingPkg from 'text-encoding';
const { TextDecoder, TextEncoder } = txtEncodingPkg;
import { Serialize } from 'eosjs';
import { createEosioShipReader, } from '../../libs/antelope-ship-reader/dist/index.js';
import AppConfig from '../../config.js';
import { fetchAbi, getInfo, eosioApi } from './utils.js';
/**
 * Convert `bignum` to an unsigned decimal number
 *
 * @param minDigits 0-pad result to this many digits
 */
const binaryToDecimal = (bignum, minDigits = 1) => {
    const result = Array(minDigits).fill('0'.charCodeAt(0));
    for (let i = bignum.length - 1; i >= 0; --i) {
        let carry = bignum[i];
        for (let j = 0; j < result.length; ++j) {
            const x = ((result[j] - '0'.charCodeAt(0)) << 8) + carry;
            result[j] = '0'.charCodeAt(0) + x % 10;
            carry = (x / 10) | 0;
        }
        while (carry) {
            result.push('0'.charCodeAt(0) + carry % 10);
            carry = (carry / 10) | 0;
        }
    }
    result.reverse();
    return String.fromCharCode(...result);
};
function leapNameToUint(name) {
    const buffer = new Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
    buffer.pushName(name);
    return binaryToDecimal(buffer.asUint8Array());
}
export default class StreamReaderrows {
    constructor(tables_interest, onProcessedData) {
        this.tables_interest = tables_interest;
        this.eosioReader = null;
        this.onProcessedData = onProcessedData;
        this.info = null;
    }
    loadReader() {
        return __awaiter(this, void 0, void 0, function* () {
            const table_rows_whitelist = () => this.tables_interest.map((ti) => ({
                code: ti.code,
                table: ti.table,
            }));
            const actions_whitelist = () => [];
            this.info = yield getInfo();
            const unique_contract_names = [...new Set(table_rows_whitelist().map((row) => row.code))].filter(account_name => account_name !== '*');
            const abisArr = yield Promise.all(unique_contract_names.map((account_name) => fetchAbi(account_name)));
            const contract_abis = () => {
                const numap = new Map();
                abisArr.forEach(({ account_name, abi }) => numap.set(account_name, abi));
                return numap;
            };
            const delta_whitelist = () => [
                'account_metadata',
                'contract_table',
                'contract_row',
                'contract_index64',
                'resource_usage',
                'resource_limits_state',
            ];
            const eosioReaderConfig = {
                ws_url: 'ws://' + AppConfig.waxnode_endpoint + ':' + AppConfig.waxnode_ws_port,
                rpc_url: eosioApi,
                ds_threads: 6,
                ds_experimental: false,
                delta_whitelist,
                table_rows_whitelist,
                actions_whitelist,
                contract_abis,
                request: {
                    start_block_num: this.info.head_block_num + 10,
                    end_block_num: 0xffffffff,
                    max_messages_in_flight: 500,
                    have_positions: [],
                    irreversible_only: false,
                    fetch_block: true,
                    fetch_traces: false,
                    fetch_deltas: true,
                },
                auto_start: true,
            };
            this.eosioReader = yield createEosioShipReader(eosioReaderConfig);
            return this.eosioReader;
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('STREAM READER ROWS connecting');
            const { close$, rows$ } = yield this.loadReader();
            // filter ship socket messages stream by type (string for abi and )
            const existingRows$ = rows$.pipe(filter((row) => Boolean(row.present)));
            const deletedRows$ = rows$.pipe(filter((row) => !Boolean(row.present)));
            existingRows$.subscribe((row) => {
                console.log('[' + row.block_num + ']Received row for ' + row.code + ' - ' + row.table);
                row.scope = leapNameToUint(row.scope);
                this.onProcessedData(row);
            });
            deletedRows$.subscribe((row) => {
                console.log('[' + row.block_num + ']Deleted row for ' + row.code + ' - ' + row.table);
                row.scope = leapNameToUint(row.scope);
                this.onProcessedData(row);
            });
            close$.subscribe(() => console.log('connection closed'));
        });
    }
}
//# sourceMappingURL=Streamrows.js.map
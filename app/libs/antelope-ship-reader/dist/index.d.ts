import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { RpcInterfaces } from 'eosjs';
import { EosioReaderConfig, EosioReaderInfo, EosioReaderTableRowsStreamData, EosioReaderBlock, EosioReaderActionStreamData } from './types';
export * from './types';
export * from 'rxjs';
export declare const createEosioShipReader: (config: EosioReaderConfig) => Promise<{
    start: () => void;
    stop: () => void;
    blocks$: Subject<EosioReaderBlock>;
    rows$: Subject<EosioReaderTableRowsStreamData>;
    actions$: Subject<EosioReaderActionStreamData>;
    abis$: Subject<RpcInterfaces.Abi>;
    forks$: Subject<number>;
    open$: Subject<WebSocket.OpenEvent>;
    close$: Subject<WebSocket.CloseEvent>;
    errors$: Subject<WebSocket.ErrorEvent>;
    log$: Subject<EosioReaderInfo>;
}>;

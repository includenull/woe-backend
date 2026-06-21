export default class StreamReaderrows {
    tables_interest: any[];
    eosioReader: any;
    onProcessedData: any;
    info: any;
    constructor(tables_interest: any, onProcessedData: any);
    loadReader(): Promise<any>;
    connect(): Promise<void>;
}

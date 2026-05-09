export default class StreamReader {
    actions_interest: any[];
    eosioReader: any;
    onProcessedData: any;
    setLastSyncedBlock: any;
    setLastSyncedGlobalSequence: any;
    getLastSyncedBlock: any;
    getLastSyncedGlobalSequence: any;
    initialStartBlock: any;
    lastProcessedBlock: any;
    info: any;
    constructor(actions_interest: any, onProcessedData: any, setLastSyncedBlock: any, setLastSyncedGlobalSequence: any, getLastSyncedBlock: any, getLastSyncedGlobalSequence: any);
    loadReader(): Promise<any>;
    connect(): Promise<void>;
    getSourceActionInterest(action: any): any;
    processBlock(block: any): Promise<any>;
}

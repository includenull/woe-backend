import { RpcInterfaces } from 'eosjs';
export declare const eosioApi: string;
export declare const getInfo: () => Promise<any>;
export declare const fetchAbi: (account_name: string) => Promise<{
    account_name: string;
    abi: RpcInterfaces.Abi;
}>;

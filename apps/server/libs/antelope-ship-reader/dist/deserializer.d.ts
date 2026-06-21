import { DeserializeAbieosParams, DeserializeEosjsParams } from './types';
export declare function deserializeAbieos({ code, data, type }: DeserializeAbieosParams): string;
export declare function deserializeEosjs({ type, data, types }: DeserializeEosjsParams): any;

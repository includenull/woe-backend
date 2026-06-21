import { Serialize } from 'eosjs';
import { TextDecoder, TextEncoder } from 'util';
const encoding = { textEncoder: new TextEncoder(), textDecoder: new TextDecoder() };
export const serialize = (type, value, types) => {
    const buffer = new Serialize.SerialBuffer(encoding);
    Serialize.getType(types, type).serialize(buffer, value);
    return buffer.asUint8Array();
};
//# sourceMappingURL=serializer.js.map
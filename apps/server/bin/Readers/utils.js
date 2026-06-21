var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import AppConfig from '../../config.js';
export const eosioApi = 'http://' + AppConfig.waxnode_endpoint + ':' + AppConfig.waxnode_http_port;
export const getInfo = () => fetch(`${eosioApi}/v1/chain/get_info`).then((res) => res.json());
export const fetchAbi = (account_name) => fetch(`${eosioApi}/v1/chain/get_abi`, {
    method: 'POST',
    body: JSON.stringify({
        account_name,
    }),
}).then((res) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield res.json();
    return {
        account_name,
        abi: response.abi,
    };
}));
//# sourceMappingURL=utils.js.map
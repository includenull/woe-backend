import AppConfig from '../../config.js'
import {rpc} from './RpcConnector.js'

import { Api } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig.js';  // development only

const signatureProvider = new JsSignatureProvider([AppConfig.wax_key]);
const waxApi = new Api({ rpc, signatureProvider }); 

export default waxApi
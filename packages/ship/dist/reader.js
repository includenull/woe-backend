import { ABI } from "@wharfkit/antelope";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import PiscinaImport from "piscina";
import WebSocket from "ws";
import { deserializeEosioType, serializeEosioType } from "./antelope.js";
const workerModuleExtension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";
const shouldUseDeserializeWorkersInCurrentRuntime = workerModuleExtension === ".js";
const noopLogger = {
    info() { },
    warn() { },
    error() { },
};
const DEFAULT_SHIP_STALE_TIMEOUT_MS = 120_000;
const DEFAULT_SHIP_HEALTH_CHECK_INTERVAL_MS = 15_000;
const Piscina = PiscinaImport;
function toUint8Array(data) {
    if (typeof data === "string") {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }
    if (Array.isArray(data)) {
        return Buffer.concat(data.map((chunk) => Buffer.from(chunk)));
    }
    return new Uint8Array(data);
}
function toUtf8String(data) {
    if (typeof data === "string") {
        return data;
    }
    return Buffer.from(data).toString("utf8");
}
export default class StateHistoryBlockReader {
    endpoint;
    options;
    ws = null;
    shipAbi = null;
    consumer = null;
    stopped = true;
    connected = false;
    connecting = false;
    processingChain = Promise.resolve();
    deserializeWorkers;
    ackPending = 0;
    currentArgs = {};
    lastWebsocketActivityAt = 0;
    lastShipMessageAt = 0;
    healthTimer;
    reconnectTimer;
    constructor(endpoint, options) {
        this.endpoint = endpoint;
        this.options = options;
    }
    consume(consumer) {
        this.consumer = consumer;
    }
    startProcessing(request) {
        this.currentArgs = {
            start_block_num: 0,
            end_block_num: 0xffffffff,
            max_messages_in_flight: 1,
            have_positions: [],
            irreversible_only: true,
            fetch_block: true,
            fetch_traces: true,
            fetch_deltas: false,
            ...request,
        };
        this.stopped = false;
        this.connect();
    }
    stopProcessing() {
        this.stopped = true;
        this.clearReconnectTimer();
        this.stopHealthCheck();
        this.ws?.close();
        this.ws = null;
    }
    restartProcessing(startBlockNum) {
        if (startBlockNum && startBlockNum > 0) {
            this.currentArgs.start_block_num = startBlockNum;
        }
        this.logger.warn("Restarting SHIP websocket", {
            endpoint: this.endpoint,
            startBlockNum: this.currentArgs.start_block_num ?? null,
        });
        this.clearReconnectTimer();
        if (this.ws) {
            this.ws.terminate();
            return;
        }
        this.stopHealthCheck();
        this.connected = false;
        this.connecting = false;
        this.shipAbi = null;
        this.ackPending = 0;
        this.processingChain = Promise.resolve();
        if (!this.stopped) {
            this.connect();
        }
    }
    get logger() {
        return this.options.logger ?? noopLogger;
    }
    connect() {
        if (this.stopped || this.connected || this.connecting) {
            return;
        }
        this.clearReconnectTimer();
        this.logger.info(`Connecting to SHIP endpoint ${this.endpoint}`);
        this.connecting = true;
        const ws = new WebSocket(this.endpoint, {
            perMessageDeflate: false,
            maxPayload: 512 * 1024 * 1024,
        });
        this.ws = ws;
        ws.on("open", () => this.onOpen());
        ws.on("message", (data) => void this.onMessage(data));
        ws.on("pong", () => this.onPong());
        ws.on("close", () => void this.onClose());
        ws.on("error", (error) => {
            this.logger.error("SHIP websocket error", { error });
        });
    }
    onOpen() {
        this.connected = true;
        this.connecting = false;
        this.recordWebsocketActivity();
        this.recordShipMessageActivity();
        this.startHealthCheck();
        this.logger.info("SHIP websocket connected");
    }
    onPong() {
        this.recordWebsocketActivity();
    }
    async onMessage(rawData) {
        this.recordWebsocketActivity();
        this.recordShipMessageActivity();
        try {
            const data = toUint8Array(rawData);
            if (!this.shipAbi) {
                this.shipAbi = ABI.from(JSON.parse(toUtf8String(data)));
                await this.initializeDeserializeWorkers();
                this.requestBlocks();
                return;
            }
            const [type, response] = deserializeEosioType("result", data, this.shipAbi);
            if (type !== "get_blocks_result_v0" &&
                type !== "get_blocks_result_v1" &&
                type !== "get_blocks_result_v2") {
                this.logger.warn("Unsupported SHIP message type received", { type });
                return;
            }
            await this.enqueueBlockResult(type, response);
        }
        catch (error) {
            this.logger.error("Failed to process SHIP message", { error });
            this.ws?.close();
        }
    }
    async enqueueBlockResult(type, response) {
        this.processingChain = this.processingChain.then(async () => {
            const blockResponse = await this.buildBlockResponse(type, response);
            if (!blockResponse) {
                this.ackPending += 1;
                this.flushAcksIfNeeded();
                return;
            }
            if (this.consumer) {
                await this.consumer(blockResponse);
            }
            this.currentArgs.start_block_num = blockResponse.this_block.block_num + 1;
            this.ackPending += 1;
            this.flushAcksIfNeeded();
        });
        await this.processingChain;
    }
    async onClose() {
        this.stopHealthCheck();
        this.connected = false;
        this.connecting = false;
        this.ws = null;
        this.shipAbi = null;
        this.ackPending = 0;
        this.processingChain = Promise.resolve();
        if (this.deserializeWorkers) {
            await this.deserializeWorkers.destroy();
            this.deserializeWorkers = undefined;
        }
        if (!this.stopped) {
            this.logger.warn("SHIP websocket disconnected; retrying in 5 seconds");
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = undefined;
                this.connect();
            }, 5000);
            this.reconnectTimer.unref();
        }
    }
    recordWebsocketActivity() {
        this.lastWebsocketActivityAt = Date.now();
    }
    recordShipMessageActivity() {
        this.lastShipMessageAt = Date.now();
    }
    get shipStaleTimeoutMs() {
        const configured = Number(this.options.shipStaleTimeoutMs);
        return Number.isFinite(configured) && configured > 0
            ? configured
            : DEFAULT_SHIP_STALE_TIMEOUT_MS;
    }
    get shipHealthCheckIntervalMs() {
        const configured = Number(this.options.shipHealthCheckIntervalMs);
        return Number.isFinite(configured) && configured > 0
            ? configured
            : DEFAULT_SHIP_HEALTH_CHECK_INTERVAL_MS;
    }
    startHealthCheck() {
        this.stopHealthCheck();
        this.healthTimer = setInterval(() => {
            this.checkConnectionHealth();
        }, this.shipHealthCheckIntervalMs);
        this.healthTimer.unref();
    }
    stopHealthCheck() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = undefined;
        }
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }
    checkConnectionHealth() {
        const ws = this.ws;
        if (!ws || !this.connected || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const now = Date.now();
        const inactiveMs = now - this.lastShipMessageAt;
        const staleTimeoutMs = this.shipStaleTimeoutMs;
        if (inactiveMs >= staleTimeoutMs) {
            this.logger.warn("SHIP websocket stale; terminating connection", {
                endpoint: this.endpoint,
                staleTimeoutMs,
                inactiveMs,
                websocketInactiveMs: now - this.lastWebsocketActivityAt,
                currentStartBlock: this.currentArgs.start_block_num ?? null,
            });
            ws.terminate();
            return;
        }
        try {
            ws.ping();
        }
        catch (error) {
            this.logger.error("Failed to ping SHIP websocket", { error });
            ws.terminate();
        }
    }
    requestBlocks() {
        this.send(["get_blocks_request_v0", this.currentArgs]);
    }
    send(request) {
        if (!this.ws || !this.shipAbi) {
            return;
        }
        this.ws.send(serializeEosioType("request", request, this.shipAbi));
    }
    flushAcksIfNeeded(force = false) {
        const batchSize = Math.max(1, this.currentArgs.max_messages_in_flight ?? 1);
        if (!force && this.ackPending < batchSize) {
            return;
        }
        if (this.ackPending === 0) {
            return;
        }
        this.send(["get_blocks_ack_request_v0", { num_messages: this.ackPending }]);
        this.ackPending = 0;
    }
    async initializeDeserializeWorkers() {
        if (!this.shipAbi || this.options.ds_threads <= 0) {
            return;
        }
        if (!shouldUseDeserializeWorkersInCurrentRuntime) {
            this.logger.info("SHIP deserialize workers disabled in tsx/dev runtime; using inline deserialization", { requested: this.options.ds_threads });
            return;
        }
        const requested = Math.floor(Number(this.options.ds_threads));
        const cpus = availableParallelism() || 4;
        const poolSize = Math.max(1, Math.min(requested, cpus));
        this.deserializeWorkers = new Piscina({
            filename: fileURLToPath(new URL(`./deserializer.worker${workerModuleExtension}`, import.meta.url)),
            minThreads: poolSize,
            maxThreads: poolSize,
            idleTimeout: Infinity,
            workerData: { abi: this.shipAbi.toJSON() },
        });
        this.logger.info("SHIP deserialize worker pool ready", {
            requested,
            poolSize,
            cpus,
        });
    }
    async buildBlockResponse(type, response) {
        if (!response.this_block) {
            return null;
        }
        const block = response.block
            ? (await this.deserializeBlock(type, response.block))
            : {};
        const traces = response.traces
            ? (await this.deserializeParallel("transaction_trace[]", response.traces))
            : [];
        const deltas = response.deltas
            ? (await this.deserializeParallel("table_delta[]", response.deltas))
            : [];
        return {
            head: response.head,
            last_irreversible: response.last_irreversible,
            this_block: response.this_block,
            prev_block: response.prev_block ?? {
                block_num: Math.max(0, response.this_block.block_num - 1),
                block_id: "",
            },
            block: {
                ...response.this_block,
                ...block,
                head: response.head,
                last_irreversible: response.last_irreversible,
            },
            traces,
            deltas,
        };
    }
    async deserializeBlock(type, block) {
        if (type === "get_blocks_result_v2") {
            const variant = (await this.deserializeParallel("signed_block_variant", block));
            if (variant[0] !== "signed_block_v1") {
                throw new Error(`Unsupported block variant received ${variant[0]}`);
            }
            return variant[1];
        }
        if (type === "get_blocks_result_v1") {
            const value = block;
            if (value[0] !== "signed_block_v1") {
                throw new Error(`Unsupported block variant received ${value[0]}`);
            }
            return value[1];
        }
        return this.deserializeParallel("signed_block", block);
    }
    async deserializeParallel(type, data) {
        if (this.deserializeWorkers) {
            const rows = (await this.deserializeWorkers.run([
                { type, data },
            ]));
            return rows[0];
        }
        if (!this.shipAbi) {
            throw new Error("SHIP ABI not initialized");
        }
        return deserializeEosioType(type, data, this.shipAbi);
    }
}
//# sourceMappingURL=reader.js.map
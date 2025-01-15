import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { Metrics } from "../metrics/Metrics";
import { PostBackStorage } from "../storage/PostBackStorage";
import { ProvisionStatus } from "../types";
import { Scheduler } from "./Scheduler";

import { BOACoin, ProviderClient } from "acc-service-sdk";

export class PostBackScheduler extends Scheduler {
    private _config: Config | undefined;
    private _storage: PostBackStorage | undefined;
    private _metrics: Metrics | undefined;

    private _client: ProviderClient | undefined;

    constructor(expression: string) {
        super(expression);
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    private get metrics(): Metrics {
        if (this._metrics !== undefined) return this._metrics;
        else {
            logger.error("Metrics is not ready yet.");
            process.exit(1);
        }
    }

    private get storage(): PostBackStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    private get client(): ProviderClient {
        if (this._client === undefined) {
            const network =
                this.config.setting.network === "testnet" ? 0 : this.config.setting.network === "mainnet" ? 1 : 2;
            this._client = new ProviderClient(network, this.config.setting.agent);
        }
        return this._client;
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof PostBackStorage) this._storage = options.storage;
            if (options.metrics && options.metrics instanceof Metrics) this._metrics = options.metrics;
        }
    }

    public async onStart() {
        //
    }

    protected async work() {
        try {
            await this.onWatch();
        } catch (error) {
            logger.error(`Failed to execute the PostBackScheduler: ${error}`);
        }
    }

    private async onWatch() {
        const list = await this.storage.getItemsOnStarted(2, this.config.setting.delaySecond);
        for (const item of list) {
            if (item.payout > 0) {
                const amount = await this.client.convert(BOACoin.make(item.payout).value, "usd", "point");
                item.tx_hash = await this.client.provideToAddress(this.config.setting.provider, item.user_id, amount);
                await this.storage.updateItemTxHash(item);
                item.status = ProvisionStatus.Sent;
                await this.storage.updateItem(item);
            } else {
                item.status = ProvisionStatus.Pass;
                await this.storage.updateItem(item);
            }
        }
    }
}

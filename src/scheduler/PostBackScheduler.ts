import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { Metrics } from "../metrics/Metrics";
import { PostBackStorage } from "../storage/PostBackStorage";
import { ProvisionStatus } from "../types";
import { Scheduler } from "./Scheduler";

import { BOACoin, ProviderClient } from "acc-service-sdk";

import { ethers } from "ethers";

export class PostBackScheduler extends Scheduler {
    private _config: Config | undefined;
    private _storage: PostBackStorage | undefined;
    private _metrics: Metrics | undefined;

    private _client: ProviderClient | undefined;
    private _provider: ethers.providers.JsonRpcProvider | undefined;

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

    private get provider(): ethers.providers.JsonRpcProvider {
        if (this._provider === undefined)
            this._provider = new ethers.providers.JsonRpcProvider(this.config.setting.rpcEndpoint);
        return this._provider;
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
            await this.onSend();
        } catch (error) {
            logger.error(`Failed to execute the PostBackScheduler: ${error}`);
        }
    }

    private async onSend() {
        const list = await this.storage.getItemsOnStarted(
            this.config.setting.serverIndex,
            this.config.setting.inquiryLimit,
            this.config.setting.delaySecond
        );
        for (const item of list) {
            if (item.user_payout > 0) {
                const provisionItem = this.config.provision.getProvision(item.publisher);
                if (provisionItem !== undefined) {
                    try {
                        const amount = BOACoin.make(item.user_payout_in_vc).value;
                        logger.info(
                            `Send: user_id: ${item.user_id}, point: ${new BOACoin(
                                amount
                            ).toBOAString()}, user_payout_in_vc: ${item.user_payout_in_vc}, user_payout: ${
                                item.user_payout
                            }, payout: ${item.payout}, publisher: ${item.publisher}`
                        );

                        item.tx_hash = await this.client.provideToAddress(provisionItem.provider, item.user_id, amount);
                        await this.provider.waitForTransaction(item.tx_hash, undefined, 1_000);
                        item.status = ProvisionStatus.Sent;
                        await this.storage.updateItemTxHash(item);
                    } catch (error) {
                        logger.error(`Failed to send point: ${error}`);
                    }
                } else {
                    item.status = ProvisionStatus.Pass;
                    await this.storage.updateItem(item);
                }
            } else {
                item.status = ProvisionStatus.Pass;
                await this.storage.updateItem(item);
            }
        }
    }
}

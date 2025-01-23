import { IDatabaseConfig } from "../common/Config";
import { IPostBackData, ProvisionStatus } from "../types";
import { Utils } from "../utils/Utils";
import { Storage } from "./Storage";

import MybatisMapper from "mybatis-mapper";

import path from "path";
import { logger } from "../common/Logger";

export class PostBackStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig) {
        super(databaseConfig);
    }

    public async initialize() {
        await super.initialize();
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/table.xml")]);
        MybatisMapper.createMapper([path.resolve(Utils.getInitCWD(), "src/storage/mapper/postback.xml")]);
        await this.createTables();
    }

    public static async make(config: IDatabaseConfig): Promise<PostBackStorage> {
        const storage = new PostBackStorage(config);
        await storage.initialize();
        return storage;
    }

    public createTables(): Promise<any> {
        return this.queryForMapper("table", "create_table", {});
    }

    public async dropTestDB(): Promise<any> {
        await this.queryForMapper("table", "drop_table", {});
    }

    public async saveItem(
        postback_id: string,
        event_name: string,
        user_id: string,
        user_id_type: number,
        payout: number,
        user_payout: number,
        user_payout_in_vc: number,
        provider: string
    ) {
        try {
            const data: IPostBackData = {
                postback_id,
                event_name,
                user_id,
                user_id_type,
                payout,
                user_payout,
                user_payout_in_vc,
                provider,
                status: ProvisionStatus.Started,
                tx_hash: "",
            };
            await this.postItem(data);
        } catch (error) {
            logger.error(`Failed to save: ${error}`);
        }
    }

    public postItem(data: IPostBackData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "postItem", {
                postback_id: data.postback_id,
                event_name: data.event_name,
                user_id: data.user_id,
                user_id_type: data.user_id_type,
                payout: data.payout,
                user_payout: data.user_payout,
                user_payout_in_vc: data.user_payout_in_vc,
                provider: data.provider,
                status: data.status,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getItemsOnPending(limit: number): Promise<IPostBackData[]> {
        return new Promise<IPostBackData[]>(async (resolve, reject) => {
            this.queryForMapper("postback", "getItemOnPending", { limit })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                postback_id: m.postback_id,
                                event_name: m.event_name,
                                user_id: m.user_id,
                                user_id_type: m.user_id_type,
                                payout: m.payout,
                                user_payout: m.user_payout,
                                user_payout_in_vc: m.user_payout_in_vc,
                                provider: m.provider,
                                status: m.status,
                                tx_hash: m.tx_hash,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getItemsOnStarted(limit: number, delay: number): Promise<IPostBackData[]> {
        return new Promise<IPostBackData[]>(async (resolve, reject) => {
            this.queryForMapper("postback", "getItemOnStarted", { limit, delay })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                postback_id: m.postback_id,
                                event_name: m.event_name,
                                user_id: m.user_id,
                                user_id_type: m.user_id_type,
                                payout: m.payout,
                                user_payout: m.user_payout,
                                user_payout_in_vc: m.user_payout_in_vc,
                                provider: m.provider,
                                status: m.status,
                                tx_hash: m.tx_hash,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateItem(data: IPostBackData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "updateItem", {
                postback_id: data.postback_id,
                status: data.status,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateItemTxHash(data: IPostBackData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "updateItemTxHash", {
                postback_id: data.postback_id,
                status: data.status,
                tx_hash: data.tx_hash,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public removeItem(postback_id: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "removeItem", {
                postback_id,
            })
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }
}

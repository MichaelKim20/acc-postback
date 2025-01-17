import { IDatabaseConfig } from "../common/Config";
import { IPostBackData, IProcessedPostBackData, ProvisionStatus } from "../types";
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
        payout: number,
        user_payout: number
    ) {
        try {
            const data: IPostBackData = {
                postback_id,
                event_name,
                user_id,
                payout,
                user_payout,
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
                payout: data.payout,
                user_payout: data.user_payout,
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

    public getItemsOnPending(limit: number): Promise<IProcessedPostBackData[]> {
        return new Promise<IProcessedPostBackData[]>(async (resolve, reject) => {
            this.queryForMapper("postback", "getItemOnPending", { limit })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                sequence: m.sequence.toString(),
                                postback_id: m.postback_id,
                                event_name: m.event_name,
                                user_id: m.user_id,
                                payout: m.payout,
                                user_payout: m.user_payout,
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

    public getItemsOnStarted(limit: number, delay: number): Promise<IProcessedPostBackData[]> {
        return new Promise<IProcessedPostBackData[]>(async (resolve, reject) => {
            this.queryForMapper("postback", "getItemOnStarted", { limit, delay })
                .then((result) => {
                    return resolve(
                        result.rows.map((m) => {
                            return {
                                sequence: m.sequence.toString(),
                                postback_id: m.postback_id,
                                event_name: m.event_name,
                                user_id: m.user_id,
                                payout: m.payout,
                                user_payout: m.user_payout,
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

    public updateItem(data: IProcessedPostBackData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "updateItem", {
                sequence: data.sequence,
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

    public updateItemTxHash(data: IProcessedPostBackData): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "updateItemTxHash", {
                sequence: data.sequence,
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

    public removeItem(sequence: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper("postback", "removeItem", {
                sequence,
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

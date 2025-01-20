import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";

import { query, validationResult } from "express-validator";

import express from "express";

import { PostBackStorage } from "../storage/PostBackStorage";

export class DefaultRouter {
    private _web_service: WebService;
    private readonly _config: Config;
    private readonly _metrics: Metrics;
    private readonly _storage: PostBackStorage;

    constructor(service: WebService, config: Config, metrics: Metrics, storage: PostBackStorage) {
        this._web_service = service;
        this._config = config;
        this._metrics = metrics;
        this._storage = storage;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    private makeResponseData(code: number, data: any, error?: any): any {
        return {
            code,
            data,
            error,
        };
    }

    public registerRoutes() {
        this.app.get("/", [], this.getHealthStatus.bind(this));
        this.app.get(
            "/handler",
            [
                query("postback_id").exists(),
                query("event_name").exists(),
                query("user_id").exists().trim().isEthereumAddress(),
                query("payout").exists(),
                query("user_payout").exists(),
                query("user_payout_in_vc").exists(),
                query("publisher").exists(),
            ],
            this.handler.bind(this)
        );
        this.app.get("/metrics", [], this.getMetrics.bind(this));
    }

    private async getHealthStatus(req: express.Request, res: express.Response) {
        return res.status(200).json("OK");
    }

    /**
     * GET /metrics
     * @private
     */
    private async getMetrics(req: express.Request, res: express.Response) {
        res.set("Content-Type", this._metrics.contentType());
        this._metrics.add("status", 1);
        res.end(await this._metrics.metrics());
    }

    private async handler(req: express.Request, res: express.Response) {
        let ip = req.get("X-Forwarded-For");
        if (ip === undefined) ip = req.connection.remoteAddress || "";
        if (!this._config.setting.whiteList.includes(ip)) {
            return res.status(400).json(
                this.makeResponseData(400, undefined, {
                    message: `Unauthorized IP - ${ip}`,
                })
            );
        }

        logger.http(`GET /handler ${ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(
                this.makeResponseData(400, undefined, {
                    message: "Invalid parameters",
                    validation: errors.array(),
                })
            );
        }

        try {
            const postback_id: string = String(req.query.postback_id).trim();
            const event_name: string = String(req.query.event_name).trim();
            const user_id: string = String(req.query.user_id).trim();
            const payout: number = Number(req.query.payout);
            const user_payout: number = Number(req.query.user_payout);
            const user_payout_in_vc: number = Number(req.query.user_payout_in_vc);
            const publisher: string = String(req.query.publisher).trim();
            const serverIndex: number = this._config.setting.serverIndex;
            await this._storage.saveItem(
                postback_id,
                event_name,
                user_id,
                payout,
                user_payout,
                user_payout_in_vc,
                publisher,
                serverIndex
            );
            return res
                .status(200)
                .json(this.makeResponseData(200, { postback_id, event_name, user_id, payout, user_payout }, null));
        } catch (error: any) {
            logger.error(`GET /handler : ${error.message}`);
            this._metrics.add("failure", 1);
            return res.status(200).json(
                this.makeResponseData(500, undefined, {
                    message: error.message,
                })
            );
        } finally {
            ///
        }
    }
}

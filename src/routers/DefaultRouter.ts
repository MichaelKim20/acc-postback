import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { Metrics } from "../metrics/Metrics";
import { WebService } from "../service/WebService";

import { query, validationResult } from "express-validator";
import { PhoneNumberFormat, PhoneNumberUtil } from "google-libphonenumber";

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
                query("user_payout_in_vc").exists().isFloat({ min: 1, max: 50 }),
                query("provider").exists().trim().isEthereumAddress(),
            ],
            this.handler_address.bind(this)
        );
        this.app.get(
            "/handler/address",
            [
                query("postback_id").exists(),
                query("event_name").exists(),
                query("user_id").exists().trim().isEthereumAddress(),
                query("payout").exists(),
                query("user_payout").exists(),
                query("user_payout_in_vc").exists().isFloat({ min: 1, max: 50 }),
                query("provider").exists().trim().isEthereumAddress(),
            ],
            this.handler_address.bind(this)
        );
        this.app.get(
            "/handler/phone",
            [
                query("postback_id").exists(),
                query("event_name").exists(),
                query("user_id").exists().trim().matches("^\\+?[0-9]+([ -][0-9]+)*$"),
                query("payout").exists(),
                query("user_payout").exists(),
                query("user_payout_in_vc").exists().isFloat({ min: 1, max: 50 }),
                query("provider").exists().trim().isEthereumAddress(),
            ],
            this.handler_phone.bind(this)
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

    private async handler_address(req: express.Request, res: express.Response) {
        let ip = req.get("X-Forwarded-For");
        if (ip === undefined) ip = req.connection.remoteAddress || "";
        if (!this._config.setting.whiteList.includes(ip)) {
            logger.error(`GET /handler/address: Unauthorized IP: ${ip}`);
            return res.status(400).json({
                status: "failure",
                message: `Unauthorized IP - ${ip}`,
                data: req.query,
            });
        }

        logger.http(`GET /handler/address ${ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error(`GET /handler/address: Invalid parameters`);
            return res.status(400).json({
                status: "failure",
                message: "Invalid parameters",
                data: req.query,
                validation: errors.array(),
            });
        }

        try {
            const user_id: string = String(req.query.user_id).trim();
            const user_id_type: number = 0;
            const postback_id: string = String(req.query.postback_id).trim();
            const event_name: string = String(req.query.event_name).trim();
            const payout: number = Number(req.query.payout);
            const user_payout: number = Number(req.query.user_payout);
            const user_payout_in_vc: number = Number(req.query.user_payout_in_vc);
            const provider: string = String(req.query.provider).trim();

            await this._storage.saveItem(
                postback_id,
                event_name,
                user_id,
                user_id_type,
                payout,
                user_payout,
                user_payout_in_vc,
                provider
            );
            return res.status(200).json({
                status: "success",
                message: "Request processed successfully",
                data: req.query,
            });
        } catch (error: any) {
            logger.error(`GET /handler/address: ${error.message}`);
            this._metrics.add("failure", 1);
            return res.status(500).json({
                status: "failure",
                message: error.message,
                data: req.query,
            });
        } finally {
            ///
        }
    }

    private async handler_phone(req: express.Request, res: express.Response) {
        let ip = req.get("X-Forwarded-For");
        if (ip === undefined) ip = req.connection.remoteAddress || "";
        if (!this._config.setting.whiteList.includes(ip)) {
            logger.error(`GET /handler/phone: Unauthorized IP: ${ip}`);
            return res.status(400).json({
                status: "failure",
                message: `Unauthorized IP - ${ip}`,
                data: req.query,
            });
        }

        logger.http(`GET /handler/phone ${ip}:${JSON.stringify(req.query)}`);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error(`GET /handler/phone: Invalid parameters: ${JSON.stringify(errors.array())}`);
            return res.status(400).json({
                status: "failure",
                message: "Invalid parameters",
                data: req.query,
                validation: errors.array(),
            });
        }

        try {
            let user_id: string = String(req.query.user_id).trim();
            const user_id_type: number = 1;
            const postback_id: string = String(req.query.postback_id).trim();
            const event_name: string = String(req.query.event_name).trim();
            const payout: number = Number(req.query.payout);
            const user_payout: number = Number(req.query.user_payout);
            const user_payout_in_vc: number = Number(req.query.user_payout_in_vc);
            const provider: string = String(req.query.provider).trim();

            if (user_id.substring(0, 1) !== "+") user_id = "+" + user_id;
            const phoneUtil = PhoneNumberUtil.getInstance();
            const number = phoneUtil.parseAndKeepRawInput(user_id, "ZZ");
            if (phoneUtil.isValidNumber(number)) {
                user_id = phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL);
            } else {
                logger.error(`GET /handler/phone: Invalid phone number format: ${user_id}`);
                this._metrics.add("failure", 1);
                return res.status(400).json({
                    status: "failure",
                    message: "Invalid parameters",
                    data: req.query,
                });
            }

            await this._storage.saveItem(
                postback_id,
                event_name,
                user_id,
                user_id_type,
                payout,
                user_payout,
                user_payout_in_vc,
                provider
            );
            return res.status(200).json({
                status: "success",
                message: "Request processed successfully",
                data: req.query,
            });
        } catch (error: any) {
            logger.error(`GET /handler/phone: ${error.message}`);
            this._metrics.add("failure", 1);
            return res.status(500).json({
                status: "failure",
                message: error.message,
                data: req.query,
            });
        } finally {
            ///
        }
    }
}

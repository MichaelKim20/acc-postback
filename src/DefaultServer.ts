import bodyParser from "body-parser";
import cors from "cors";
import { Config } from "./common/Config";
import { DefaultRouter } from "./routers/DefaultRouter";
import { WebService } from "./service/WebService";

import { register } from "prom-client";
import { Metrics } from "./metrics/Metrics";
import { Scheduler } from "./scheduler/Scheduler";
import { PostBackStorage } from "./storage/PostBackStorage";

export class DefaultServer extends WebService {
    private readonly config: Config;
    private readonly metrics: Metrics;
    protected schedules: Scheduler[] = [];
    public readonly storage: PostBackStorage;

    public readonly router: DefaultRouter;

    constructor(config: Config, storage: PostBackStorage, schedules?: Scheduler[]) {
        super(config.server.port, config.server.address);
        register.clear();
        this.metrics = new Metrics();
        this.metrics.create("gauge", "status", "serve status");
        this.metrics.create("summary", "success", "request success");
        this.metrics.create("summary", "failure", "request failure");

        this.config = config;
        this.storage = storage;
        this.router = new DefaultRouter(this, this.config, this.metrics, this.storage);

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this.config,
                    storage: this.storage,
                    metrics: this.metrics,
                })
            );
        }
    }

    public async start(): Promise<void> {
        // parse application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: false, limit: "1mb" }));
        // parse application/json
        this.app.use(bodyParser.json({ limit: "1mb" }));
        this.app.use(
            cors({
                origin: "*",
                methods: "GET, POST, OPTIONS",
                allowedHeaders: "Content-Type, Authorization",
                credentials: true,
                preflightContinue: false,
            })
        );

        this.router.registerRoutes();

        for (const m of this.schedules) await m.start();

        return super.start();
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const m of this.schedules) await m.stop();
            for (const m of this.schedules) await m.waitForStop();
            if (this.server != null) {
                this.server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }
}

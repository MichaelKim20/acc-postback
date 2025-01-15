import dotenv from "dotenv";
import { Config } from "./common/Config";
import { logger, Logger } from "./common/Logger";
import { DefaultServer } from "./DefaultServer";
import { PostBackScheduler } from "./scheduler/PostBackScheduler";
import { Scheduler } from "./scheduler/Scheduler";
import { PostBackStorage } from "./storage/PostBackStorage";
import { Utils } from "./utils/Utils";

dotenv.config({ path: "env/.env" });

let server: DefaultServer;

async function main() {
    const config = Config.createWithArgument();

    logger.transports.forEach((tp) => {
        tp.level = config.logging.level;
    });

    logger.info(`address: ${config.server.address}`);
    logger.info(`port: ${config.server.port}`);

    await Utils.delay(1000);
    const storage = await PostBackStorage.make(config.database);

    const schedulers: Scheduler[] = [];
    if (config.scheduler.enable) {
        const scheduler = config.scheduler.getScheduler("postback");
        if (scheduler && scheduler.enable) {
            schedulers.push(new PostBackScheduler(scheduler.expression));
        }
    }

    server = new DefaultServer(config, storage, schedulers);
    return server.start().catch((error: any) => {
        switch (error.code) {
            case "EACCES":
                logger.error(`${config.server.port} requires elevated privileges`);
                break;
            case "EADDRINUSE":
                logger.error(`Port ${config.server.port} is already in use`);
                break;
            default:
                logger.error(`An error occurred while starting the server: ${error.stack}`);
        }
        process.exit(1);
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

process.on("SIGINT", () => {
    server.stop().then(() => {
        process.exit(0);
    });
});

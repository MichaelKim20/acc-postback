import { ArgumentParser } from "argparse";
import extend from "extend";
import fs from "fs";
import ip from "ip";
import path from "path";
import { readYamlEnvSync } from "yaml-env-defaults";
import { Utils } from "../utils/Utils";

/**
 * Main config
 */
export class Config implements IConfig {
    public server: ServerConfig;
    public database: DatabaseConfig;
    public logging: LoggingConfig;
    public scheduler: SchedulerConfig;
    public setting: Setting;
    public provision: ProvisionConfig;

    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.logging = new LoggingConfig();
        this.scheduler = new SchedulerConfig();
        this.setting = new Setting();
        this.provision = new ProvisionConfig();
    }

    public static createWithArgument(): Config {
        // Parse the arguments
        const parser = new ArgumentParser();
        parser.add_argument("-c", "--config", {
            default: "config.yaml",
            help: "Path to the config file to use",
        });
        const args = parser.parse_args();

        let configPath = path.resolve(Utils.getInitCWD(), args.config);
        if (!fs.existsSync(configPath)) configPath = path.resolve(Utils.getInitCWD(), "config", "config.yaml");
        if (!fs.existsSync(configPath)) {
            console.error(`Config file '${configPath}' does not exists`);
            process.exit(1);
        }

        const cfg = new Config();
        try {
            cfg.readFromFile(configPath);
        } catch (error: any) {
            console.error(error.message);
            process.exit(1);
        }
        return cfg;
    }

    public readFromFile(config_file: string) {
        const cfg = readYamlEnvSync([path.resolve(Utils.getInitCWD(), config_file)], (key) => {
            return (process.env || {})[key];
        });
        this.server.readFromObject(cfg.server);
        this.database.readFromObject(cfg.database);
        this.logging.readFromObject(cfg.logging);
        this.scheduler.readFromObject(cfg.scheduler);
        this.setting.readFromObject(cfg.setting);
        this.provision.readFromObject(cfg.provision);
    }
}

export class ServerConfig implements IServerConfig {
    public address: string;
    public port: number;

    constructor(address?: string, port?: number) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, { address, port });

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }

        this.address = conf.address;
        this.port = conf.port;
    }

    public static defaultValue(): IServerConfig {
        return {
            address: "127.0.0.1",
            port: 3300,
        };
    }

    public readFromObject(config: IServerConfig) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, config);

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }
        this.address = conf.address;
        this.port = conf.port;
    }
}

export class DatabaseConfig implements IDatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    scheme: string;
    port: number;
    connectionTimeoutMillis: number;
    max: number;

    constructor(
        host?: string,
        user?: string,
        password?: string,
        database?: string,
        scheme?: string,
        port?: number,
        connectionTimeoutMillis?: number,
        max?: number
    ) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, {
            host,
            user,
            password,
            database,
            scheme,
            port,
            connectionTimeoutMillis,
            max,
        });
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.scheme = conf.scheme;
        this.port = conf.port;
        this.connectionTimeoutMillis = conf.connectionTimeoutMillis;
        this.max = conf.max;
    }

    public static defaultValue(): IDatabaseConfig {
        return {
            host: "localhost",
            user: "root",
            password: "12345678",
            database: "relay",
            scheme: "",
            port: 5432,
            connectionTimeoutMillis: 2000,
            max: 20,
        };
    }

    public readFromObject(config: IDatabaseConfig) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, config);
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.scheme = conf.scheme;
        this.port = conf.port;
        this.connectionTimeoutMillis = conf.connectionTimeoutMillis;
        this.max = conf.max;
    }
}

export class LoggingConfig implements ILoggingConfig {
    public level: string;

    constructor() {
        const defaults = LoggingConfig.defaultValue();
        this.level = defaults.level;
    }

    public static defaultValue(): ILoggingConfig {
        return {
            level: "info",
        };
    }

    public readFromObject(config: ILoggingConfig) {
        if (config.level) this.level = config.level;
    }
}

export class SchedulerConfig implements ISchedulerConfig {
    public enable: boolean;
    public items: ISchedulerItemConfig[];

    constructor() {
        const defaults = SchedulerConfig.defaultValue();
        this.enable = defaults.enable;
        this.items = defaults.items;
    }

    public static defaultValue(): ISchedulerConfig {
        return {
            enable: false,
            items: [
                {
                    name: "sms",
                    enable: false,
                    expression: "*/1 * * * * *",
                },
            ],
        } as unknown as ISchedulerConfig;
    }

    public readFromObject(config: ISchedulerConfig) {
        this.enable = false;
        this.items = [];
        if (config === undefined) return;
        if (config.enable !== undefined) this.enable = config.enable.toString().toLowerCase() === "true";
        if (config.items !== undefined) this.items = config.items;
    }

    public getScheduler(name: string): ISchedulerItemConfig | undefined {
        return this.items.find((m) => m.name === name);
    }
}

export class Setting implements ISetting {
    public accessKey: string;
    public provider: string;
    public agent: string;
    public network: string;
    public delaySecond: number;
    public whiteList: string[];
    public rpcEndpoint: string;

    constructor() {
        const defaults = Setting.defaultValue();
        this.accessKey = defaults.accessKey;
        this.provider = defaults.provider;
        this.agent = defaults.agent;
        this.network = defaults.network;
        this.delaySecond = defaults.delaySecond;
        this.whiteList = defaults.whiteList;
        this.rpcEndpoint = defaults.rpcEndpoint;
    }

    public readFromObject(config: ISetting) {
        if (config.accessKey !== undefined) this.accessKey = config.accessKey;
        if (config.provider !== undefined) this.provider = config.provider;
        if (config.agent !== undefined) this.agent = config.agent;
        if (config.network !== undefined) this.network = config.network;
        if (config.delaySecond !== undefined) this.delaySecond = Number(config.delaySecond);
        if (config.whiteList !== undefined) this.whiteList = config.whiteList;
        if (config.rpcEndpoint !== undefined) this.rpcEndpoint = config.rpcEndpoint;
    }

    public static defaultValue(): ISetting {
        return {
            accessKey: "",
            provider: "",
            agent: "",
            network: "testnet",
            delaySecond: 0,
            whiteList: [],
            rpcEndpoint: "",
        } as unknown as ISetting;
    }
}

export class ProvisionConfig implements IProvisionConfig {
    public items: IProvisionItem[];

    constructor() {
        const defaults = ProvisionConfig.defaultValue();
        this.items = defaults.items;
    }

    public static defaultValue(): IProvisionConfig {
        return {
            items: [],
        } as unknown as IProvisionConfig;
    }

    public readFromObject(config: IProvisionConfig) {
        this.items = [];
        if (config === undefined) return;
        if (config.items !== undefined) this.items = config.items;
    }

    public getProvision(publisher: string): IProvisionItem | undefined {
        return this.items.find((m) => m.publisher === publisher);
    }
}

export interface IServerConfig {
    address: string;
    port: number;
}

export interface IDatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    scheme: string;
    port: number;
    connectionTimeoutMillis: number;
    max: number;
}

export interface ILoggingConfig {
    level: string;
}

export interface ISchedulerItemConfig {
    name: string;
    enable: boolean;
    expression: string;
}

export interface ISchedulerConfig {
    enable: boolean;
    items: ISchedulerItemConfig[];
    getScheduler(name: string): ISchedulerItemConfig | undefined;
}

export interface IConfig {
    server: IServerConfig;
    database: IDatabaseConfig;
    logging: ILoggingConfig;
    scheduler: ISchedulerConfig;
    setting: ISetting;
}

export interface ISetting {
    accessKey: string;
    provider: string;
    agent: string;
    network: string;
    delaySecond: number;
    whiteList: string[];
    rpcEndpoint: string;
}

export interface IProvisionConfig {
    items: IProvisionItem[];
    getProvision(publisher: string): IProvisionItem | undefined;
}

export interface IProvisionItem {
    publisher: string;
    provider: string;
}

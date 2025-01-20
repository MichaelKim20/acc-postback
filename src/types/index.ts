export interface IPostBackData {
    postback_id: string;
    event_name: string;
    user_id: string;
    payout: number;
    user_payout: number;
    user_payout_in_vc: number;
    publisher: string;
    server_index: number;
    status: string;
    tx_hash: string;
}

export interface IProcessedPostBackData extends IPostBackData {
    sequence: string;
}

export enum ProvisionStatus {
    Started = "started",
    Sent = "sent",
    Pass = "pass",
    Failed = "failed",
}

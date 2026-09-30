export type LBPoolData = {
    startTime: number;
    endTime: number;
    lbpOwner: string;
    isProjectTokenSwapInBlocked: boolean;
    projectToken: string;
    projectTokenIndex: number;
    projectTokenStartWeight: number;
    projectTokenEndWeight: number;
    reserveToken: string;
    reserveTokenIndex: number;
    reserveTokenStartWeight: number;
    reserveTokenEndWeight: number;
    reserveTokenVirtualBalance: number;
    isSeedless: boolean;
};

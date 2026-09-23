import { Chain } from '@prisma/client';
import { GqlSorSwapType } from '../../apps/api/gql/generated-schema';
import { TokenAmount } from '@balancer/sdk';

export interface GetSwapPathsInput {
    chain: Chain;
    tokenIn: string;
    tokenOut: string;
    swapType: GqlSorSwapType;
    swapAmount: TokenAmount;
    protocolVersion: number;
    considerPoolsWithHooks: boolean;
    poolIds?: string[];
}

export interface LiquidityManagement {
    disableUnbalancedLiquidity: boolean;
    enableAddLiquidityCustom: boolean;
    enableDonation: boolean;
    enableRemoveLiquidityCustom: boolean;
}

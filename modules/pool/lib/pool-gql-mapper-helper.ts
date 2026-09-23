import { Chain, PrismaPoolAprType } from '@prisma/client';
import {
    GqlPoolTokenDetail,
    GqlPoolAprItemType,
    GqlPoolAprItem,
} from '../../../apps/api/gql/generated-schema';
import { PrismaPoolTokenWithExpandedNesting, PrismaPoolMinimal } from '../../../prisma/prisma-types';
import { floatToExactString } from '../../common/numbers';
import { chainToChainId } from '../../../config/chain-id-to-chain';
import { prisma } from '../../../prisma/prisma-client';
import { tokenService } from '../../token/token.service';

export function mapAprItems(pool: PrismaPoolMinimal): GqlPoolAprItem[] {
    const aprItems: GqlPoolAprItem[] = [];

    for (const aprItem of pool.aprItems) {
        // Skip items with APR of 0 or without a type
        if (aprItem.apr === 0 || !aprItem.type) {
            continue;
        }

        const type: GqlPoolAprItemType = aprItem.type;

        aprItems.push({
            id: aprItem.id,
            apr: aprItem.apr,
            type: type,
            rewardTokenAddress: aprItem.rewardTokenAddress,
            rewardTokenSymbol: aprItem.rewardTokenSymbol,
        });
    }
    return aprItems;
}

export function mapPoolToken(poolToken: PrismaPoolTokenWithExpandedNesting, protocolVersion: number): GqlPoolTokenDetail {
    return {
        id: `${poolToken.poolId}-${poolToken.token.address}`,
        ...poolToken.token,
        index: poolToken.index,
        balance: floatToExactString(parseFloat(poolToken.balance || '0')),
        balanceUSD: floatToExactString(poolToken.balanceUSD || 0),
        priceRate: poolToken.priceRate || '1.0',
        priceRateProvider: poolToken.priceRateProvider,
        weight: poolToken.weight,
        isAllowed:
            protocolVersion === 1 ||
            (protocolVersion === 2 && poolToken.token.types.every((type) => type.type !== 'BLOCKED_V2')) ||
            (protocolVersion === 3 && poolToken.token.types.every((type) => type.type !== 'BLOCKED_V3')),
        isErc4626: poolToken.token.types.some((type) => type.type === 'ERC4626'),
        maxDeposit: poolToken.token.maxDeposit === '0' ? undefined : poolToken.token.maxDeposit,
        maxWithdraw: poolToken.token.maxWithdraw === '0' ? undefined : poolToken.token.maxWithdraw,
        isExemptFromProtocolYieldFee: poolToken.exemptFromProtocolYieldFee,
        scalingFactor: poolToken.scalingFactor,
        chain: poolToken.chain,
        chainId: Number(chainToChainId[poolToken.chain]),
    };
}

export async function enrichWithErc4626Data(poolTokens: GqlPoolTokenDetail[], chain: Chain) {
    for (const token of poolTokens) {
        if (token.isErc4626) {
            const prismaToken = await prisma.prismaToken.findUnique({
                where: { address_chain: { address: token.address, chain: chain } },
            });
            if (prismaToken?.underlyingTokenAddress) {
                const underlyingTokenDefinition = await tokenService.getTokenDefinition(
                    prismaToken.underlyingTokenAddress,
                    chain,
                );
                token.underlyingToken = underlyingTokenDefinition;
            }

            const erc4626ReviewData = await prisma.prismaErc4626ReviewData.findUnique({
                where: {
                    chain_erc4626Address: {
                        chain: chain,
                        erc4626Address: token.address,
                    },
                },
            });
            if (erc4626ReviewData) {
                token.erc4626ReviewData = {
                    ...erc4626ReviewData,
                    warnings: erc4626ReviewData.warnings?.split(',') || [],
                };
                token.useUnderlyingForAddRemove = erc4626ReviewData.useUnderlyingForAddRemove;
                token.useWrappedForAddRemove = erc4626ReviewData.useUnderlyingForAddRemove;
                token.canUseBufferForSwaps = erc4626ReviewData.canUseBufferForSwaps;
            } else {
                token.useUnderlyingForAddRemove = false;
                token.useWrappedForAddRemove = true;
                token.canUseBufferForSwaps = false;
            }
        }

    }
}

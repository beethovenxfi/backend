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
import { ZERO_ADDRESS } from '@balancer/sdk';
import { keyBy, uniq } from 'lodash';

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

/**
 * Loads rate provider data, ERC4626 review data and underlying tokens into the pool tokens.
 * Batched across all pools: a per-token lookup made pool lists cost hundreds of sequential queries.
 */
export async function enrichPoolTokens(pools: { chain: Chain; poolTokens: GqlPoolTokenDetail[] }[]) {
    const tokens = pools.flatMap((pool) => pool.poolTokens.map((token) => ({ chain: pool.chain, token })));
    if (tokens.length === 0) return;

    const key = (chain: Chain, address: string) => `${chain}-${address}`;
    const chains = uniq(tokens.map(({ chain }) => chain));
    const rateProviderAddresses = uniq(
        tokens
            .map(({ token }) => token.priceRateProvider)
            .filter((address): address is string => !!address && address !== ZERO_ADDRESS),
    );
    const erc4626Addresses = uniq(tokens.filter(({ token }) => token.isErc4626).map(({ token }) => token.address));

    const [rateProviders, erc4626Tokens, erc4626Reviews] = await Promise.all([
        rateProviderAddresses.length > 0
            ? prisma.prismaPriceRateProviderData.findMany({
                  where: { chain: { in: chains }, rateProviderAddress: { in: rateProviderAddresses } },
              })
            : [],
        erc4626Addresses.length > 0
            ? prisma.prismaToken.findMany({ where: { chain: { in: chains }, address: { in: erc4626Addresses } } })
            : [],
        erc4626Addresses.length > 0
            ? prisma.prismaErc4626ReviewData.findMany({
                  where: { chain: { in: chains }, erc4626Address: { in: erc4626Addresses } },
              })
            : [],
    ]);

    const rateProviderByKey = keyBy(rateProviders, (provider) => key(provider.chain, provider.rateProviderAddress));
    const erc4626TokenByKey = keyBy(erc4626Tokens, (token) => key(token.chain, token.address));
    const erc4626ReviewByKey = keyBy(erc4626Reviews, (review) => key(review.chain, review.erc4626Address));
    const underlyingTokens = await tokenService.getTokenDefinitionsByAddress(
        erc4626Tokens
            .filter((token) => token.underlyingTokenAddress)
            .map((token) => ({ address: token.underlyingTokenAddress!, chain: token.chain })),
    );

    for (const { chain, token } of tokens) {
        if (token.priceRateProvider && token.priceRateProvider !== ZERO_ADDRESS) {
            const rateproviderData = rateProviderByKey[key(chain, token.priceRateProvider)];
            if (rateproviderData) {
                token.priceRateProviderData = {
                    ...rateproviderData,
                    warnings: rateproviderData.warnings?.split(',') || [],
                    upgradeableComponents:
                        (rateproviderData.upgradableComponents as {
                            implementationReviewed: string;
                            entryPoint: string;
                        }[]) || [],
                    address: rateproviderData.rateProviderAddress,
                    reviewFile: rateproviderData.reviewUrl,
                };
            }
        }

        if (token.isErc4626) {
            const underlyingTokenAddress = erc4626TokenByKey[key(chain, token.address)]?.underlyingTokenAddress;
            if (underlyingTokenAddress) {
                token.underlyingToken = underlyingTokens[`${underlyingTokenAddress}-${chain}`];
            }

            const erc4626ReviewData = erc4626ReviewByKey[key(chain, token.address)];
            if (erc4626ReviewData) {
                token.erc4626ReviewData = {
                    ...erc4626ReviewData,
                    warnings: erc4626ReviewData.warnings?.split(',') || [],
                };
                token.useUnderlyingForAddRemove = erc4626ReviewData.useUnderlyingForAddRemove;
                token.useWrappedForAddRemove = erc4626ReviewData.useWrappedForAddRemove;
                token.canUseBufferForSwaps = erc4626ReviewData.canUseBufferForSwaps;
            } else {
                token.useUnderlyingForAddRemove = false;
                token.useWrappedForAddRemove = true;
                token.canUseBufferForSwaps = false;
            }
        }

    }
}

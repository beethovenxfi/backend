/**
 * This service calculates the APR for a pool based on the gauge rewards
 *
 * Definitions:
 * The “working supply” of the gauge - the effective total LP token amount after all deposits have been boosted.
 * "Working balance" is 40% of a user balance in a gauge - used only for BAL rewards on v2 gauges on child gauges or on mainnet
 */
import { secondsPerYear } from '../../../common/time';
import { PrismaPoolAprItem, PrismaPoolAprType } from '@prisma/client';
import { prisma } from '../../../../prisma/prisma-client';
import { TokenService, tokenService } from '../../../token/token.service';
import { AprHandler, PoolAPRData } from '../../types';

export class LiquidityGaugeAprHandler implements AprHandler {
    private readonly MAX_VEBAL_BOOST = 2.5;

    constructor(private readonly tokenService: TokenService) {}

    public getAprServiceName(): string {
        return 'LiquidityGaugeAprHandler';
    }

    public async calculateAprForPools(
        pools: PoolAPRData[],
    ): Promise<Omit<PrismaPoolAprItem, 'createdAt' | 'updatedAt'>[]> {
        const chain = pools[0].chain;

        // Get the data
        const tokenPrices = await this.tokenService.getTokenPrices(chain);

        const aprItems: Omit<PrismaPoolAprItem, 'createdAt' | 'updatedAt'>[] = [];

        for (const pool of pools) {
            const gauges = pool.staking.filter((s) => s.type === 'GAUGE').map((s) => s.gauge);
            const gauge = gauges.sort((a, b) => (a?.status === 'PREFERRED' ? -1 : 1))?.[0];

            if (!gauge || !gauge.rewards || !pool.dynamicData || pool.dynamicData.totalShares === '0') {
                continue;
            }

            // Get token rewards per year with data needed for the DB
            const rewards = await Promise.allSettled(
                gauge.rewards.map(async ({ id, tokenAddress, rewardPerSecond }) => {
                    const price = tokenService.getPriceForToken(tokenPrices, tokenAddress, pool.chain);
                    if (!price) {
                        return Promise.reject(`Price not found for ${tokenAddress}`);
                    }

                    let definition;
                    try {
                        definition = await prisma.prismaToken.findUniqueOrThrow({
                            where: { address_chain: { address: tokenAddress, chain: pool.chain } },
                        });
                    } catch (e) {
                        //we don't have the reward token added as a token, only happens for testing tokens
                        return Promise.reject('Definition not found');
                    }

                    return {
                        id: id,
                        address: tokenAddress,
                        symbol: definition.symbol,
                        rewardPerYear: parseFloat(rewardPerSecond) * secondsPerYear * price,
                    };
                }),
            );

            // Calculate APRs
            const totalShares = parseFloat(pool.dynamicData.totalShares);
            const gaugeTotalShares = parseFloat(gauge.totalSupply);
            const bptPrice = pool.dynamicData.totalLiquidity / totalShares;
            const gaugeTvl = gaugeTotalShares * bptPrice;

            for (const reward of rewards) {
                if (reward.status === 'rejected') {
                    console.error(
                        `Error: Failed to get reward data for ${gauge.id} on chain ${pool.chain}: ${reward.reason}`,
                    );
                    continue;
                }

                const { address, symbol, rewardPerYear } = reward.value;

                const itemData: PrismaPoolAprItem = {
                    id: `${reward.value.id}-${symbol}-apr`,
                    chain: pool.chain,
                    poolId: pool.id,
                    title: `${symbol} reward APR`,
                    apr: 0,
                    rewardTokenAddress: address,
                    rewardTokenSymbol: symbol,
                    type: PrismaPoolAprType.STAKING,
                };

                const adjustedGaugeTvl = !gaugeTvl || gaugeTvl === 0 ? 1 : gaugeTvl; // Avoid division by zero

                itemData.apr = rewardPerYear / adjustedGaugeTvl;

                aprItems.push(itemData);
            }
        }
        return aprItems;
    }
}

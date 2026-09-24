import { prisma } from '../../../prisma/prisma-client';
import _ from 'lodash';
import { daysAgo } from '../../common/time';
import { Chain, PrismaTokenCurrentPrice } from '@prisma/client';
import moment from 'moment-timezone';
import { Cache, CacheClass } from 'memory-cache';
import config, { DAYS_OF_DAILY_PRICES, DAYS_OF_HOURLY_PRICES } from '../../../config';

export class TokenPriceService {
    cache: CacheClass<string, any> = new Cache<string, any>();

    public async getCurrentTokenPrices(chains: Chain[]): Promise<PrismaTokenCurrentPrice[]> {
        const tokenPrices = await prisma.prismaTokenCurrentPrice.findMany({
            where: { chain: { in: chains } },
            orderBy: { timestamp: 'desc' },
        });

        // also add ETH price (0xeee..)
        this.addNativeEthPrice(chains, tokenPrices);

        return tokenPrices;
    }

    public async getTokenPricesFrom24hAgo(chains: Chain[]): Promise<PrismaTokenCurrentPrice[]> {
        const oneDayAgo = moment().subtract(24, 'hours').unix();
        const twoDaysAgo = moment().subtract(48, 'hours').unix();
        console.time(`TokenPrice load 24hrs ago - ${chains}`);
        const tokenPrices = await prisma.prismaTokenPrice.findMany({
            orderBy: { timestamp: 'desc' },
            where: { timestamp: { lte: oneDayAgo, gte: twoDaysAgo }, chain: { in: chains } },
        });

        const distinctTokenPrices = tokenPrices.filter(
            (price, i, self) =>
                self.findIndex((t) => t.tokenAddress === price.tokenAddress && t.chain === price.chain) === i,
        );

        console.timeEnd(`TokenPrice load 24hrs ago - ${chains}`);

        // also add ETH price (0xeee..)
        this.addNativeEthPrice(chains, distinctTokenPrices);

        return distinctTokenPrices.map((tokenPrice) => ({
            id: `${tokenPrice.tokenAddress}-${tokenPrice.timestamp}`,
            ...tokenPrice,
            updatedBy: null,
        }));
    }

    public getPriceForToken(tokenPrices: PrismaTokenCurrentPrice[], tokenAddress: string, chain: Chain): number {
        const tokenPrice = tokenPrices.find(
            (tokenPrice) =>
                tokenPrice.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && tokenPrice.chain === chain,
        );

        return tokenPrice?.price || 0;
    }

    public async deleteTokenPrice({
        timestamp,
        tokenAddress,
        chain,
    }: {
        tokenAddress: string;
        timestamp: number;
        chain: Chain;
    }): Promise<boolean> {
        const response = await prisma.prismaTokenPrice.delete({
            where: { tokenAddress_timestamp_chain: { tokenAddress, timestamp, chain: chain } },
        });

        return !!response;
    }

    public async purgeOldTokenPricesForAllChains(): Promise<number> {
        const hourlyCutoff = daysAgo(DAYS_OF_HOURLY_PRICES);
        const dailyCutoff = daysAgo(DAYS_OF_DAILY_PRICES);

        const deletedHourly =
            await prisma.$executeRaw`DELETE FROM "PrismaTokenPrice" WHERE timestamp < ${hourlyCutoff} AND DATE(to_timestamp(timestamp)) != to_timestamp(timestamp)`;
        const deletedDaily = await prisma.$executeRaw`DELETE FROM "PrismaTokenPrice" WHERE timestamp < ${dailyCutoff}`;

        return deletedHourly + deletedDaily;
    }

    private addNativeEthPrice(chains: Chain[], tokenPrices: { tokenAddress: string; chain: Chain }[]) {
        for (const chain of chains) {
            const wethPrice = tokenPrices.find(
                (tokenPrice) => tokenPrice.tokenAddress === config[chain].weth.address && tokenPrice.chain === chain,
            );

            if (wethPrice) {
                tokenPrices.push({
                    ...wethPrice,
                    tokenAddress: config[chain].eth.address,
                });
            }
        }
    }
}

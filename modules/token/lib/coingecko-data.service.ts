import { prisma } from '../../../prisma/prisma-client';
import { env } from '../../../apps/env';
import { RateLimiter } from 'limiter';
import config from '../../../config';

interface CoingeckoTokenMarketData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    fully_diluted_valuation: number | null;
    total_volume: number;
    high_24h: number;
    low_24h: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number | null;
    ath: number;
    ath_change_percentage: number;
    ath_date: Date;
    atl: number;
    atl_change_percentage: number;
    atl_date: Date;
    roi: null;
    last_updated: Date;
    price_change_percentage_14d_in_currency: number;
    price_change_percentage_1h_in_currency: number;
    price_change_percentage_24h_in_currency: number;
    price_change_percentage_30d_in_currency: number;
    price_change_percentage_7d_in_currency: number;
}

interface CoinId {
    id: string;
    symbol: string;
    name: string;
    platforms: Record<string, string>;
}

/* CoinGecko Demo plan (free, keyed): 30 calls/min, 10k calls/month. Without a key the public API applies
   a shared limit of roughly 5-15 calls/min and answers 429 unpredictably, so we stay well below both.
   https://docs.coingecko.com/reference/common-errors-rate-limit
*/
const tokensPerMinute = env.COINGECKO_API_KEY ? 25 : 3;
const requestRateLimiter = new RateLimiter({ tokensPerInterval: tokensPerMinute, interval: 'minute' });
export class CoingeckoDataService {
    private readonly baseUrl: string;
    private readonly fiatParam: string;
    private readonly apiKeyParam: string;

    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.fiatParam = 'usd';
        this.apiKeyParam = env.COINGECKO_API_KEY ? `&x_cg_demo_api_key=${env.COINGECKO_API_KEY}` : '';
    }

    private readonly checkedTokens = new Set<string>();

    public async syncCoingeckoIds() {
        // Q: Do coingecko IDs change?
        const allTokens = await prisma.prismaToken.findMany({
            where: {
                OR: [{ coingeckoTokenId: null }, { coingeckoPlatformId: null }],
            },
        });

        const unchecked = allTokens.filter((token) => !this.checkedTokens.has(`${token.address}-${token.chain}`));
        if (unchecked.length === 0) {
            return;
        }
        unchecked.forEach((token) => this.checkedTokens.add(`${token.address}-${token.chain}`));

        const coinIds = await this.getCoinIdList();
        const platformToChain = Object.fromEntries(
            Object.entries(config)
                .filter(([chain, _]) => chain !== 'SEPOLIA') // Sepolia is not in CG
                .map(([chain, chainConfig]) => [chainConfig.coingecko.platformId, chain]),
        );
        const coinMap = coinIds.reduce((acc, coin) => {
            for (const [platform, address] of Object.entries(coin.platforms)) {
                if (platformToChain[platform]) {
                    // tokenAddress-chain
                    acc[`${address.toLowerCase()}-${platformToChain[platform]}`] = coin.id;
                }
            }
            return acc;
        }, {} as Record<string, string>);

        const updates = allTokens
            .map((token) => {
                const coingeckoTokenId = coinMap[`${token.address}-${token.chain}`];
                const coingeckoPlatformId = config[token.chain].coingecko.platformId;

                if (token.coingeckoTokenId !== coingeckoTokenId || token.coingeckoPlatformId !== coingeckoPlatformId) {
                    return prisma.prismaToken.update({
                        where: {
                            address_chain: { address: token.address, chain: token.chain },
                        },
                        data: {
                            coingeckoTokenId,
                            coingeckoPlatformId,
                        },
                    });
                }
            })
            .filter((update): update is NonNullable<typeof update> => !!update);

        await prisma.$transaction(updates);
    }

    public async getMarketDataForTokenIds(tokenIds: string[]): Promise<CoingeckoTokenMarketData[]> {
        const endpoint = `/coins/markets?vs_currency=${this.fiatParam}&ids=${tokenIds}&per_page=250&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d%2C14d%2C30d`;

        return this.get<CoingeckoTokenMarketData[]>(endpoint);
    }

    private async getCoinIdList(): Promise<CoinId[]> {
        const endpoint = `/coins/list?include_platform=true`;
        return this.get<CoinId[]>(endpoint);
    }

    private async get<T>(endpoint: string): Promise<T> {
        const remainingRequests = await requestRateLimiter.removeTokens(1);
        console.log('Remaining coingecko requests', remainingRequests);

        const response = await fetch(this.baseUrl + endpoint + this.apiKeyParam);

        if (!response.ok) {
            if (response.status === 429) {
                throw Error(`Coingecko ratelimit: ${response.status} ${response.statusText}`);
            }
            throw Error(`Coingecko API error: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as T;
    }
}

export const coingeckoDataService = new CoingeckoDataService();

import { Chain } from '@prisma/client';
import config from '../../../config';

export const githubChainToChain: { [chain: string]: Chain } = {
    sonic: Chain.SONIC,
    ...Object.fromEntries(Object.keys(config).map((chain) => [chain.toLowerCase(), chain])),
};

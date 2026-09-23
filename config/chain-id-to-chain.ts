import { Chain } from '@prisma/client';

export const chainIdToChain: { [id: string]: Chain } = {
    '146': Chain.SONIC,
};

export const chainToChainId: { [chain: string]: string } = {
    SONIC: '146',
};

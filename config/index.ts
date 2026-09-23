import { Chain } from '@prisma/client';
import sonicConfig from './sonic';

export const DAYS_OF_HOURLY_PRICES = 100;
export const BALANCES_SYNC_BLOCKS_MARGIN = 200;

export default {
    [Chain.SONIC]: sonicConfig,
};

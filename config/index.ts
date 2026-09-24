import { Chain } from '@prisma/client';
import sonicConfig from './sonic';

export const DAYS_OF_HOURLY_PRICES = 30;
export const DAYS_OF_DAILY_PRICES = 90;
export const DAYS_OF_EVENTS = 90;
export const BALANCES_SYNC_BLOCKS_MARGIN = 200;

export default {
    [Chain.SONIC]: sonicConfig,
};

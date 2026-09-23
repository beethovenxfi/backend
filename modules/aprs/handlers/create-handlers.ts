import { Chain } from '@prisma/client';
import { AprHandler } from '../types';
import * as handlers from '.';
import config from '../../../config';
import { tokenService } from '../../token/token.service';

/**
 * Creates handler instances for a specific chain
 */
export function createHandlers(chain: Chain): AprHandler[] {
    const handlerList: AprHandler[] = [];

    // Default handlers for all of the chains
    handlerList.push(new handlers.SwapFeeAprHandler());
    handlerList.push(new handlers.NestedPoolAprHandler());
    // handlerList.push(new handlers.QuantAmmAprHandler());
    handlerList.push(new handlers.LiquidityGaugeAprHandler(tokenService));
    handlerList.push(new handlers.MerklAprHandler());

    if (config[chain].aprHandlers.maBeetsAprHandler) {
        handlerList.push(
            new handlers.MaBeetsAprHandler(config[chain].aprHandlers.maBeetsAprHandler.beetsAddress, tokenService),
        );
        handlerList.push(new handlers.BeetswarsGaugeVotingAprHandler());
    }

    if (config[chain].aprHandlers.ybAprHandler) {
        handlerList.push(new handlers.YbTokensAprHandler());
    }

    return handlerList;
}

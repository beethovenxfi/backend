import { Express } from 'express';
import { tokenService } from '../../modules/token/token.service';
import { PricingService } from '../../modules/pricing/pricing-service';
import { poolService } from '../../modules/pool/pool.service';
import moment from 'moment';
import { chainIdToChain } from '../../config/chain-id-to-chain';
import { Chain } from '@prisma/client';
import {
    SnapshotsController,
    PoolController,
    EventController,
    StakingController,
    QuantAmmController,
    TokenYieldsController,
} from '../../modules/controllers';
import { updateVolumeAndFees } from '../../modules/actions/pool/update-volume-and-fees';
import { TokenController } from '../../modules/controllers/token-controller';
import config, { DAYS_OF_EVENTS } from '../../config';
import { LBPController } from '../../modules/controllers/lbp-controller';
import { AprsController } from '../../modules/controllers/aprs-controller';
import { LoopsService } from '../../modules/loops/service';
import { ContentController } from '../../modules/content/content-controller';
import { StakedSonicController } from '../../modules/sts/sts-controller';
import { UserBalancesController } from '../../modules/user/user-balances-controller';
import { eventsRepository } from '../../modules/repositories/events';
import { jobStatusService } from '../../modules/job-status/job-status.service';
import { reportFailure, reportRecovery } from '../../modules/common/failure-reporter';

const runningJobs: Set<string> = new Set();

async function runIfNotAlreadyRunning(
    id: string,
    chainId: string,
    fn: () => any,
    res: any,
): Promise<void> {
    const jobId = `${id}-${chainId}`;

    if (runningJobs.has(jobId)) {
        console.log(`Skip job ${jobId}-skip`);
        res.sendStatus(200);
        return;
    }

    const startJobTime = moment();

    try {
        runningJobs.add(jobId);

        console.log(`Start job ${jobId}-start`);
        await jobStatusService.recordStart(id, chainId);

        await fn();

        const durationMs = moment().diff(startJobTime);
        console.log(`Successful job ${jobId}-done`, durationMs / 1000);
        await jobStatusService.recordSuccess(id, chainId, durationMs);
        reportRecovery(jobId);
    } catch (error: any) {
        const durationMs = moment().diff(startJobTime);
        console.log(`Error job ${jobId}-error`, durationMs / 1000, error.stack || error.message || error);
        await jobStatusService.recordError(id, chainId, error.message || String(error));
        reportFailure(jobId, error, { job: id, chain: chainId });
    } finally {
        runningJobs.delete(jobId);
        res.sendStatus(200);
    }
}

export function configureWorkerRoutes(app: Express) {
    app.post('/', async (req, res) => {
        const job = req.body as { name: string; chain: string };
        setupJobHandlers(job.name, job.chain, res);
    });
}

const setupJobHandlers = async (name: string, chainId: string, res: any) => {
    const chain = chainIdToChain[chainId];
    switch (name) {
        case 'sync-changed-pools':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().syncChangedPoolsV2(chain), res);
            break;
        case 'user-sync-wallet-balances-for-all-pools':
            await runIfNotAlreadyRunning(name, chainId, () => UserBalancesController().syncBalances(chain), res);
            break;
        case 'user-sync-staked-balances':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => UserBalancesController().syncChangedStakedBalances(chain),
                res,
            );
            break;
        case 'update-token-prices':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                async () => {
                    const chains = Object.keys(config) as Chain[];
                    const service = new PricingService(chains);
                    const errors: Error[] = [];
                    for (const chain of chains) {
                        try {
                            await service.updatePrices(chain);
                        } catch (error) {
                            console.log(`Error updating prices for chain ${chain}:`, error);
                            errors.push(error instanceof Error ? error : new Error(`Unknown error: ${error}`));
                        }
                    }
                    if (errors.length > 0) {
                        throw new Error(errors.map((e) => e.message).join(', '));
                    }
                    return 'OK';
                },
                res,
            );
            break;
        case 'update-liquidity-for-inactive-pools':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => PoolController().updateLiquidityValuesForInactivePools(chain),
                res,
            );
            break;
        case 'sync-new-pools-from-subgraph':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().addPoolsV2(chain), res);
            break;
        case 'sync-join-exits-v2':
            await runIfNotAlreadyRunning(name, chainId, () => EventController().syncJoinExitsV2(chain), res);
            break;
        case 'sync-token-content-data':
            await runIfNotAlreadyRunning(name, chainId, () => ContentController().syncTokenContentData(), res);
            break;
        case 'update-liquidity-24h-ago-v2':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => PoolController().updateLiquidity24hAgoV2(chain),
                res,
            );
            break;
        case 'sync-staking-for-pools':
            await runIfNotAlreadyRunning(name, chainId, () => StakingController().syncStaking(chain), res);
            break;
        case 'sync-snapshots':
            await runIfNotAlreadyRunning(name, chainId, () => SnapshotsController().syncSnapshots(chain), res);
            break;
        case 'sync-latest-reliquary-snapshots':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => poolService.syncLatestReliquarySnapshotsForAllFarms(chain),
                res,
            );
            break;
        case 'global-purge-old-data':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                async () => {
                    await tokenService.purgeOldTokenPricesForAllChains();
                    await eventsRepository.deleteEventsOlderThan(chain, DAYS_OF_EVENTS);
                },
                res,
            );
            break;
        case 'update-fee-volume-yield-all-pools':
            await runIfNotAlreadyRunning(name, chainId, () => updateVolumeAndFees(chain), res);
            break;
        case 'sync-sts-staking-data':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => StakedSonicController().syncSonicStakingData(),
                res,
            );
            break;
        case 'sync-sts-staking-snapshots':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => StakedSonicController().syncSonicStakingSnapshots(),
                res,
            );
            break;
        case 'sync-loops-data':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => new LoopsService().fetchAndStoreLoopsData(chain),
                res,
            );
            break;
        // APRs
        case 'update-pool-apr':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => {
                    const chain = chainIdToChain[chainId];
                    return AprsController().updateAprsAndIncentivizedCategory(chain);
                },
                res,
            );
            break;
        // V3 Jobs
        case 'add-pools-v3':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().addPoolsV3(chain), res);
            break;
        case 'sync-pools-v3':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().syncPoolsV3(chain), res);
            break;
        case 'sync-hook-data':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().syncHookData(chain), res);
            break;
        case 'sync-swaps-v3':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => EventController().syncSwapsUpdateVolumeAndFeesV3(chain),
                res,
            );
            break;
        case 'sync-swaps-v2':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => EventController().syncSwapsUpdateVolumeAndFeesV2(chain),
                res,
            );
            break;
        case 'sync-join-exits-v3':
            await runIfNotAlreadyRunning(name, chainId, () => EventController().syncJoinExitsV3(chain), res);
            break;
        case 'update-liquidity-24h-ago-v3':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => PoolController().updateLiquidity24hAgoV3(chain),
                res,
            );
            break;
        case 'sync-categories':
            await runIfNotAlreadyRunning(name, chainId, () => ContentController().syncCategories(), res);
            break;
        case 'sync-rate-provider-reviews':
            await runIfNotAlreadyRunning(name, chainId, () => ContentController().syncRateProviderReviews(), res);
            break;
        case 'sync-hook-reviews':
            await runIfNotAlreadyRunning(name, chainId, () => ContentController().syncHookReviews(), res);
            break;
        case 'sync-erc4626-data':
            await runIfNotAlreadyRunning(name, chainId, () => ContentController().syncErc4626Data(), res);
            break;
        case 'sync-erc4626-onchain-data':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => TokenController().syncErc4626OnChainData(chain),
                res,
            );
            break;
        case 'sync-weights':
            await runIfNotAlreadyRunning(name, chainId, () => QuantAmmController.syncWeights(chain), res);
            break;
        case 'sync-lbps':
            await runIfNotAlreadyRunning(name, chainId, () => LBPController.syncData(chain), res);
            break;
        case 'sync-fixed-lbps':
            await runIfNotAlreadyRunning(name, chainId, () => LBPController.syncDataFixedLBP(chain), res);
            break;
        case 'sync-token-tvl':
            await runIfNotAlreadyRunning(name, chainId, () => TokenController().syncTvl(), res);
            break;
        case 'fetch-token-yields':
            await runIfNotAlreadyRunning(
                name,
                chainId,
                () => TokenYieldsController().fetchAndStoreAllYields(),
                res,
            );
            break;
        case 'update-lifetime-values':
            await runIfNotAlreadyRunning(name, chainId, () => PoolController().updateLifeTimeValues(chain), res);
            break;
        default:
            res.sendStatus(400);
            // throw new Error(`Unhandled job type ${name}`);
            console.log(`Unhandled job type ${name}`);
    }
};

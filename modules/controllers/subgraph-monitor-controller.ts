import * as Sentry from '@sentry/node';
import networkConfigs from '../../config';
import { chainIdToChain } from '../../config/chain-id-to-chain';
import { GaugeSubgraphService } from '../subgraphs/gauge-subgraph/gauge-subgraph.service';
import { getViemClient } from '../sources/viem-client';

export function SubgraphMonitorController() {
    return {
        /**
         * Compares every configured subgraph's head block with the chain head and reports to Sentry when the
         * lag exceeds the chain's acceptableSGLag.
         */
        async checkSubgraphLag() {
            for (const chain of Object.values(chainIdToChain)) {
                const networkData = networkConfigs[chain];
                const viemClient = getViemClient(networkData.chain.prismaId);
                const latestBlock = Number(await viemClient.getBlockNumber());

                for (const [subgraphName, subgraphUrl] of Object.entries(networkData.subgraphs)) {
                    if (!subgraphUrl.startsWith('http')) {
                        continue;
                    }

                    try {
                        const subgraph = new GaugeSubgraphService(subgraphUrl);
                        const blockNumber = await subgraph.lastSyncedBlock();
                        const lag = Math.max(latestBlock - blockNumber, 0);

                        console.log(`Subgraph lag ${networkData.chain.slug}-${subgraphName}: ${lag} blocks`);

                        if (lag > networkData.acceptableSGLag) {
                            Sentry.captureMessage(
                                `Subgraph ${subgraphName} on ${networkData.chain.slug} is lagging by ${lag} blocks`,
                                'warning',
                            );
                        }
                    } catch (e) {
                        console.log(`Error fetching subgraph lag for ${subgraphName} on ${networkData.chain.slug}`, e);
                    }
                }
            }
        },
    };
}

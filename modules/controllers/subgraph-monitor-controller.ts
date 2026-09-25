import { Chain } from '@prisma/client';
import networkConfigs from '../../config';
import { chainIdToChain } from '../../config/chain-id-to-chain';
import { GaugeSubgraphService } from '../subgraphs/gauge-subgraph/gauge-subgraph.service';
import { getViemClient } from '../sources/viem-client';

export interface SubgraphLagEntry {
    chain: Chain;
    name: string;
    headBlock: number | null;
    syncedBlock: number | null;
    lag: number | null;
    acceptableLag: number;
    ok: boolean;
    error?: string;
}

export function SubgraphMonitorController() {
    return {
        /**
         * Compares every configured subgraph's head block with the chain head. Served by GET /health/subgraphs
         * for the uptime monitor; ok is false when any subgraph is unreachable or lags more than acceptableSGLag.
         */
        async getLagReport(): Promise<{ ok: boolean; checkedAt: Date; subgraphs: SubgraphLagEntry[] }> {
            const subgraphs: SubgraphLagEntry[] = [];

            for (const chain of Object.values(chainIdToChain)) {
                const networkData = networkConfigs[chain];
                const acceptableLag = networkData.acceptableSGLag;
                const entries = Object.entries(networkData.subgraphs).filter(([, url]) => url.startsWith('http'));

                let headBlock: number;
                try {
                    headBlock = Number(await getViemClient(networkData.chain.prismaId).getBlockNumber());
                } catch (e: any) {
                    for (const [name] of entries) {
                        subgraphs.push({
                            chain,
                            name,
                            headBlock: null,
                            syncedBlock: null,
                            lag: null,
                            acceptableLag,
                            ok: false,
                            error: `rpc: ${e.message}`,
                        });
                    }
                    continue;
                }

                await Promise.all(
                    entries.map(async ([name, url]) => {
                        try {
                            const syncedBlock = await new GaugeSubgraphService(url).lastSyncedBlock();
                            const lag = Math.max(headBlock - syncedBlock, 0);
                            subgraphs.push({
                                chain,
                                name,
                                headBlock,
                                syncedBlock,
                                lag,
                                acceptableLag,
                                ok: lag <= acceptableLag,
                            });
                        } catch (e: any) {
                            subgraphs.push({
                                chain,
                                name,
                                headBlock,
                                syncedBlock: null,
                                lag: null,
                                acceptableLag,
                                ok: false,
                                error: e.message,
                            });
                        }
                    }),
                );
            }

            return { ok: subgraphs.every((entry) => entry.ok), checkedAt: new Date(), subgraphs };
        },
    };
}

import {
    GaugeFragment,
    GaugeShareFragment,
    GaugeSharesQueryVariables,
    GaugeShare_OrderBy,
    getSdk,
    LiquidityGauge_OrderBy,
    OrderDirection,
} from './generated/gauge-subgraph-types';
import { GraphQLClient } from 'graphql-request';

export type LiquidityGaugeStatus = 'KILLED' | 'ACTIVE' | 'PREFERRED';

export class GaugeSubgraphService {
    private sdk: ReturnType<typeof getSdk>;

    constructor(subgraphUrl: string) {
        this.sdk = getSdk(new GraphQLClient(subgraphUrl));
    }

    public async getAllGaugeShares(where?: GaugeSharesQueryVariables['where']): Promise<GaugeShareFragment[]> {
        const allGaugeShares: GaugeShareFragment[] = [];
        let hasMore = true;
        let id = `0`;
        const pageSize = 1000;

        while (hasMore) {
            const gauges = await this.sdk.GaugeShares({
                where: {
                    id_gt: id,
                    ...where,
                },
                orderBy: GaugeShare_OrderBy.id,
                orderDirection: OrderDirection.asc,
                first: pageSize,
            });

            if (gauges.gaugeShares.length === 0) {
                break;
            }

            if (gauges.gaugeShares.length < pageSize) {
                hasMore = false;
            }

            allGaugeShares.push(...gauges.gaugeShares);
            id = gauges.gaugeShares[gauges.gaugeShares.length - 1].id;
        }
        return allGaugeShares;
    }

    public async getAllGauges(): Promise<GaugeFragment[]> {
        const allLiquidityGauges: GaugeFragment[] = [];
        let hasMore = true;
        let id = `0`;
        const pageSize = 1000;

        while (hasMore) {
            const gauges = await this.sdk.GaugeLiquidityGauges({
                where: {
                    id_gt: id,
                },
                orderBy: LiquidityGauge_OrderBy.id,
                orderDirection: OrderDirection.asc,
                first: pageSize,
            });

            if (gauges.liquidityGauges.length === 0) {
                break;
            }

            if (gauges.liquidityGauges.length < pageSize) {
                hasMore = false;
            }

            allLiquidityGauges.push(...gauges.liquidityGauges);
            id = gauges.liquidityGauges[gauges.liquidityGauges.length - 1].id;
        }

        return allLiquidityGauges;
    }

    public async lastSyncedBlock() {
        const { meta } = await this.sdk.GaugeGetMeta();

        if (!meta) {
            throw new Error('Missing meta data');
        }
        return Number(meta.block.number);
    }
}

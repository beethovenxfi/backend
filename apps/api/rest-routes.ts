import { Express } from 'express';
import { beetsGetCirculatingSupply, beetsGetTotalSupply } from '../../modules/beets/beets';
import { jobStatusService } from '../../modules/job-status/job-status.service';
import { SubgraphMonitorController } from '../../modules/controllers/subgraph-monitor-controller';

export function loadRestRoutes(app: Express) {
    app.get('/health/jobs', async (_, res) => {
        try {
            const report = await jobStatusService.report();
            res.status(report.ok ? 200 : 503).json(report);
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.get('/health/subgraphs', async (_, res) => {
        try {
            const report = await SubgraphMonitorController().getLagReport();
            res.status(report.ok ? 200 : 503).json(report);
        } catch (e: any) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
    app.use('/health', (_, res) => res.sendStatus(200));
    app.use('/circulating_supply_sonic', (_, res) => {
        beetsGetCirculatingSupply('SONIC').then((result) => {
            res.send(result);
        });
    });
    app.use('/total_supply_sonic', (_, res) => {
        beetsGetTotalSupply('SONIC').then((result) => {
            res.send(result);
        });
    });
}

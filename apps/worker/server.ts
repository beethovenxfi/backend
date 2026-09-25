import express from 'express';
import { env } from '../env';
import { configureWorkerRoutes } from './job-handlers';

export async function startWorkerServer() {
    const app = express();

    app.use(express.json());

    configureWorkerRoutes(app);

    app.listen(env.PORT, () => {
        console.log(`Worker listening on port ${env.PORT}`);
    });
}

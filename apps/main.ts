import './sentry';
import { startApiServer } from './api/server';
import { startWorkerServer } from './worker/server';
import { startSchedulerServer } from './scheduler/server';

const isWorker = process.env.WORKER === 'true';
const isScheduler = process.env.SCHEDULER === 'true';

if (isWorker) {
    // The worker exposes the job endpoint. With SCHEDULER=true as well, the scheduler runs in the same
    // process and posts jobs to it over localhost (WORKER_QUEUE_URL=http://localhost:<PORT>).
    startWorkerServer();
}
if (isScheduler) {
    startSchedulerServer();
}
if (!isWorker && !isScheduler) {
    startApiServer();
}

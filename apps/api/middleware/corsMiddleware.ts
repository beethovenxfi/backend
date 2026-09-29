import { NextFunction, Request, Response } from 'express';

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-Requested-With,Authorization,Content-Type,AccountAddress,AdminApiKey',
    );

    // Preflight must not reach Apollo, its CSRF guard rejects it with 400
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Max-Age', '86400');
        res.sendStatus(204);
        return;
    }

    next();
}

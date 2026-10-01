import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response, Router } from 'express';
import helmet from 'helmet';
import { connectDb } from './db.js';
import { loadEnv } from './env.js';
import { api } from './routes/api.js';

export { closeDb } from './db.js';

export function createApp(options?: { sameOrigin?: boolean }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', apiMiddleware(options));
  return app;
}

export function useApi(host: Express, options?: { sameOrigin?: boolean }) {
  loadEnv();
  host.set('trust proxy', 1);
  host.use('/api', apiMiddleware(options));
  connectDb(process.env['MONGODB_URI']);
}

function apiMiddleware(options?: { sameOrigin?: boolean }) {
  const sameOrigin = options?.sameOrigin ?? false;
  const clientOrigin = process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4217';
  const guard = Router();
  guard.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  if (!sameOrigin) {
    guard.use(cors({ origin: clientOrigin, credentials: true }));
  }
  guard.use(requireBrowserOrigin(clientOrigin, sameOrigin));
  guard.use(cookieParser());
  guard.use(express.json());
  guard.use(api);
  return guard;
}

function requireBrowserOrigin(clientOrigin: string, sameOrigin: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const origin = req.get('origin');
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === clientOrigin || (sameOrigin && origin === hostOrigin)) {
      next();
      return;
    }

    res.status(403).json({ error: 'bad_origin' });
  };
}

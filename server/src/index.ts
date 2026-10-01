import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { connectDb } from './db.js';
import { api } from './routes/api.js';

const app = express();
const port = Number(process.env['PORT'] ?? 3017);
const clientOrigin = process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4217';

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(requireBrowserOrigin);
app.use(cookieParser());
app.use(express.json());
app.use('/api', api);

app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
});

connectDb(process.env['MONGODB_URI']);

function requireBrowserOrigin(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  if (req.get('origin') !== clientOrigin) {
    res.status(403).json({ error: 'bad_origin' });
    return;
  }

  next();
}

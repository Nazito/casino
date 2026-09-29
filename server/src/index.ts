import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { connectDb } from './db.js';
import { api } from './routes/api.js';

const app = express();
const port = Number(process.env['PORT'] ?? 3017);
const clientOrigin = process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4217';

app.use(cors({ origin: clientOrigin }));
app.use(express.json());
app.use('/api', api);

app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
});

connectDb(process.env['MONGODB_URI']).catch((error: unknown) => {
  console.error('Не удалось подключиться к MongoDB', error);
});

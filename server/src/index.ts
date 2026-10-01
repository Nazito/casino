import { createApp } from './app.js';
import { connectDb } from './db.js';
import { loadEnv } from './env.js';

loadEnv();

const port = Number(process.env['PORT'] ?? 3017);

createApp().listen(port, () => {
  console.log(`API http://localhost:${port}`);
});

connectDb(process.env['MONGODB_URI']);

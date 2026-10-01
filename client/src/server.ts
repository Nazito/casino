import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const browserDistFolder = join(import.meta.dirname, '../browser');
const runningAlone = isMainModule(import.meta.url) || !!process.env['pm_id'];

const app = express();
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: process.env['NODE_ENV'] === 'production',
});

let closeDatabase: (() => Promise<void>) | undefined;

if (runningAlone) {
  const apiModule = join(import.meta.dirname, '../../../../server/dist/app.js');
  const loaded = (await import(pathToFileURL(apiModule).href)) as {
    useApi: (host: express.Express, options?: { sameOrigin?: boolean }) => void;
    closeDb: () => Promise<void>;
  };
  loaded.useApi(app, { sameOrigin: process.env['NODE_ENV'] === 'production' });
  closeDatabase = loaded.closeDb;
}

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (runningAlone && closeDatabase) {
  const port = process.env['PORT'] || 4217;
  const httpServer = app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Сайт и API http://localhost:${port}`);
  });
  const shutdown = closeDatabase;
  const stop = (signal: NodeJS.Signals) => {
    console.log(`${signal}: перестаём принимать запросы`);
    const forced = setTimeout(() => process.exit(1), 10_000);
    httpServer.close(() => {
      void shutdown().finally(() => {
        clearTimeout(forced);
        process.exit(0);
      });
    });
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}

export const reqHandler = createNodeRequestHandler(app);

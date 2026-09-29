import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { games } from './games';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'play/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'games/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Server,
    async getPrerenderParams() {
      return games.map((game) => ({ slug: game.slug }));
    },
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

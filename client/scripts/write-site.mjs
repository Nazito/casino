import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const origin = readOrigin().replace(/\/$/, '');
new URL(origin);

const paths = ['/', '/games', '/games/neon-fruits', '/rules', '/terms', '/privacy'];

writeFileSync(
  join(root, 'src/app/site.generated.ts'),
  `export const siteOrigin = ${JSON.stringify(origin)};\n`,
);

writeFileSync(
  join(root, 'public/robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /play\n\nSitemap: ${origin}/sitemap.xml\n`,
);

const urls = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`).join('\n');
writeFileSync(
  join(root, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

function readOrigin() {
  if (process.env.SITE_ORIGIN) {
    return process.env.SITE_ORIGIN;
  }

  try {
    const env = readFileSync(join(root, '../server/.env'), 'utf8');
    const line = env.split('\n').find((item) => item.startsWith('CLIENT_ORIGIN='));
    const value = line?.slice('CLIENT_ORIGIN='.length).trim();
    if (value) {
      return value;
    }
  } catch {
    // Local .env is optional. The build falls back to the dev origin.
  }

  return 'http://localhost:4217';
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

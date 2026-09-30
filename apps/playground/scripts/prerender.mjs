/*
  Prerenders every route into the built site, so crawlers and first paint get real content
  without JavaScript. Runs after `vite build`:

  1. Builds src/entry-server.tsx for Node. It renders the same component tree the browser
     hydrates, through React's own static renderer, so the markup matches the browser's first
     render by construction.
  2. Fills dist/index.html's empty root with each route's markup, writes the route's own head
     tags, and preloads the route's code so hydration does not wait on a request chain.

  Cloudflare serves dist/changelog.html at /changelog, and so on for each route.
*/
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
// `node scripts/prerender.mjs <dir>` prerenders a build written somewhere other than dist.
const dist = resolve(process.argv[2] ?? join(root, 'dist'));
const server = join(root, 'node_modules/.cache/typograph-prerender');

/** The module each route loads before it hydrates, as the Vite manifest names it. */
const routeModules = {
  '/changelog': 'src/Changelog.tsx',
  '/integration': 'src/IntegrationGuide.tsx',
  '/specimen': 'src/Specimen.tsx',
};

const started = performance.now();
await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: server,
    emptyOutDir: true,
    copyPublicDir: false,
    manifest: false,
    sourcemap: false,
  },
});
const { render, heads, headHtml, routes } = await import(
  pathToFileURL(join(server, 'entry-server.js')).href
);

const emptyRoot = '<div id="root"></div>';
const template = await readFile(join(dist, 'index.html'), 'utf8');
if (!template.includes(emptyRoot)) {
  throw new Error('dist/index.html has no empty root. Run `vite build` before prerendering.');
}
const manifest = JSON.parse(await readFile(join(dist, '.vite/manifest.json'), 'utf8'));

/** Preload tags for a route's chunk and its static imports, minus what the entry already loads. */
function preloads(route) {
  const key = routeModules[route];
  // Rollup can fold a route into a shared chunk the manifest names otherwise (the specimen
  // shares streamdown's); that route simply loads without preloads.
  if (!manifest[key]) return '';
  const loaded = new Set();
  const visit = (name) => {
    if (loaded.has(name)) return;
    loaded.add(name);
    for (const child of manifest[name].imports ?? []) visit(child);
  };
  visit('index.html');
  const entry = new Set(loaded);
  visit(key);
  const tags = [];
  for (const name of loaded) {
    if (entry.has(name)) continue;
    const chunk = manifest[name];
    tags.push(`<link rel="modulepreload" crossorigin href="/${chunk.file}" />`);
    for (const css of chunk.css ?? []) {
      tags.push(`<link rel="stylesheet" crossorigin href="/${css}" />`);
    }
  }
  return tags.join('\n    ');
}

for (const route of routes) {
  const markup = await render(route);
  if (!markup) throw new Error(`${route} rendered nothing`);
  let html = headHtml(template, heads[route]).replace(emptyRoot, `<div id="root">${markup}</div>`);
  const extra = preloads(route);
  if (extra) html = html.replace('</head>', `  ${extra}\n  </head>`);
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  await writeFile(join(dist, file), html);
  const size = `${(Buffer.byteLength(html) / 1024).toFixed(1)} kB`;
  console.log(`prerendered ${route.padEnd(13)} ${relative(root, join(dist, file))} ${size}`);
}

await rm(server, { recursive: true, force: true });
console.log(`prerendered ${routes.length} routes in ${Math.round(performance.now() - started)} ms`);

interface Assets {
  fetch(request: Request): Promise<Response>;
}

const CANONICAL_HOST = 'typograph.dev';

/** Every production hostname the Worker is routed on. Anything else (localhost, workers.dev) passes through. */
const PRODUCTION_HOSTS = new Set([
  CANONICAL_HOST,
  'www.typograph.dev',
  'typograph.ing',
  'www.typograph.ing',
]);

/**
 * `wrangler dev` rewrites request.url to the first route's host over http, so a
 * local run looks like http://typograph.dev and would redirect forever. Cloudflare
 * always sets cf-connecting-ip to the real client, so a loopback address only
 * appears when the request came from the developer's own machine.
 */
function isLocalDev(request: Request): boolean {
  const ip = request.headers.get('cf-connecting-ip');
  return ip === '127.0.0.1' || ip === '::1';
}

/**
 * Typograph owns its dedicated domains. Every production request lands on
 * https://typograph.dev, preserving path and query. A plain http request gets
 * a 301 (the protocol upgrade); a host change over https gets a 308. Both are
 * permanent, and search engines treat them alike.
 */
export default {
  async fetch(request: Request, env: { ASSETS: Assets }): Promise<Response> {
    const url = new URL(request.url);
    if (
      !isLocalDev(request) &&
      PRODUCTION_HOSTS.has(url.hostname) &&
      (url.protocol === 'http:' || url.hostname !== CANONICAL_HOST)
    ) {
      const status = url.protocol === 'http:' ? 301 : 308;
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return Response.redirect(url.toString(), status);
    }
    // /changelog, /specimen, and /integration are prerendered as their own .html files,
    // which the asset binding serves at the extension-less URLs.
    return env.ASSETS.fetch(request);
  },
};

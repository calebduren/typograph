import { expect, it, vi } from 'vitest';
import worker from '../worker/index';

it('serves the primary domain at the root without redirecting assets', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(
      async (_request) => new Response('asset'),
    ),
  };
  const request = new Request('https://typograph.dev/assets/example.js?v=1');
  const response = await worker.fetch(request, { ASSETS: assets });
  expect(await response.text()).toBe('asset');
  expect(assets.fetch).toHaveBeenCalledWith(request);
});

it('redirects the secondary domain while preserving paths and query strings', async () => {
  const assets = { fetch: vi.fn<(request: Request) => Promise<Response>>() };
  const response = await worker.fetch(
    new Request('https://typograph.ing/integration.md?source=guide'),
    { ASSETS: assets },
  );
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe(
    'https://typograph.dev/integration.md?source=guide',
  );
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('does not turn missing assets into a successful page', async () => {
  const assets = {
    fetch: vi.fn<() => Promise<Response>>(async () => new Response('Not found', { status: 404 })),
  };
  expect(
    (await worker.fetch(new Request('https://typograph.dev/missing.js'), { ASSETS: assets }))
      .status,
  ).toBe(404);
});

it('normalises protocol and port when redirecting the secondary domain', async () => {
  const assets = { fetch: vi.fn<(request: Request) => Promise<Response>>() };
  const response = await worker.fetch(new Request('http://typograph.ing:8080/a/b?c=1'), {
    ASSETS: assets,
  });
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('https://typograph.dev/a/b?c=1');
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('leaves other hostnames, including subdomains, to the asset binding', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('asset')),
  };
  for (const url of [
    'https://www.typograph.ing/',
    'http://127.0.0.1:4174/',
    'https://typograph.dev/',
  ]) {
    const request = new Request(url);
    await worker.fetch(request, { ASSETS: assets });
    expect(assets.fetch).toHaveBeenLastCalledWith(request);
  }
});

it('serves the app shell for the specimen route', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('shell')),
  };
  const response = await worker.fetch(new Request('https://typograph.dev/specimen?size=18'), {
    ASSETS: assets,
  });
  expect(await response.text()).toBe('shell');
  expect(assets.fetch.mock.calls[0][0].url).toBe('https://typograph.dev/?size=18');
});

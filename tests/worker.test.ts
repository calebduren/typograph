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
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe('https://typograph.dev/a/b?c=1');
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('redirects www hostnames to the canonical host', async () => {
  const assets = { fetch: vi.fn<(request: Request) => Promise<Response>>() };
  for (const host of ['www.typograph.dev', 'www.typograph.ing']) {
    const response = await worker.fetch(new Request(`https://${host}/changelog?a=1`), {
      ASSETS: assets,
    });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://typograph.dev/changelog?a=1');
  }
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('upgrades http on production hosts with a 301, preserving path and query', async () => {
  const assets = { fetch: vi.fn<(request: Request) => Promise<Response>>() };
  for (const host of ['typograph.dev', 'www.typograph.dev', 'typograph.ing']) {
    const response = await worker.fetch(new Request(`http://${host}/integration?x=y`), {
      ASSETS: assets,
    });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://typograph.dev/integration?x=y');
  }
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('leaves local and unknown hostnames to the asset binding', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('asset')),
  };
  for (const url of [
    'http://127.0.0.1:4174/',
    'http://localhost:8787/changelog',
    'https://typograph.dev/',
    'https://typograph.dev/specimen',
    'https://typograph.dev.workers.dev/',
  ]) {
    const request = new Request(url);
    await worker.fetch(request, { ASSETS: assets });
    expect(assets.fetch).toHaveBeenLastCalledWith(request);
  }
});

it('passes local development requests through even though wrangler reports the route host over http', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('asset')),
  };
  for (const ip of ['127.0.0.1', '::1']) {
    const request = new Request('http://typograph.dev/changelog', {
      headers: { 'cf-connecting-ip': ip },
    });
    expect(await (await worker.fetch(request, { ASSETS: assets })).text()).toBe('asset');
    expect(assets.fetch).toHaveBeenLastCalledWith(request);
  }
  const remote = new Request('http://typograph.dev/', {
    headers: { 'cf-connecting-ip': '203.0.113.9' },
  });
  expect((await worker.fetch(remote, { ASSETS: assets })).status).toBe(301);
});

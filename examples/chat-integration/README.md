# Recorded chat integration fixture

One AI Elements UI, two real SDK paths, deterministic Markdown responses. No model calls, API keys, cloud account, or deployment is required. This is a local compatibility fixture, not a production chat starter.

- **Vercel AI SDK:** `useChat` and `DefaultChatTransport` consume a real AI SDK UI-message HTTP stream. Completed, stopped, and failed raw messages are saved to sessionStorage for reload tests. This path does not claim active-stream resumption.
- **Cloudflare:** `AIChatAgent`, `useAgent`, and `useAgentChat` use a local Worker and Durable Object through Wrangler. The SDK handles persistence and active-stream resumption after reconnect.
- **Shared presentation:** official AI Elements Message source, shadcn components, Streamdown, and the local `@calebduren/typograph` package. Server transports never run typography over stored model output.

## Run locally

Use Node 22+; CI uses Node 24. From the repository root:

```sh
npm ci
npm run build:chat
npm run worker -w @typograph/chat-integration
```

In a second terminal:

```sh
npm run dev -w @typograph/chat-integration
```

Open [the local fixture](http://127.0.0.1:4175). Use the backend links to switch SDKs. Run rich Markdown, isolated-boundary, long-running, or failing responses; change language and spacing; stop/regenerate; inspect and copy original Markdown. A `room` query parameter isolates conversation history. Wrangler stores its local Durable Object data in the ignored `.wrangler` directory.

## Automated checks

```sh
npm run check
npm run test:chat-integration
```

The Playwright command starts both servers if needed. macOS uses installed Google Chrome. On Linux/CI it uses Playwright Chromium; install it once with `npx playwright install --with-deps chromium`. Tests use unique rooms and one worker to keep timings reproducible. Failure traces are kept in the ignored `test-results` directory and uploaded by CI on failure.

The 11 checks cover both transports, quotes split across chunks, a partial unit that becomes `million`, code/math/table/link/tool preservation, original clipboard text, changing locale/spacing without replacing a paragraph node, stop/regenerate, error/history reload, and active Cloudflare disconnect/reconnect without duplicated answer text. Recorded chunk timing is deliberate; there are no paid generation calls.

## Integration recipe

Use [src/typography-response.tsx](src/typography-response.tsx) for the small wrapper. It preserves Streamdown's default Remark plugins and memoizes the added configuration. A fixed streaming preset requires no completion callback. Only assistant text parts use this component; structured parts retain their own rendering.

The Message component was installed from `https://elements.ai-sdk.dev/api/registry/message.json` with shadcn CLI 4.21.0 on 17 September 2026. Its `MessageResponse` has two intentional changes: normal React memo comparison, and a memoized `plugins` identity that changes when Remark/Rehype configuration changes. The installed Streamdown 2.6.0 ignores Remark/Rehype changes in its own comparator. Our change allows a settings update without changing message keys or remounting their DOM. Keep this adjustment when regenerating the component, or rerun the regression test against an upstream fix.

Tested direct SDK versions: `ai` 7.0.100, `@ai-sdk/react` 4.0.103, `@cloudflare/ai-chat` 0.12.0, `agents` 0.23.0, `streamdown` 2.6.0, React 19.3.0. The repository lockfile fixes the complete dependency graph.

This deliberately includes the upstream code, math, CJK, and diagram renderer plugins. Its app bundle is much larger than the typography utility alone; it is not a minimal-bundle template. Measure the utility separately with `npm run bench:chat`. Client update profiling, hydration, accessibility, rendered-selection copying, and production deployment validation are not implied by these tests.

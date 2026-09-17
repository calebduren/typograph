# Typograph

Careful English typography for streaming AI responses. A small Remark plugin refines punctuation in rendered Markdown while preserving the original messages. Optional non-breaking spaces keep related words together; a separate Rehype helper hangs opening quotes.

**Pre-release:** `@typograph/chat` is a private, unpublished workspace package. Use a checkout containing the package or a locally built archive. No public npm install command is available yet.

## Try it locally

Use Node 22.12+ and npm. No model account or API key is required.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4173/>. The landing page includes an editable comparison, recorded streaming example, and copyable integration prompts. Text processing stays in the browser.

## Integrate

Read the [package API](packages/chat-typography/README.md) and [integration guide](apps/playground/public/integration.md) for AI Elements/shadcn, Cloudflare Agents, and generic Remark pipelines. The [SDK fixture](examples/chat-integration/README.md) exercises real local transports with recorded responses.

```sh
npm run build:chat
npm pack -w @typograph/chat
```

Install the resulting archive in your application using its package manager. The plugin uses one English house style with explicit locale selection. Other or unknown languages pass through; mixed-language replies should opt out. Code, math, URLs, and link destinations stay literal. Keep original Markdown for storage and original-text copying.

## Repository

- `packages/chat-typography`: punctuation plugin, optional Typehug spacing, and optional hanging helper/CSS.
- `apps/playground`: the React/Vite landing page and comparison. Its styling is plain CSS.
- `examples/chat-integration`: Vercel AI SDK and Cloudflare Agents compatibility fixture, using AI Elements, shadcn, and Tailwind.
- `tests` and `validation`: engine, renderer, and Worker tests; editorial cases and recorded measurements.
- `scripts`: package verification and performance measurements.
- `worker`: static-site serving and the secondary-domain redirect.

## Verify

```sh
npm run check
npm run test:landing
npm run test:chat-integration
```

`check` builds both apps and the package, checks types, runs unit/renderer tests, and installs the packed package in a fresh consumer. Browser tests use local recorded responses. See [contributing](CONTRIBUTING.md), [release preparation](docs/releasing.md), and the [hardening report](HARDENING_TEST.md).

After building the package, `npm run bench:chat` measures the transformation and bundle size; `npm run bench` measures Streamdown server rendering. Measurements depend on the machine and do not promise whole-app performance.

MIT licensed. Optional spacing uses [Typehug](https://github.com/alexszczurek/typehug); its attribution is included with the package. The site bundles Inter under its included SIL Open Font License.

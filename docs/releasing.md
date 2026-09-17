# Release preparation

`@typograph/chat@0.0.0` is a private, unpublished candidate. Confirm the final registry name and access before changing publication settings or advertising a public install command.

1. Update the package version, workspace dependencies, lockfile, and changelog together.
2. Run `npm ci`, `npm run check`, `npm run test:landing`, and `npm run test:chat-integration`.
3. Review `release/typograph-chat-<version>.tgz` and `release/chat-package-check.json`. The clean-consumer check creates them after verifying exports, declared dependencies, public TypeScript types, and the file allowlist. Inspect `npm pack --dry-run -w @typograph/chat` for unintended files.
4. When the engine changes, run `npm run bench:chat`; use `npm run bench` for a Streamdown server-render comparison. Review real streamed replies, narrow screens, zoom, and selection/copy behavior before release.
5. Publish only after the chosen registry name, access, version, and artifact are verified. Check an independent public installation before replacing source-install instructions on the site.
6. For an authorized site deployment, `npm run build` produces `apps/playground/dist`. The existing Wrangler configuration targets `typograph.dev` and `typograph.ing`; verify the account and intended zones before deploying. Afterward check the root page, assets, integration guide, comparison, clipboard feedback, mobile layout, and redirect.

The secondary domain redirects to `typograph.dev`, preserving path and query. Missing assets remain 404 responses. Configuration is not evidence of deployment.

The package ships JavaScript, TypeScript declarations, optional hanging CSS, documentation, and license notices. It contains no fonts or site UI. Keep credentials and development artifacts out of release archives. No package or site is published by the verification commands.

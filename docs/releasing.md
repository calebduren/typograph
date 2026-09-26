# Releasing Typograph

The public package is `@calebduren/typograph`. The package and website share this repository but release independently. Only `packages/chat-typography` is published to npm; the application and integration workspaces remain private.

1. Update the package version, workspace dependencies, lockfile, and changelog together.
2. Run `npm ci`, `npm run check`, `npm run test:landing`, and `npm run test:chat-integration`.
3. Run `npm run pack:release`. It rebuilds the package and runs the clean-consumer check, which verifies exports, declared dependencies, public TypeScript types, and the file allowlist. It then copies the verified tarball to `release/calebduren-typograph-<version>.tgz` and prints its sha1 and sha512 checksums. It refuses if that archive already exists or the version is already on the registry. Review the archive and `release/check/chat-package-check.json`, and inspect `npm pack --dry-run -w @calebduren/typograph` for unintended files. `npm run check` packs to `release/check/` and never touches release archives.
4. When the engine changes, run `npm run bench:chat`; use `npm run bench` for a Streamdown server-render comparison. Review real streamed replies, narrow screens, zoom, and selection/copy behavior before release.
5. Publish the archive from step 3 with `npm publish ./release/calebduren-typograph-<version>.tgz --access public`. Authenticate with the maintainer account and complete npm's two-factor challenge. Compare `npm view @calebduren/typograph@<version> version dist.shasum dist.integrity` with the checksums step 3 printed, then verify an independent public installation before deploying new install instructions. The archive is the record of the release; never rebuild it.
6. Commit and push the release source. Include new source files as well as modified files. Keep the npm README's source links valid.
7. For an authorized site deployment, `npm run build` produces `apps/playground/dist`. The existing Wrangler configuration targets `typograph.dev` and `typograph.ing`; verify the account and intended zones before `npx wrangler deploy`. Afterward check the root page, assets, integration guide, comparison, clipboard feedback, mobile layout, and redirect. Local browser checks exercise the built assets and headers through Wrangler; verify the live host separately.

The secondary domain redirects to `typograph.dev`, preserving path and query. Missing assets remain 404 responses. Configuration is not evidence of deployment.

Browser icons, home-screen icons, and both social-preview cards use the supplied brand exports. See [the asset map](../assets/brand/README.md) for their locations and provenance. Replace social cards with fresh design exports; run `npm run build:icons` after replacing the small favicon PNGs. The larger master exports remain outside the deployed site. The `.assetsignore` file excludes build manifests and source maps from deployment.

The package ships JavaScript, TypeScript declarations, optional hanging CSS, documentation, and license notices. It contains no fonts or site UI. Keep credentials and development artifacts out of release archives. No package or site is published by the verification commands.

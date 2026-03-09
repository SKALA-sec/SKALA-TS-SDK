# Publishing Skala To npm

## Preconditions

1. Confirm `sdk/package.json` version is correct.
2. Confirm the repository secret `NPM_TOKEN` is present for CI-driven publishes.
3. Authenticate locally with the npm account that owns the `skala` package.
4. Run `bun --cwd sdk run test`.
5. Run `bun --cwd sdk run typecheck`.
6. Run `bun --cwd sdk run build`.
7. Run `npm publish --dry-run --provenance --access public` inside `sdk/`.
8. Run `mkdir -p /tmp/skala-pack && npm_config_cache=/tmp/skala-npm-cache npm pack --pack-destination /tmp/skala-pack >/dev/null`.
9. Run `tar -tf /tmp/skala-pack/skala-*.tgz` and confirm the tarball only contains `dist/`, `README.md`, and expected package metadata.

Optional sanity check:

```bash
cd sdk
npm publish --dry-run --provenance --access public
mkdir -p /tmp/skala-pack
npm_config_cache=/tmp/skala-npm-cache npm pack --pack-destination /tmp/skala-pack >/dev/null
tar -tf /tmp/skala-pack/skala-*.tgz
```

## Publish

```bash
cd sdk
npm publish --provenance --access public
```

## Post-publish

1. Install the published package in a clean sample app.
2. Verify `createSkalaClient` imports from `skala`.
3. Tag the release with `sdk-v<version>` if the GitHub workflow should mirror the manual publish.

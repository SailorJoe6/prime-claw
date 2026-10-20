# Plugin-local YAML build (Docker only)

The plugin ships a self-contained Node-target bundle of `yaml@2.9.0` (ISC),
matching the parser and default options used by the supported source release.
It has no runtime package imports (only Node builtins `process` and `buffer`). It does not resolve Prime Agent or an ambient
`yaml` installation. Installation copies the checked-in bundle, license and
provenance through the normal asset inventory; no install hook runs npm.

Regenerate from the repository root with Docker (no host Node or npm install):

```bash
mkdir -p .test-results/yaml-vendor
# Use an image with Node >=22.8 and npm. Only the input directory and the
# explicit output directory are mounted; no home, credentials or Docker socket.
docker run --rm --entrypoint sh \
  --mount type=bind,src="$PWD/scripts/vendor-plugin-yaml",dst=/inputs,readonly \
  --mount type=bind,src="$PWD/.test-results/yaml-vendor",dst=/out \
  node:22-bookworm-slim -c \
  'mkdir /tmp/build; cp /inputs/* /tmp/build/; cd /tmp/build; npm ci --ignore-scripts --no-audit --no-fund && node build.mjs /out'
```

Review the output and copy only `yaml.cjs`, `LICENSE` and `provenance.json` to
`src/prime-agent-plugin/extension-support/vendor/yaml/`. The lockfile fixes the
parser, bundler and optional platform packages with npm tarball integrity.
The generated provenance records lock and output hashes. `build.mjs` refuses
any external package imports. Run the container gates after copying output.

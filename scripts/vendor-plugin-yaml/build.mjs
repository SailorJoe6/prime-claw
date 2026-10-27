// Run only in Docker, from the scratch directory containing npm ci's output.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { isBuiltin } from "node:module";
const out = process.argv[2];
if (!out) throw new Error("output directory required");
mkdirSync(out, { recursive: true });
const result = await build({
  stdin: { contents: 'export { parse } from "yaml";', resolveDir: process.cwd(), sourcefile: "yaml-entry.mjs" },
  bundle: true, format: "cjs", platform: "node", target: "node22",
  treeShaking: true, write: false, metafile: true,
  banner: { js: "// Generated: yaml 2.9.0 / esbuild 0.28.1. See provenance.json and LICENSE." },
});
const imports = [...new Set(Object.values(result.metafile.outputs).flatMap(output => output.imports.map(item => item.path)))].sort();
if (imports.some(specifier => !isBuiltin(specifier))) {
  throw new Error("YAML bundle must not import runtime packages: " + JSON.stringify(imports));
}
const bundle = result.outputFiles[0].contents;
const hash = value => createHash("sha256").update(value).digest("hex");
writeFileSync(join(out, "yaml.cjs"), bundle);
writeFileSync(join(out, "LICENSE"), readFileSync("node_modules/yaml/LICENSE"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
writeFileSync(join(out, "provenance.json"), JSON.stringify({
  package: "yaml", version: "2.9.0", license: "ISC",
  repository: "https://github.com/eemeli/yaml",
  tarball: lock.packages["node_modules/yaml"].resolved,
  integrity: lock.packages["node_modules/yaml"].integrity,
  bundler: "esbuild", bundlerVersion: "0.28.1",
  lockSha256: hash(readFileSync("package-lock.json")),
  bundleSha256: hash(bundle), runtimeImports: imports,
  licenseSha256: hash(readFileSync("node_modules/yaml/LICENSE")),
  inputFileSha256: Object.fromEntries(Object.keys(result.metafile.inputs)
    .filter(path => path.startsWith("node_modules/yaml/"))
    .sort().map(path => [path, hash(readFileSync(path))])),
}, null, 2) + "\n");

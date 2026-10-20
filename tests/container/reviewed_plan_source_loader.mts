/** Public source loader, with its default Jiti resolution (no alias override). */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

const source = "/opt/prime-agent";
const git = (...args: string[]) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
const expected = JSON.parse(process.env.SOURCE_LOADER_IDENTITY!);
assert.equal(git("remote", "get-url", "origin"), "https://github.com/SailorJoe6/prime-agent.git");
assert.equal(git("cat-file", "-t", `refs/tags/${expected.tag}`), "tag");
assert.equal(git("rev-parse", `refs/tags/${expected.tag}`), expected["tag-object"]);
assert.equal(git("rev-parse", `refs/tags/${expected.tag}^{commit}`), expected.commit);
assert.equal(git("rev-parse", "HEAD"), expected.commit);
assert.equal(git("rev-parse", "HEAD^{tree}"), expected.tree);
assert.equal(createHash("sha256").update(readFileSync(`${source}/package-lock.json`)).digest("hex"), expected["lock-sha256"]);
assert.equal(git("status", "--porcelain"), "");
assert.equal(git("describe", "--tags", "--always", "--dirty"), expected.tag);
const [major, minor] = process.versions.node.split(".").map(Number);
assert.ok(major > 22 || (major === 22 && minor >= 8));
assert.equal(process.env.TSX_TSCONFIG_PATH, `${source}/tsconfig.json`);

// A type-only control distinguishes a broken loader fixture from the regression.
const control = "/tmp/loader-control.ts";
writeFileSync(control, `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function control(pi: ExtensionAPI) {
  pi.registerCommand("loader-control", { description: "fixture control", handler: async () => {} });
}`);
const result = await discoverAndLoadExtensions(
  [control, "/candidate/extensions/reviewed-plan.ts"],
  "/tmp/cwd", process.env.PRIME_AGENT_CODING_AGENT_DIR,
);
console.log("SOURCE_LOADER_RESULT=" + JSON.stringify({
  identity: expected,
  errors: result.errors,
  loaded: result.extensions.map((extension) => ({
    path: extension.path,
    commands: [...extension.commands.keys()].sort(),
    tools: [...extension.tools.keys()].sort(),
  })),
}));

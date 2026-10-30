import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, renameSync, symlinkSync, unlinkSync, realpathSync, cpSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  ProcessCommandRunner,
  acceptProjectOverride,
  loadAssetInventory,
  reconcilePrimeClawProject,
  resetProjectAsset,
  ensureOrcaRegistration,
  isOrcaRegistered,
  resolveNearestProjectRoot,
  episodeWorktreeActivity,
  hasActiveLegacyPlanFiles,
} from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { createProjectInitializationExtension, summarizeReconcile } from "../src/prime-agent-plugin/extensions/project-initialization.ts";
import { prepareTaskHistoryWorkspace, TASK_HISTORY_REF } from "../src/prime-agent-plugin/extension-support/task-history-workspace.ts";
import { requestTemplateReview } from "../src/prime-agent-plugin/extension-support/template-review.ts";
import { writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";
import {
  LEGACY_SPECIFICATION_INVENTORY,
  assertGrandfatheredLegacySpecification,
  assertGrandfatheredLegacySpecificationFile,
  reconcileLegacySpecificationInventory,
} from "../src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts";

const PLUGIN = resolve("src/prime-agent-plugin");
function git(cwd, ...args) { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }); }
function repo(t, parent = mkdtempSync(join(tmpdir(), "pc-init-"))) {
  const root = join(parent, "repo"); mkdirSync(root, { recursive: true }); git(root, "init", "-q", "-b", "main"); git(root,"config","user.name","Test"); git(root,"config","user.email","test@example.invalid"); writeFileSync(join(root,"README.md"),"fixture\n"); git(root,"add","README.md"); git(root,"commit","-qm","fixture"); t.after(()=>{}); return root;
}
function activeOwnership(ownerSessionId, worktree, overrides = {}) {
  return {
    version: 2, status: "active", operationId: `operation-${ownerSessionId}`, engine: "local", ownerSessionId,
    taskId: `TASK-${ownerSessionId}`, taskPath: `backlog/tasks/${ownerSessionId}.md`, baseRef: "a".repeat(40),
    createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    worktree, branch: `episode/${ownerSessionId}`, head: "b".repeat(40), episodeId: `episode-${ownerSessionId}`,
    episodeSessionFile: join(worktree, `${ownerSessionId}.jsonl`), episodeActiveSessionId: `route-${ownerSessionId}`,
    ...overrides,
  };
}

class Runner {
  constructor(registrations = []) { this.registrations = registrations; this.adds = 0; this.diffs = 0; this.orcaError = null; }
  run(command,args,options={}) {
    if (command === "git") {
      try { return {stdout:execFileSync(command,args,{cwd:options.cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}),stderr:"",status:0}; }
      catch(e) { const r={stdout:String(e.stdout??""),stderr:String(e.stderr??e.message),status:Number.isInteger(e.status)?e.status:1}; if(!options.allowFailure) throw e; return r; }
    }
    if (command === "bd") return { stdout: "", stderr: "no beads fixture", status: 1 };
    if (command === "backlog") {
      if (args[0] === "init") {
        this.providerInitArgs = this.providerInitArgs ?? [];
        this.providerInitArgs.push(args);
        mkdirSync(join(options.cwd, ".backlog"), { recursive: true });
        writeFileSync(join(options.cwd, ".backlog", "config.yml"), [
          `project_name: "${args[1]}"`,
          'default_status: "To Do"',
          'statuses: ["To Do", "In Progress", "Done"]',
          "remote_operations: true",
          "",
        ].join("\n"));
        this.providerInits = (this.providerInits ?? 0) + 1;
        return { stdout: "initialized\n", stderr: "", status: 0 };
      }
      if (args[0] === "--version") return { stdout: "1.53.0\n", stderr: "", status: 0 };
      if (args.join(" ") === "config get statuses") {
        try {
          const config = readFileSync(join(options.cwd, ".backlog", "config.yml"), "utf8");
          const match = config.match(/^statuses: \[(.*)\]$/m);
          if (match) return { stdout: match[1].split(",").map((entry) => entry.trim().replace(/^"|"$/g, "")).join(", ") + "\n", stderr: "", status: 0 };
        } catch {}
        return { stdout: "", stderr: "no statuses", status: 1 };
      }
      return { stdout: "", stderr: "no backlog fixture", status: 1 };
    }
    if (command !== "orca") throw Error(`unexpected ${command}`);
    if (this.orcaError) return {stdout:"",stderr:this.orcaError,status:1};
    if (args[0] === "repo" && args[1] === "list") return {stdout:JSON.stringify({result:{repos:this.registrations}}),stderr:"",status:0};
    if (args[0] === "repo" && args[1] === "add") { this.adds++; const path=args[args.indexOf("--path")+1]; this.registrations.push({id:`repo-${this.adds}`,path,displayName:"kept"}); return {stdout:JSON.stringify({ok:true}),stderr:"",status:0}; }
    if (args[0] === "file" && args[1] === "diff") { this.diffs++; return {stdout:JSON.stringify({opened:true}),stderr:"",status:0}; }
    throw Error(`unexpected orca ${args.join(" ")}`);
  }
}

test("explicit initialization freezes only supported unfinished future specifications", (t) => {
  const root = repo(t);
  for (const [slug, specification] of [["alpha", "accepted alpha\n"], ["beta", "accepted beta\n"]]) {
    const folder = join(root, ".ralph", "plans", "future", slug);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "SPECIFICATION.md"), specification);
    if (slug === "alpha") writeFileSync(join(folder, "EXECUTION_PLAN.md"), "living plan v1\n");
  }
  const archive = join(root, ".ralph", "plans", "archive", "done");
  mkdirSync(archive, { recursive: true });
  writeFileSync(join(archive, "SPECIFICATION.md"), "completed history\n");

  const created = reconcileLegacySpecificationInventory(root, "initialize");
  assert.deepEqual(created, {
    status: "created", path: LEGACY_SPECIFICATION_INVENTORY, accepted: 2, violations: [],
  });
  const inventoryPath = join(root, LEGACY_SPECIFICATION_INVENTORY);
  const initialBytes = readFileSync(inventoryPath, "utf8");
  const inventory = JSON.parse(initialBytes);
  assert.deepEqual(inventory.specifications.map((item) => item.location), [
    ".ralph/plans/future/alpha", ".ralph/plans/future/beta",
  ]);
  assert.equal(inventory.specifications.some((item) => item.location.includes("archive")), false);
  assert.equal(inventory.specifications[0].specificationSha256, createHash("sha256").update("accepted alpha\n").digest("hex"));

  writeFileSync(join(root, ".ralph", "plans", "future", "alpha", "EXECUTION_PLAN.md"), "living plan v2\n");
  const verified = reconcileLegacySpecificationInventory(root, "initialize");
  assert.equal(verified.status, "verified");
  assert.deepEqual(verified.violations, []);
  assert.equal(readFileSync(inventoryPath, "utf8"), initialBytes);
  assert.doesNotThrow(() => assertGrandfatheredLegacySpecification(root, ".ralph/plans/future/alpha"));
  mkdirSync(join(root, ".ralph", "plans", "archive", "alpha"), { recursive: true });
  assert.throws(() => assertGrandfatheredLegacySpecification(root, ".ralph/plans/future/alpha"), /completed legacy history/);
});

test("explicit inventory captures source-absent active and blocked version-one ownership only", (t) => {
  const root = repo(t);
  for (const [ownerSessionId, slug, placement, specification] of [
    ["active-owner", "alpha", ".ralph/plans", "active accepted\n"],
    ["blocked-owner", "beta", ".ralph/plans/blocked", "blocked accepted\n"],
    ["inactive-owner", "done", ".ralph/plans", "completed\n"],
  ]) {
    const worktree = join(dirname(root), `${slug}-worktree`);
    const plans = join(worktree, placement); mkdirSync(plans, { recursive: true });
    writeFileSync(join(plans, "SPECIFICATION.md"), specification);
    writeFileSync(join(plans, "EXECUTION_PLAN.md"), "living plan\n");
    writeEpisodeOwnership(root, {
      version: 1, status: ownerSessionId === "inactive-owner" ? "inactive" : "active",
      operationId: `${slug}-operation`, engine: "local", ownerSessionId,
      sourceLocation: `.ralph/plans/future/${slug}`, slug, baseRef: "base", bundleDigest: "0".repeat(64),
      createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
      worktree, branch: `episode/${slug}`, head: "head", episodeId: `${slug}-episode`,
      episodeSessionFile: join(worktree, `${slug}.jsonl`), episodeActiveSessionId: `${slug}-route`,
    });
  }
  const completedSource = join(root, ".ralph/plans/future/done");
  mkdirSync(completedSource, { recursive: true });
  writeFileSync(join(completedSource, "SPECIFICATION.md"), "completed\n");
  const created = reconcileLegacySpecificationInventory(root, "initialize");
  assert.equal(created.status, "created"); assert.equal(created.accepted, 2);
  const inventory = JSON.parse(readFileSync(join(root, LEGACY_SPECIFICATION_INVENTORY), "utf8"));
  assert.deepEqual(inventory.specifications.map((item) => item.location), [
    ".ralph/plans/future/alpha", ".ralph/plans/future/beta",
  ]);
  assert.throws(() => assertGrandfatheredLegacySpecification(root, ".ralph/plans/future/done"), /completed legacy history/);
  assert.doesNotThrow(() => assertGrandfatheredLegacySpecificationFile(
    root, ".ralph/plans/future/alpha", join(dirname(root), "alpha-worktree", ".ralph/plans/SPECIFICATION.md"),
  ));
});

test("explicit inventory rejects a symlinked owned .ralph ancestor before enrollment", (t) => {
  const root = repo(t), location = ".ralph/plans/future/alpha";
  const worktree = join(dirname(root), "alpha-owned-symlink");
  const outsideRalph = join(dirname(root), "external-alpha-ralph");
  mkdirSync(worktree, { recursive: true });
  mkdirSync(join(outsideRalph, "plans"), { recursive: true });
  writeFileSync(join(outsideRalph, "plans", "SPECIFICATION.md"), "external accepted bytes\n");
  writeFileSync(join(outsideRalph, "plans", "EXECUTION_PLAN.md"), "external plan\n");
  symlinkSync(outsideRalph, join(worktree, ".ralph"));
  writeEpisodeOwnership(root, {
    version: 1, status: "active", operationId: "alpha-operation", engine: "local", ownerSessionId: "alpha-owner",
    sourceLocation: location, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
    worktree, branch: "episode/alpha", head: "head", episodeId: "alpha-episode",
    episodeSessionFile: join(worktree, "episode.jsonl"), episodeActiveSessionId: "alpha-route",
  });

  const result = reconcileLegacySpecificationInventory(root, "initialize");
  assert.equal(result.status, "blocked");
  assert.match(result.detail, /legacy ownership \.ralph root must be a real directory/);
  assert.equal(existsSync(join(root, LEGACY_SPECIFICATION_INVENTORY)), false);
});

test("completed history is excluded before residual future specification bytes are required", (t) => {
  const root = repo(t), location = ".ralph/plans/future/alpha";
  mkdirSync(join(root, location), { recursive: true });
  const archive = join(root, ".ralph", "plans", "archive", "alpha");
  mkdirSync(archive, { recursive: true });
  writeFileSync(join(archive, "SPECIFICATION.md"), "completed specification\n");
  writeFileSync(join(archive, "EXECUTION_PLAN.md"), "completed plan\n");
  writeEpisodeOwnership(root, {
    version: 1, status: "inactive", operationId: "inactive-operation", engine: "local", ownerSessionId: "inactive-owner",
    sourceLocation: location, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
    worktree: root, branch: "episode/inactive-alpha", head: "head", episodeId: "inactive-alpha-episode",
    episodeSessionFile: join(root, "inactive.jsonl"), episodeActiveSessionId: "inactive-route",
  });

  const created = reconcileLegacySpecificationInventory(root, "initialize");
  assert.deepEqual(created, {
    status: "created", path: LEGACY_SPECIFICATION_INVENTORY, accepted: 0, violations: [],
  });
  const inventory = JSON.parse(readFileSync(join(root, LEGACY_SPECIFICATION_INVENTORY), "utf8"));
  assert.deepEqual(inventory.specifications, []);
  const verified = reconcileLegacySpecificationInventory(root, "verify");
  assert.equal(verified.status, "verified");
  assert.deepEqual(verified.violations, []);
  assert.throws(() => assertGrandfatheredLegacySpecification(root, location), /completed legacy history/);

  const activeWorktree = join(dirname(root), "active-alpha-worktree");
  mkdirSync(join(activeWorktree, ".ralph", "plans"), { recursive: true });
  writeFileSync(join(activeWorktree, ".ralph", "plans", "SPECIFICATION.md"), "active specification\n");
  writeFileSync(join(activeWorktree, ".ralph", "plans", "EXECUTION_PLAN.md"), "active plan\n");
  writeEpisodeOwnership(root, {
    version: 1, status: "active", operationId: "active-operation", engine: "local", ownerSessionId: "active-owner",
    sourceLocation: location, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
    worktree: activeWorktree, branch: "episode/active-alpha", head: "head", episodeId: "active-alpha-episode",
    episodeSessionFile: join(activeWorktree, "active.jsonl"), episodeActiveSessionId: "active-route",
  });
  const conflict = reconcileLegacySpecificationInventory(root, "verify");
  assert.equal(conflict.status, "blocked");
  assert.match(conflict.detail, /both completed and non-terminal legacy ownership/);
});

test("explicit inventory blocks disagreement between future and owned specification", (t) => {
  const root = repo(t), location = ".ralph/plans/future/alpha";
  const future = join(root, location); mkdirSync(future, { recursive: true });
  writeFileSync(join(future, "SPECIFICATION.md"), "future bytes\n");
  const worktree = join(dirname(root), "alpha-owned");
  const plans = join(worktree, ".ralph/plans"); mkdirSync(plans, { recursive: true });
  writeFileSync(join(plans, "SPECIFICATION.md"), "different owned bytes\n");
  writeFileSync(join(plans, "EXECUTION_PLAN.md"), "plan\n");
  writeEpisodeOwnership(root, {
    version: 1, status: "active", operationId: "alpha-operation", engine: "local", ownerSessionId: "owner",
    sourceLocation: location, slug: "alpha", baseRef: "base", bundleDigest: "0".repeat(64),
    createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
    worktree, branch: "episode/alpha", head: "head", episodeId: "episode",
    episodeSessionFile: join(worktree, "episode.jsonl"), episodeActiveSessionId: "route",
  });
  const result = reconcileLegacySpecificationInventory(root, "initialize");
  assert.equal(result.status, "blocked"); assert.match(result.detail, /future and owned specifications disagree/);
  assert.equal(existsSync(join(root, LEGACY_SPECIFICATION_INVENTORY)), false);
});

test("inventory rejects unsafe candidate paths and noncanonical durable rows", (t) => {
  const unsafe = repo(t, mkdtempSync(join(tmpdir(), "pc-init-unsafe-")));
  const future = join(unsafe, ".ralph", "plans", "future"); mkdirSync(future, { recursive: true });
  const external = mkdtempSync(join(tmpdir(), "pc-legacy-external-"));
  writeFileSync(join(external, "SPECIFICATION.md"), "external\n");
  symlinkSync(external, join(future, "alpha"), "dir");
  const unsafeResult = reconcileLegacySpecificationInventory(unsafe, "initialize");
  assert.equal(unsafeResult.status, "blocked"); assert.match(unsafeResult.detail, /must be a real directory/);

  const unsafeParent = repo(t, mkdtempSync(join(tmpdir(), "pc-init-unsafe-parent-")));
  const outsideRalph = join(unsafeParent, "outside-ralph");
  const externalFuture = join(outsideRalph, "plans", "future", "alpha");
  mkdirSync(externalFuture, { recursive: true }); writeFileSync(join(externalFuture, "SPECIFICATION.md"), "external parent\n");
  symlinkSync(outsideRalph, join(unsafeParent, ".ralph"), "dir");
  const parentResult = reconcileLegacySpecificationInventory(unsafeParent, "initialize");
  assert.equal(parentResult.status, "blocked"); assert.match(parentResult.detail, /legacy \.ralph root must be a real directory/);

  const unsafeArchive = repo(t, mkdtempSync(join(tmpdir(), "pc-init-unsafe-archive-")));
  const outsideArchive = join(unsafeArchive, "outside-archive"); mkdirSync(outsideArchive);
  mkdirSync(join(unsafeArchive, ".ralph", "plans"), { recursive: true });
  symlinkSync(outsideArchive, join(unsafeArchive, ".ralph", "plans", "archive"), "dir");
  const archiveResult = reconcileLegacySpecificationInventory(unsafeArchive, "initialize");
  assert.equal(archiveResult.status, "blocked"); assert.match(archiveResult.detail, /archive root must be a real directory/);

  const malformed = repo(t, mkdtempSync(join(tmpdir(), "pc-init-malformed-")));
  mkdirSync(join(malformed, ".prime-claw"), { recursive: true });
  writeFileSync(join(malformed, LEGACY_SPECIFICATION_INVENTORY), JSON.stringify({
    schemaVersion: 1,
    specifications: [{ location: ".ralph/plans/future/alpha", specificationSha256: "0".repeat(64), extra: true }],
  }));
  const malformedResult = reconcileLegacySpecificationInventory(malformed, "verify");
  assert.equal(malformedResult.status, "blocked"); assert.match(malformedResult.detail, /invalid location or digest/);
});

test("routine verification never enrolls or rebaselines legacy specifications", (t) => {
  const root = repo(t);
  const archive = join(root, ".ralph", "plans", "archive", "done");
  mkdirSync(archive, { recursive: true });
  writeFileSync(join(archive, "SPECIFICATION.md"), "completed history\n");
  assert.deepEqual(reconcileLegacySpecificationInventory(root, "verify"), {
    status: "not-required", path: LEGACY_SPECIFICATION_INVENTORY, accepted: 0, violations: [],
  });
  assert.equal(existsSync(join(root, LEGACY_SPECIFICATION_INVENTORY)), false);

  const alpha = join(root, ".ralph", "plans", "future", "alpha");
  mkdirSync(alpha, { recursive: true });
  writeFileSync(join(alpha, "SPECIFICATION.md"), "accepted\n");
  const required = reconcileLegacySpecificationInventory(root, "verify");
  assert.equal(required.status, "required");
  assert.deepEqual(required.violations, [{ location: ".ralph/plans/future/alpha", reason: "not-grandfathered" }]);
  assert.equal(existsSync(join(root, LEGACY_SPECIFICATION_INVENTORY)), false);

  reconcileLegacySpecificationInventory(root, "initialize");
  const frozenBytes = readFileSync(join(root, LEGACY_SPECIFICATION_INVENTORY), "utf8");
  writeFileSync(join(alpha, "SPECIFICATION.md"), "materially revised\n");
  const beta = join(root, ".ralph", "plans", "future", "beta");
  mkdirSync(beta, { recursive: true });
  writeFileSync(join(beta, "SPECIFICATION.md"), "new legacy work\n");
  const drift = reconcileLegacySpecificationInventory(root, "verify");
  assert.equal(drift.status, "verified");
  assert.deepEqual(drift.violations, [
    { location: ".ralph/plans/future/alpha", reason: "specification-changed" },
    { location: ".ralph/plans/future/beta", reason: "not-grandfathered" },
  ]);
  assert.equal(readFileSync(join(root, LEGACY_SPECIFICATION_INVENTORY), "utf8"), frozenBytes);
  assert.throws(() => assertGrandfatheredLegacySpecification(root, ".ralph/plans/future/alpha"), /changed after grandfathering/);
  assert.throws(() => assertGrandfatheredLegacySpecification(root, ".ralph/plans/future/beta"), /not grandfathered/);
});

test("inventory exposes sixteen manifest-authoritative project assets including retained compatibility",()=>{
  const inv=loadAssetInventory(PLUGIN); assert.equal(inv.schemaVersion,2); assert.equal(inv.assets.length,17); assert.equal(new Set(inv.assets.map(x=>x.id)).size,17);
  assert.deepEqual(inv.assets.filter(x=>x.exposure==="discoverable").map(x=>x.id).sort(),[
    "project-skill-blocked","project-skill-design","project-skill-design-legacy","project-skill-execute","project-skill-prepare","project-skill-spec-it-out","project-skill-spec-it-out-legacy",
  ]);
  for (const id of ["project-skill-design-legacy","project-skill-spec-it-out-legacy"]) assert.equal(inv.assets.find(x=>x.id===id).migrateFrom,undefined);
  for (const prefix of ["project-workflow-plan-task","project-workflow-implement-task"]) { const taskNative=inv.assets.filter(x=>x.id.startsWith(prefix)); assert.equal(taskNative.length,2); assert.ok(taskNative.every(x=>x.migrateFrom===undefined)); }
});

test("retired managed project assets are pruned from prior ownership", t => {
  const plugin=join(mkdtempSync(join(tmpdir(),"pc-plugin-retire-")),"plugin"); cpSync(PLUGIN,plugin,{recursive:true});
  const root=repo(t), runner=new Runner(); reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const assetId="project-skill-prepare", target=join(root,".agents/skills/prepare/SKILL.md"); assert.equal(existsSync(target),true);
  const inventoryPath=join(plugin,"asset-inventory.json"), inventory=JSON.parse(readFileSync(inventoryPath,"utf8"));
  const row=inventory.assets.find(asset=>asset.id===assetId); inventory.assets=inventory.assets.filter(asset=>asset.id!==assetId);
  writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+"\n"); unlinkSync(join(plugin,row.source));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  assert.equal(result.items.find(item=>item.assetId===assetId).action,"retired"); assert.equal(existsSync(target),false);
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(root,".prime-claw/templates.json"),"utf8")).assets,assetId),false);
});

test("retired customized project assets are preserved and released", t => {
  const plugin=join(mkdtempSync(join(tmpdir(),"pc-plugin-release-")),"plugin"); cpSync(PLUGIN,plugin,{recursive:true});
  const root=repo(t), runner=new Runner(); reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const assetId="project-skill-prepare", target=join(root,".agents/skills/prepare/SKILL.md"); writeFileSync(target,"operator policy\n");
  const inventoryPath=join(plugin,"asset-inventory.json"), inventory=JSON.parse(readFileSync(inventoryPath,"utf8"));
  const row=inventory.assets.find(asset=>asset.id===assetId); inventory.assets=inventory.assets.filter(asset=>asset.id!==assetId);
  writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+"\n"); unlinkSync(join(plugin,row.source));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const item=result.items.find(value=>value.assetId===assetId); assert.equal(item.action,"preserved"); assert.match(item.reason,/released customized/);
  assert.equal(readFileSync(target,"utf8"),"operator policy\n");
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(root,".prime-claw/templates.json"),"utf8")).assets,assetId),false);
});

test("retained legacy workflow assets initialize and reconcile without replacing customized runtime policy", t => {
  const compatibility = [
    ["project-workflow-plan-prep", "workflows/plan-prep.md", ".prime-claw/workflows/plan-prep.md"],
    ["project-workflow-plan-spec", "workflows/plan-spec.md", ".prime-claw/workflows/plan-spec.md"],
    ["project-workflow-implement-prep", "workflows/implement-prep.md", ".prime-claw/workflows/implement-prep.md"],
    ["project-workflow-implement-spec", "workflows/implement-spec.md", ".prime-claw/workflows/implement-spec.md"],
  ];
  const plugin=join(mkdtempSync(join(tmpdir(),"pc-retained-workflows-")),"plugin"); cpSync(PLUGIN,plugin,{recursive:true});
  const root=repo(t), runner=new Runner(); const first=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const manifestPath=join(root,".prime-claw/templates.json"); let manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
  for (const [id,source,destination] of compatibility) {
    assert.equal(first.items.find(item=>item.assetId===id).action,"created");
    assert.deepEqual(readFileSync(join(root,destination)),readFileSync(join(plugin,source)));
    assert.equal(manifest.assets[id].state,"managed");
    assert.equal(manifest.assets[id].destination,destination);
  }

  const customizedId="project-workflow-plan-spec", customized=compatibility.find(([id])=>id===customizedId);
  writeFileSync(join(root,customized[2]),"operator folder compatibility policy\n");
  for (const [,source] of compatibility) writeFileSync(join(plugin,source),readFileSync(join(plugin,source),"utf8")+"\nupstream compatibility revision\n");
  const second=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner}); manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
  for (const [id,source,destination] of compatibility) {
    const item=second.items.find(value=>value.assetId===id);
    if (id===customizedId) {
      assert.equal(item.action,"preserved"); assert.match(item.reason,/customized/);
      assert.equal(readFileSync(join(root,destination),"utf8"),"operator folder compatibility policy\n");
      assert.equal(manifest.assets[id].state,"customized");
      assert.notEqual(manifest.assets[id].installedSha256,manifest.assets[id].availableUpstreamSha256);
    } else {
      assert.equal(item.action,"updated");
      assert.deepEqual(readFileSync(join(root,destination)),readFileSync(join(plugin,source)));
      assert.equal(manifest.assets[id].state,"managed");
    }
  }

  const fresh=repo(t), freshResult=reconcilePrimeClawProject({cwd:fresh,pluginRoot:plugin,home:dirname(fresh),runner:new Runner()});
  assert.equal(freshResult.items.filter(item=>item.action==="created").length,17);
  for (const [id,source,destination] of compatibility) {
    assert.deepEqual(readFileSync(join(fresh,destination)),readFileSync(join(plugin,source)),id);
    assert.equal(JSON.parse(readFileSync(join(fresh,".prime-claw/templates.json"),"utf8")).assets[id].state,"managed");
  }
});

test("tracker and archive layout do not retire either workflow family or invent Episode identity", t => {
  for (const layout of ["beads-only","archive-only"]) {
    const root=repo(t), runner=new Runner();
    if (layout==="beads-only") { mkdirSync(join(root,".beads"),{recursive:true});writeFileSync(join(root,".beads/issues.jsonl"),"{}\n"); }
    else { const archive=join(root,".ralph/plans/archive/old");mkdirSync(archive,{recursive:true});writeFileSync(join(archive,"SPECIFICATION.md"),"historical\n");writeFileSync(join(archive,"EXECUTION_PLAN.md"),"historical plan\n"); }
    const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
    assert.equal(result.items.filter(item=>item.action==="created").length,17);
    for (const name of ["plan-task.md","implement-task.md","plan-spec.md","implement-spec.md"]) assert.equal(existsSync(join(root,".prime-claw/workflows",name)),true);
    assert.equal(existsSync(join(root,".prime-claw/ownership.json")),false);
    assert.equal(hasActiveLegacyPlanFiles(root),false);
    assert.equal(episodeWorktreeActivity(root,"repository",runner),"inactive");
  }
});

test("root discovery handles nested cwd, nested repo, linked worktree, submodule, and HOME ceiling",t=>{
  const parent=mkdtempSync(join(tmpdir(),"pc-roots-")); const root=repo(t,parent); mkdirSync(join(root,"a","b"),{recursive:true});
  assert.deepEqual(resolveNearestProjectRoot(join(root,"a","b"),parent),{root:realpathSync(root),kind:"repository"});
  const nested=join(root,"nested"); mkdirSync(nested); git(nested,"init","-q","-b","main"); assert.equal(resolveNearestProjectRoot(nested,parent).kind,"nested-repository");
  const linked=join(parent,"linked"); git(root,"worktree","add","-q","-b","linked",linked); assert.equal(resolveNearestProjectRoot(linked,parent).kind,"linked-worktree");
  const child=join(parent,"child"); mkdirSync(child); git(child,"init","-q","-b","main"); git(child,"config","user.name","Test");git(child,"config","user.email","test@example.invalid");writeFileSync(join(child,"x"),"x");git(child,"add","x");git(child,"commit","-qm","x");
  git(root,"-c","protocol.file.allow=always","submodule","add","-q",child,"sub"); assert.equal(resolveNearestProjectRoot(join(root,"sub"),parent).kind,"submodule");
  const home=join(parent,"home"); mkdirSync(home); git(home,"init","-q","-b","main"); mkdirSync(join(home,"plain")); assert.throws(()=>resolveNearestProjectRoot(join(home,"plain"),home),/HOME boundary/);
});

test("fresh reconcile is convergent, registers once, preserves customization, and tracks later upstream",t=>{
  const root=repo(t); const runner=new Runner();
  const first=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true}); assert.equal(first.items.filter(x=>x.action==="created").length,17); assert.equal(first.registration.status,"added"); assert.equal(runner.adds,1); assert.equal(existsSync(join(root,".ralph","plans")),false);
  for (const name of ["plan-task-prep.md","plan-task.md","implement-task-prep.md","implement-task.md"]) assert.equal(readFileSync(join(root,".prime-claw/workflows",name),"utf8"),readFileSync(join(PLUGIN,"workflows",name),"utf8"));
  const manifestPath=join(root,".prime-claw/templates.json"), beforeManifest=statSync(manifestPath,{bigint:true});
  const second=reconcilePrimeClawProject({cwd:join(root,".agents"),pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true}); const afterManifest=statSync(manifestPath,{bigint:true}); assert.equal(second.changed,false); assert.equal(second.manifestWritten,false); assert.equal(afterManifest.ino,beforeManifest.ino); assert.equal(afterManifest.mtimeNs,beforeManifest.mtimeNs); assert.equal(second.registration.status,"reused"); assert.equal(runner.adds,1);
  const target=join(root,".agents/skills/prepare/SKILL.md"); writeFileSync(target,readFileSync(target,"utf8")+"\ncustom\n");
  const third=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}); const item=third.items.find(x=>x.assetId==="project-skill-prepare"); assert.equal(item.action,"preserved"); assert.match(item.reason,/customized/); assert.match(readFileSync(target,"utf8"),/custom/);
  const accepted=acceptProjectOverride(root,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner}); assert.equal(accepted.state,"accepted-override");
  const fourth=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}); assert.equal(fourth.items.find(x=>x.assetId==="project-skill-prepare").reason,"accepted override");
});

test("initialization tool forwards only an explicit unpublished local-only choice", async (t) => {
  const root=repo(t); const runner=new Runner([{id:"local",path:root,displayName:"local"}]); const tools=new Map(); let received=null;
  createProjectInitializationExtension({
    pluginRoot:PLUGIN,home:dirname(root),runner,
    taskHistoryPreparer:(input)=>{received=input; return {status:"prepared",storeDir:join(root,".backlog"),head:"a".repeat(40)};},
  })({registerCommand(){},registerTool(tool){tools.set(tool.name,tool)},on(){}});
  const tool=tools.get("initialize_prime_claw");
  assert.equal(tool.parameters.properties.unpublishedLocalOnly.type,"boolean");
  const ctx={cwd:root,ui:{notify(){}}};
  const result=await tool.execute("local",{action:"reconcile",unpublishedLocalOnly:true},null,null,ctx);
  assert.equal(result.isError,undefined);
  assert.equal(received.unpublishedLocalOnly,true);
});

test("legacy customized skill and known symlink migrate while unsafe collision blocks only its asset",t=>{
  const root=repo(t); const runner=new Runner([{id:"r",path:null}]); runner.registrations[0].path=root;
  mkdirSync(join(root,".ralph/skills/prepare"),{recursive:true}); writeFileSync(join(root,".ralph/skills/prepare/SKILL.md"),"custom legacy\n"); mkdirSync(join(root,".agents/skills"),{recursive:true}); symlinkSync("../../.ralph/skills/prepare",join(root,".agents/skills/prepare"));
  mkdirSync(join(root,".agents/skills/design"),{recursive:true}); mkdirSync(join(root,".agents/skills/design/SKILL.md"));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.equal(lstatSync(join(root,".agents/skills/prepare")).isSymbolicLink(),false); assert.equal(readFileSync(join(root,".agents/skills/prepare/SKILL.md"),"utf8"),"custom legacy\n"); assert.equal(result.items.find(x=>x.assetId==="project-skill-prepare").action,"migrated"); assert.equal(result.items.find(x=>x.assetId==="project-skill-design").action,"blocked"); assert.ok(result.items.some(x=>x.action==="created"));
});

test("lock collision and active Episode skip make no asset mutation",t=>{
  const root=repo(t); const runner=new Runner(); mkdirSync(join(root,".prime-claw")); writeFileSync(join(root,".prime-claw/reconcile.lock"),"busy\n"); assert.throws(()=>reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}),/another Prime Claw reconciliation/); assert.equal(existsSync(join(root,".agents/skills/prepare/SKILL.md")),false);
  execFileSync("rm",["-f",join(root,".prime-claw/reconcile.lock")]); const skipped=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,isActiveEpisode:()=>true}); assert.equal(skipped.skippedActiveEpisode,true); assert.equal(existsSync(join(root,".agents/skills/prepare/SKILL.md")),false);
});

test("skill-led extension exposes only its tool and keeps awaited startup separate",async t=>{
  const root=repo(t); const runner=new Runner([{id:"exact",path:root,displayName:"preserve"}]); const commands=new Map(),tools=new Map(),events=new Map(),notifications=[];
  const pi={registerCommand(n,d){commands.set(n,d)},registerTool(d){tools.set(d.name,d)},on(n,h){events.set(n,h)}};
  createProjectInitializationExtension({
    pluginRoot:PLUGIN,home:dirname(root),runner,
    taskHistoryPreparer:({primaryRoot})=>{
      mkdirSync(join(primaryRoot,".backlog"),{recursive:true});
      writeFileSync(join(primaryRoot,".backlog","config.yml"),[
        'project_name: "fixture"', 'default_status: "In Design"',
        'statuses: ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"]',
        'auto_commit: false', '',
      ].join("\n"));
      return {status:"prepared",storeDir:join(primaryRoot,".backlog"),head:"a".repeat(40)};
    },
  })(pi);
  assert.deepEqual([...commands.keys()],[]); assert.deepEqual([...tools.keys()],["initialize_prime_claw"]); assert.ok(events.has("session_start")); assert.ok(events.has("resources_discover"));
  const ctx={cwd:root,ui:{notify(message,level){notifications.push({message,level})}}}; await events.get("session_start")({},ctx); assert.ok(existsSync(join(root,".prime-claw/templates.json"))); assert.equal(notifications.length,1); const discovered=await events.get("resources_discover")({},ctx); assert.equal(discovered.skillPaths.length,7); assert.ok(discovered.skillPaths.every(path=>path.endsWith("SKILL.md"))); assert.equal(await events.get("resources_discover")({},ctx),undefined); await events.get("session_start")({},ctx); assert.equal(notifications.length,1);
  const result=await tools.get("initialize_prime_claw").execute("id",{action:"reconcile"},null,null,ctx); assert.equal(result.isError,undefined); assert.equal(runner.adds,0);
  const comparison=await tools.get("initialize_prime_claw").execute("review",{action:"review-request",assetId:"project-skill-prepare"},null,null,ctx);
  assert.match(comparison.content[0].text,/Text comparison only/);
  assert.match(comparison.content[0].text,/no textual differences/);
  const customized=join(root,".agents/skills/prepare/SKILL.md");writeFileSync(customized,readFileSync(customized,"utf8")+"\ncustom project policy\n");
  const reconciled=await tools.get("initialize_prime_claw").execute("upgrade",{action:"reconcile"},null,null,ctx);
  assert.match(reconciled.content[0].text,/project-skill-prepare/);assert.match(reconciled.content[0].text,/text comparison of project-skill-prepare/);
  assert.equal(runner.diffs,0);
  const schema=tools.get("initialize_prime_claw").parameters;
  for(const retired of ["review-start","review-complete","review-cancel"])assert.ok(!schema.properties.action.enum.includes(retired));
  assert.equal(schema.properties.confirmedReady,undefined);assert.equal(schema.properties.visibleConfirmed,undefined);

});


test("one owner-worktree record protects the linked Episode snapshot", (t) => {
  const root=repo(t), worktree=join(dirname(root),"episode-worktree");
  git(root,"worktree","add","-q","-b","episode/test",worktree);
  t.after(()=>{try{git(root,"worktree","remove","--force",worktree)}catch{};rmSync(worktree,{recursive:true,force:true})});
  const ownership=join(root,".prime-claw/ownership.json");mkdirSync(dirname(ownership),{recursive:true});
  writeEpisodeOwnership(root,activeOwnership("owner",worktree));
  const result=reconcilePrimeClawProject({cwd:worktree,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(result.skippedActiveEpisode,true);
  assert.equal(existsSync(join(worktree,".prime-claw/templates.json")),false);
  assert.throws(()=>acceptProjectOverride(worktree,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
  assert.throws(()=>resetProjectAsset(worktree,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
  // Text comparison is read-only; mutating override/reset still protect the Episode snapshot.
  assert.equal(existsSync(join(worktree,".prime-claw/template-review.json")),false);
});

test("multi-record ownership detects each exact active worktree", (t) => {
  const root=repo(t), first=join(dirname(root),"episode-first"), second=join(dirname(root),"episode-second");
  git(root,"worktree","add","-q","-b","episode/first",first);
  git(root,"worktree","add","-q","-b","episode/second",second);
  t.after(()=>{
    for (const worktree of [first,second]) { try{git(root,"worktree","remove","--force",worktree)}catch{};rmSync(worktree,{recursive:true,force:true}); }
  });
  writeEpisodeOwnership(root,activeOwnership("first",first));
  writeEpisodeOwnership(root,activeOwnership("second",second));
  assert.equal(episodeWorktreeActivity(first,"linked-worktree",new Runner()),"active");
  assert.equal(episodeWorktreeActivity(second,"linked-worktree",new Runner()),"active");
  assert.equal(episodeWorktreeActivity(root,"repository",new Runner()),"inactive");
});


test("startup verifies but only explicit reconcile creates the legacy allowlist", async (t) => {
  const root=repo(t), future=join(root,".ralph/plans/future/alpha");mkdirSync(future,{recursive:true});writeFileSync(join(future,"SPECIFICATION.md"),"accepted\n");
  const runner=new Runner([{id:"exact",path:root}]),commands=new Map(),tools=new Map(),events=new Map(),notifications=[];
  const pi={registerCommand(n,d){commands.set(n,d)},registerTool(d){tools.set(d.name,d)},on(n,h){events.set(n,h)}};
  createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner})(pi);
  const ctx={cwd:root,ui:{notify(message,level){notifications.push({message,level})}}};
  await events.get("session_start")({},ctx);
  assert.equal(existsSync(join(root,LEGACY_SPECIFICATION_INVENTORY)),false);
  assert.match(notifications.at(-1).message,/legacy-specs=explicit-initialization-required/);
  const result=await tools.get("initialize_prime_claw").execute("explicit",{action:"reconcile"},null,null,ctx);
  assert.equal(result.isError,undefined);assert.equal(existsSync(join(root,LEGACY_SPECIFICATION_INVENTORY)),true);
  assert.equal(result.details.legacySpecifications.status,"created");
});

test("legacy Episode identity requires version-one ownership plus active worktree files", (t) => {
  const root=repo(t), worktree=join(dirname(root),"legacy-episode-worktree");
  git(root,"worktree","add","-q","-b","episode/legacy",worktree);
  t.after(()=>{try{git(root,"worktree","remove","--force",worktree)}catch{};rmSync(worktree,{recursive:true,force:true})});
  const rootPlans=join(root,".ralph/plans");mkdirSync(rootPlans,{recursive:true});writeFileSync(join(rootPlans,"SPECIFICATION.md"),"old in-place spec\n");writeFileSync(join(rootPlans,"IMPLEMENTATION_PLAN.md"),"old in-place plan\n");
  assert.equal(hasActiveLegacyPlanFiles(root),true);
  assert.equal(episodeWorktreeActivity(root,"repository",new Runner()),"inactive");

  const ownership=join(root,".prime-claw/ownership.json");mkdirSync(dirname(ownership),{recursive:true});
  writeEpisodeOwnership(root,{
    version:1,status:"active",operationId:"legacy-operation",engine:"local",ownerSessionId:"legacy-owner",
    sourceLocation:".ralph/plans/future/legacy",slug:"legacy",baseRef:"main",bundleDigest:"0".repeat(64),
    createdAt:"2026-10-18T12:00:00.000Z",updatedAt:"2026-10-18T12:00:00.000Z",
    worktree,branch:"episode/legacy",head:"legacy-head",episodeId:"legacy-episode",
    episodeSessionFile:join(worktree,"legacy.jsonl"),episodeActiveSessionId:"legacy-route",
  });
  assert.equal(episodeWorktreeActivity(root,"repository",new Runner()),"inactive");
  assert.equal(hasActiveLegacyPlanFiles(worktree),false);
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"uncertain");

  const plans=join(worktree,".ralph/plans");mkdirSync(plans,{recursive:true});writeFileSync(join(plans,"SPECIFICATION.md"),"episode spec\n");writeFileSync(join(plans,"IMPLEMENTATION_PLAN.md"),"episode plan\n");
  assert.equal(hasActiveLegacyPlanFiles(worktree),true);
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"active");
  if (process.getuid?.() !== 0) {
    const specification=join(plans,"SPECIFICATION.md");chmodSync(specification,0o000);
    try { assert.equal(hasActiveLegacyPlanFiles(worktree),false); }
    finally { chmodSync(specification,0o600); }
  }
  unlinkSync(join(plans,"IMPLEMENTATION_PLAN.md"));writeFileSync(join(plans,"EXECUTION_PLAN.md"),"retained execution spelling\n");
  assert.equal(hasActiveLegacyPlanFiles(worktree),true);
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"active");

  const identityBefore=readFileSync(ownership,"utf8"), blocked=join(plans,"blocked");mkdirSync(blocked);
  renameSync(join(plans,"SPECIFICATION.md"),join(blocked,"SPECIFICATION.md"));
  renameSync(join(plans,"EXECUTION_PLAN.md"),join(blocked,"EXECUTION_PLAN.md"));
  assert.equal(hasActiveLegacyPlanFiles(worktree),false);
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"uncertain");

  // Exact operator-authorized blocked-pair restoration revives only this same Episode.
  renameSync(join(blocked,"SPECIFICATION.md"),join(plans,"SPECIFICATION.md"));
  renameSync(join(blocked,"EXECUTION_PLAN.md"),join(plans,"EXECUTION_PLAN.md"));
  assert.equal(hasActiveLegacyPlanFiles(worktree),true);
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"active");
  assert.equal(readFileSync(ownership,"utf8"),identityBefore);

  // Candidate review and a bounded revision retain the active pair and identity.
  appendFileSync(join(plans,"EXECUTION_PLAN.md"),"candidate ready for review\n");
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"active");
  appendFileSync(join(plans,"EXECUTION_PLAN.md"),"accepted review revision\n");
  assert.equal(episodeWorktreeActivity(worktree,"linked-worktree",new Runner()),"active");
  assert.equal(readFileSync(ownership,"utf8"),identityBefore);
});

test("legacy symlink is preserved when its source leaf is unsafe or missing", (t) => {
  const root=repo(t), legacyDir=join(root,".ralph/skills/prepare"), link=join(root,".agents/skills/prepare");
  mkdirSync(legacyDir,{recursive:true});mkdirSync(dirname(link),{recursive:true});symlinkSync("../../.ralph/skills/prepare",link);
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(result.items.find(x=>x.assetId==="project-skill-prepare").action,"blocked");
  assert.equal(lstatSync(link).isSymbolicLink(),true);
  assert.equal(existsSync(join(legacyDir,"SKILL.md")),false);
});

test("completed file rename heals an old managed manifest and a dead valid lock", (t) => {
  const root=repo(t), plugin=join(dirname(root),"plugin-copy");cpSync(PLUGIN,plugin,{recursive:true});
  const runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const source=join(plugin,"skills/project-templates/prepare.md"), destination=join(root,".agents/skills/prepare/SKILL.md");
  writeFileSync(source,readFileSync(source,"utf8")+"\nnew upstream generation\n");
  writeFileSync(destination,readFileSync(source));
  writeFileSync(join(root,".prime-claw/reconcile.lock"),JSON.stringify({pid:99999999,createdAt:"2020-01-01T00:00:00Z"}));
  const healed=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  assert.equal(healed.items.find(x=>x.assetId==="project-skill-prepare").action,"recovered");
  const manifest=JSON.parse(readFileSync(join(root,".prime-claw/templates.json"),"utf8"));
  assert.equal(manifest.assets["project-skill-prepare"].state,"managed");
  assert.equal(existsSync(join(root,".prime-claw/reconcile.lock")),false);
});

test("Orca registration rejects malformed and duplicate exact-path rows", () => {
  const root=realpathSync(mkdtempSync(join(tmpdir(),"pc-orca-")));
  const duplicate=new Runner([{id:"a",path:root},{id:"b",path:root}]);
  assert.throws(()=>isOrcaRegistered(root,duplicate),/2 registrations/);
  assert.throws(()=>ensureOrcaRegistration(root,duplicate),/2 registrations/);
  const malformed=new Runner([{id:"a"}]);
  assert.throws(()=>isOrcaRegistered(root,malformed),/malformed repo row/);
});


test("unknown legacy entries and .ralph/plans remain byte-for-byte in place", (t) => {
  const root=repo(t), plan=join(root,".ralph/plans/future/x/SPECIFICATION.md"), unknown=join(root,".ralph/skills/custom/SKILL.md");
  mkdirSync(dirname(plan),{recursive:true});writeFileSync(plan,"opaque plan bytes\n");mkdirSync(dirname(unknown),{recursive:true});writeFileSync(unknown,"unknown policy\n");
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(readFileSync(plan,"utf8"),"opaque plan bytes\n");
  assert.equal(readFileSync(unknown,"utf8"),"unknown policy\n");
  assert.ok(result.legacyRemaining.includes(".ralph/skills/custom/SKILL.md"));
});

test("accepted project override becomes a comparison when upstream advances", (t) => {
  const root=repo(t), plugin=join(dirname(root),"plugin-accepted");cpSync(PLUGIN,plugin,{recursive:true});const runner=new Runner();
  reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const destination=join(root,".agents/skills/prepare/SKILL.md"), source=join(plugin,"skills/project-templates/prepare.md");
  writeFileSync(destination,readFileSync(destination,"utf8")+"\naccepted local policy\n");
  acceptProjectOverride(root,"project-skill-prepare",{pluginRoot:plugin,home:dirname(root),runner});
  writeFileSync(source,readFileSync(source,"utf8")+"\nupstream v2\n");
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:plugin,home:dirname(root),runner});
  const item=result.items.find(x=>x.assetId==="project-skill-prepare");
  assert.equal(item.action,"preserved");assert.match(item.reason,/new upstream/);assert.match(readFileSync(destination,"utf8"),/accepted local policy/);
});


test("linked worktree activity uncertainty fails closed without mutation", (t) => {
  const root=repo(t), linked=join(dirname(root),"uncertain-linked");git(root,"worktree","add","-q","-b","uncertain",linked);
  t.after(()=>{try{git(root,"worktree","remove","--force",linked)}catch{};rmSync(linked,{recursive:true,force:true})});
  const failing=new Runner();const baseRun=failing.run.bind(failing);failing.run=(command,args,options={})=>command==="git"&&args.includes("worktree")?{stdout:"",stderr:"git metadata unavailable",status:1}:baseRun(command,args,options);
  const skipped=reconcilePrimeClawProject({cwd:linked,pluginRoot:PLUGIN,home:dirname(root),runner:failing});
  assert.equal(skipped.skipReason,"uncertain-episode-activity");assert.equal(existsSync(join(linked,".prime-claw/templates.json")),false);
  const ownership=join(root,".prime-claw/ownership.json");mkdirSync(dirname(ownership),{recursive:true});writeFileSync(ownership,"{bad json");
  const malformed=reconcilePrimeClawProject({cwd:linked,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(malformed.skipReason,"uncertain-episode-activity");assert.equal(existsSync(join(linked,".agents/skills/prepare/SKILL.md")),false);
  rmSync(ownership);const outside=join(dirname(root),"ownership-outside.json");writeFileSync(outside,JSON.stringify({status:"active",worktree:linked}));symlinkSync(outside,ownership);
  const unsafe=reconcilePrimeClawProject({cwd:linked,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});assert.equal(unsafe.skipReason,"uncertain-episode-activity");assert.equal(existsSync(join(linked,".prime-claw/templates.json")),false);
});

test("full reconcile stays isolated to nested repo, submodule, and ordinary linked worktree roots", (t) => {
  const parent=mkdtempSync(join(tmpdir(),"pc-topology-reconcile-")), root=repo(t,parent), nested=join(root,"nested");
  mkdirSync(nested);git(nested,"init","-q","-b","main");git(nested,"config","user.name","Test");git(nested,"config","user.email","test@example.invalid");writeFileSync(join(nested,"x"),"x");git(nested,"add","x");git(nested,"commit","-qm","x");
  const linked=join(parent,"linked-full");git(root,"worktree","add","-q","-b","linked-full",linked);
  const child=join(parent,"child-full");mkdirSync(child);git(child,"init","-q","-b","main");git(child,"config","user.name","Test");git(child,"config","user.email","test@example.invalid");writeFileSync(join(child,"x"),"x");git(child,"add","x");git(child,"commit","-qm","x");git(root,"-c","protocol.file.allow=always","submodule","add","-q",child,"sub");
  for (const target of [nested,linked,join(root,"sub")]) { const result=reconcilePrimeClawProject({cwd:target,pluginRoot:PLUGIN,home:parent,runner:new Runner()});assert.equal(result.project.root,realpathSync(target));assert.ok(existsSync(join(target,".prime-claw/templates.json")));assert.ok(existsSync(join(target,".agents/skills/prepare/SKILL.md"))); }
  assert.equal(existsSync(join(root,".prime-claw/templates.json")),false);
});

test("durable reset intent heals customized and accepted-override crash windows", (t) => {
  for (const prior of ["customized","accepted-override"]) {
    const root=repo(t), runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
    const destination=join(root,".agents/skills/prepare/SKILL.md"), source=join(PLUGIN,"skills/project-templates/prepare.md");writeFileSync(destination,readFileSync(destination,"utf8")+`\n${prior}\n`);
    reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
    if(prior==="accepted-override")acceptProjectOverride(root,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner});
    const upstream=readFileSync(source), hash=createHash("sha256").update(upstream).digest("hex"), beforeSha256=createHash("sha256").update(readFileSync(destination)).digest("hex");
    writeFileSync(join(root,".prime-claw/reset-intent.json"),JSON.stringify({schemaVersion:1,action:"reset",assetId:"project-skill-prepare",destination:".agents/skills/prepare/SKILL.md",upstreamSha256:hash,beforeSha256}));writeFileSync(destination,upstream);
    const healed=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
    assert.equal(healed.items.find(x=>x.assetId==="project-skill-prepare").action,"recovered");assert.equal(healed.changed,true);assert.equal(existsSync(join(root,".prime-claw/reset-intent.json")),false);
  }
});


test("durable reset intent resumes safely before the destination rename", (t) => {
  const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  const destination=join(root,".agents/skills/prepare/SKILL.md"),source=join(PLUGIN,"skills/project-templates/prepare.md");writeFileSync(destination,readFileSync(destination,"utf8")+"\ncustom before reset\n");reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  const before=readFileSync(destination),upstream=readFileSync(source),beforeSha256=createHash("sha256").update(before).digest("hex"),upstreamSha256=createHash("sha256").update(upstream).digest("hex");
  writeFileSync(join(root,".prime-claw/reset-intent.json"),JSON.stringify({schemaVersion:1,action:"reset",assetId:"project-skill-prepare",destination:".agents/skills/prepare/SKILL.md",upstreamSha256,beforeSha256}));
  const healed=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});assert.equal(healed.items.find(x=>x.assetId==="project-skill-prepare").action,"recovered");assert.deepEqual(readFileSync(destination),upstream);assert.equal(existsSync(join(root,".prime-claw/reset-intent.json")),false);
});


test("Orca failures are visible while independently safe files reconcile", (t) => {
  const root=repo(t),runner=new Runner();runner.orcaError="orca unavailable";
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true});
  assert.equal(result.registration.status,"unavailable");assert.match(result.registration.error,/orca unavailable/);assert.ok(existsSync(join(root,".agents/skills/prepare/SKILL.md")));
});

test("startup reports Orca lookup failure and does not initialize an unproven project", async (t) => {
  const root=repo(t),runner=new Runner();runner.orcaError="orca lookup unavailable";const events=new Map(),notifications=[];
  createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner})({registerCommand(){},registerTool(){},on(name,handler){events.set(name,handler)}});
  await events.get("session_start")({}, {cwd:root,ui:{notify(message,level){notifications.push({message,level})}}});
  assert.equal(existsSync(join(root,".prime-claw/templates.json")),false);assert.equal(notifications.length,1);assert.match(notifications[0].message,/orca lookup unavailable/);assert.equal(notifications[0].level,"warning");
});


test("dangling project skill and workflow leaf symlinks are preserved as independent blocked assets", (t) => {
  const root=repo(t);for(const relative of [".agents/skills/prepare/SKILL.md",".prime-claw/workflows/handoff.md"]){const path=join(root,relative);mkdirSync(dirname(path),{recursive:true});symlinkSync(join(root,"missing",relative.replaceAll("/","-")),path);}
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  for(const id of ["project-skill-prepare","project-workflow-handoff"]){const item=result.items.find(row=>row.assetId===id);assert.equal(item.action,"blocked");assert.match(item.reason,/not a regular file/);}
  assert.equal(lstatSync(join(root,".agents/skills/prepare/SKILL.md")).isSymbolicLink(),true);assert.equal(lstatSync(join(root,".prime-claw/workflows/handoff.md")).isSymbolicLink(),true);assert.ok(result.items.some(row=>row.action==="created"));
});


test("adapter returns ordinary Git patch text without invoking any viewer", async (t) => {
  const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});git(root,"add",".");git(root,"commit","-qm","initialize");
  const target=join(root,".agents/skills/prepare/SKILL.md");writeFileSync(target,readFileSync(target,"utf8")+"\nadapter customization\n");git(root,"add",target);writeFileSync(target,readFileSync(target,"utf8")+"unstaged edit\n");runner.orcaError="Orca unavailable";
  const before=readFileSync(target),index=readFileSync(join(root,".git/index"));
  const commands=new Map(),tools=new Map();createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner})({registerCommand(name,value){commands.set(name,value)},registerTool(value){tools.set(value.name,value)},on(){}});const ctx={cwd:root,ui:{notify(){}}};
  const tool=await tools.get("initialize_prime_claw").execute("patch",{action:"review-request",assetId:"project-skill-prepare"},null,null,ctx);
  assert.equal(tool.isError,undefined);assert.match(tool.content[0].text,/diff --git a\/\.agents/);assert.match(tool.content[0].text,/-adapter customization/);assert.match(tool.content[0].text,/-unstaged edit/);
  assert.deepEqual(readFileSync(target),before);assert.deepEqual(readFileSync(join(root,".git/index")),index);assert.equal(runner.diffs,0);assert.equal(commands.size,0);
  for(const action of ["review-start","review-complete","review-cancel"]){const retired=await tools.get("initialize_prime_claw").execute("retired",{action},null,null,ctx);assert.equal(retired.isError,true);assert.match(retired.content[0].text,/unsupported initialization action/);}
});


test("dangling manifest symlink is refused and preserved before asset reconciliation", (t) => {
  const root=repo(t);const manifest=join(root,".prime-claw/templates.json");mkdirSync(dirname(manifest),{recursive:true});symlinkSync(join(root,"missing-manifest"),manifest);
  assert.throws(()=>reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/templates\.json is not a regular file/);assert.equal(lstatSync(manifest).isSymbolicLink(),true);
});

test("explicit reset refuses and preserves dangling skill and workflow leaves", (t) => {
  const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  for(const [id,relative] of [["project-skill-prepare",".agents/skills/prepare/SKILL.md"],["project-workflow-handoff",".prime-claw/workflows/handoff.md"]]){const path=join(root,relative);unlinkSync(path);symlinkSync(join(root,"missing-reset",id),path);assert.throws(()=>resetProjectAsset(root,id,{pluginRoot:PLUGIN,home:dirname(root),runner,isActiveEpisode:()=>false}),/reset destination is not a regular file/);assert.equal(lstatSync(path).isSymbolicLink(),true);}
});


test("linked legacy directory preserves shared policy while unrelated safe assets reconcile", (t) => {
  const root=repo(t),outside=mkdtempSync(join(tmpdir(),"pc-shared-legacy-"));t.after(()=>rmSync(outside,{recursive:true,force:true}));const shared=join(outside,"prepare/SKILL.md");mkdirSync(dirname(shared),{recursive:true});writeFileSync(shared,"shared legacy customization\n");mkdirSync(join(root,".ralph"),{recursive:true});symlinkSync(outside,join(root,".ralph/skills"));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});const prepare=result.items.find(row=>row.assetId==="project-skill-prepare");assert.equal(prepare.action,"blocked");assert.match(prepare.reason,/unsafe managed directory collision/);assert.equal(readFileSync(shared,"utf8"),"shared legacy customization\n");assert.equal(lstatSync(join(root,".ralph/skills")).isSymbolicLink(),true);assert.equal(result.items.find(row=>row.assetId==="project-skill-design").action,"created");
});

test("explicit reset refuses linked skill and workflow destination directories", (t) => {
  for(const scenario of [{id:"project-skill-prepare",parent:".agents/skills/prepare",leaf:"SKILL.md"},{id:"project-workflow-handoff",parent:".prime-claw/workflows",leaf:"handoff.md"}]){const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});const parent=join(root,scenario.parent),outside=mkdtempSync(join(tmpdir(),"pc-shared-reset-"));t.after(()=>rmSync(outside,{recursive:true,force:true}));const shared=join(outside,scenario.leaf);mkdirSync(dirname(shared),{recursive:true});writeFileSync(shared,"shared reset customization\n");rmSync(parent,{recursive:true,force:true});symlinkSync(outside,parent);assert.throws(()=>resetProjectAsset(root,scenario.id,{pluginRoot:PLUGIN,home:dirname(root),runner,isActiveEpisode:()=>false}),/unsafe managed directory collision/);assert.equal(readFileSync(shared,"utf8"),"shared reset customization\n");assert.equal(lstatSync(parent).isSymbolicLink(),true);}
});

test("pending reset recovery refuses a linked destination directory without touching shared bytes", (t) => {
  const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});const relative=".prime-claw/workflows/handoff.md",custom=Buffer.from("shared pending-reset customization\n"),upstream=readFileSync(join(PLUGIN,"workflows/handoff.md"));writeFileSync(join(root,".prime-claw/reset-intent.json"),JSON.stringify({schemaVersion:1,action:"reset",assetId:"project-workflow-handoff",destination:relative,upstreamSha256:createHash("sha256").update(upstream).digest("hex"),beforeSha256:createHash("sha256").update(custom).digest("hex")})+"\n");const parent=join(root,".prime-claw/workflows"),outside=mkdtempSync(join(tmpdir(),"pc-shared-recovery-"));t.after(()=>rmSync(outside,{recursive:true,force:true}));writeFileSync(join(outside,"handoff.md"),custom);rmSync(parent,{recursive:true,force:true});symlinkSync(outside,parent);assert.throws(()=>reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}),/unsafe managed directory collision/);assert.deepEqual(readFileSync(join(outside,"handoff.md")),custom);assert.equal(lstatSync(parent).isSymbolicLink(),true);
});


test("linked .ralph ancestor preserves the full shared legacy tree during cleanup", (t) => {
  const root=repo(t),outside=mkdtempSync(join(tmpdir(),"pc-shared-ralph-"));t.after(()=>rmSync(outside,{recursive:true,force:true}));const shared=join(outside,"skills/prepare/SKILL.md"),empty=join(outside,"skills/empty/nested");mkdirSync(dirname(shared),{recursive:true});mkdirSync(empty,{recursive:true});writeFileSync(shared,"shared ancestor policy\n");symlinkSync(outside,join(root,".ralph"));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});assert.equal(result.items.find(row=>row.assetId==="project-skill-prepare").action,"blocked");assert.equal(result.items.find(row=>row.assetId==="project-skill-design").action,"created");assert.equal(readFileSync(shared,"utf8"),"shared ancestor policy\n");assert.equal(lstatSync(empty).isDirectory(),true);assert.equal(lstatSync(join(root,".ralph")).isSymbolicLink(),true);assert.ok(result.legacyRemaining.includes(".ralph/skills"));
});

test("reconcile initializes the .backlog default only when no live provider evidence exists",t=>{
  const root=repo(t), runner=new Runner();
  const first=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.deepEqual(first.taskProvider,{status:"initialized",provider:"backlog",storeDir:join(realpathSync(root),".backlog")});
  assert.equal(runner.providerInits,1);
  // Exact non-interactive argv: deterministic positional project name (repo basename),
  // then the accepted .backlog/folder/no-integration flags.
  assert.deepEqual(runner.providerInitArgs[0],["init",basename(root),"--defaults","--backlog-dir",".backlog","--config-location","folder","--integration-mode","none"]);
  // The initialized store is lifecycle-ready: exact ordered canonical statuses + canonical default.
  const config=readFileSync(join(root,".backlog","config.yml"),"utf8");
  assert.match(config,/^statuses: \["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"\]$/m);
  assert.match(config,/^default_status: "In Design"$/m);
  assert.equal(first.conflicts,0);
  const second=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.deepEqual(second.taskProvider,{status:"selected",provider:"backlog"});
  assert.equal(runner.providerInits,1);
  assert.equal(second.changed,false);
});

test("reconcile with the real managed Backlog CLI initializes a lifecycle-ready .backlog store",t=>{
  const root=repo(t);
  const distBacklog=resolve("deps/backlog/dist/backlog");
  let backlog=distBacklog;
  if(!existsSync(distBacklog)){
    try{backlog=execFileSync("which",["backlog"],{encoding:"utf8"}).trim().split("\n")[0];}catch{backlog="";}
  }
  if(!backlog||!existsSync(backlog)){
    t.skip("managed backlog executable unavailable in this environment (tier-1 container image ships none; host runs the repository dist)");
    return;
  }
  const runner={run(command,args,options={}){
    if(command==="backlog"){
      try{return{stdout:execFileSync(backlog,args,{cwd:options.cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}),stderr:"",status:0};}
      catch(error){return{stdout:String(error?.stdout??""),stderr:String(error?.stderr??""),status:Number.isInteger(error?.status)?error.status:1};}
    }
    return new ProcessCommandRunner().run(command,args,options);
  }};
  const first=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.deepEqual(first.taskProvider,{status:"initialized",provider:"backlog",storeDir:join(realpathSync(root),".backlog")});
  const config=readFileSync(join(root,".backlog","config.yml"),"utf8");
  assert.match(config,new RegExp(`^project_name: "${basename(root)}"$`,"m"));
  assert.match(config,/^statuses: \["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"\]$/m);
  assert.match(config,/^default_status: "In Design"$/m);
  // The native capability gate passes against the real executable.
  assert.equal(execFileSync(backlog,["config","get","statuses"],{cwd:root,encoding:"utf8"}).trim(),"In Design, In Planning, In Progress, Blocked, Ready for Merge, Done");
  // A second reconcile is a no-op: provider selected, nothing changed.
  const second=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.deepEqual(second.taskProvider,{status:"selected",provider:"backlog"});
  assert.equal(second.changed,false);
});

test("reconcile blocks an unsafe nested Backlog .git identity instead of grandfathering it", (t) => {
  const root = repo(t);
  const outside = mkdtempSync(join(tmpdir(), "pc-unsafe-task-git-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, ".backlog"), { recursive: true });
  writeFileSync(join(root, ".backlog", "config.yml"), 'project_name: "fixture"\n');
  symlinkSync(outside, join(root, ".backlog", ".git"));
  let prepares = 0;
  const result = reconcilePrimeClawProject({
    cwd: root, pluginRoot: PLUGIN, home: dirname(root), runner: new Runner(),
    taskHistoryPreparer: () => { prepares += 1; throw new Error("unsafe identity must block before preparation"); },
  });
  assert.equal(result.taskProvider.status, "blocked");
  assert.equal(result.taskProvider.code, "task-history");
  assert.match(result.taskProvider.detail, /unsafe independent Backlog Git identity/);
  assert.equal(prepares, 0);
  assert.equal(lstatSync(join(root, ".backlog", ".git")).isSymbolicLink(), true);
});

test("reconcile routes selected root Backlog evidence with no materialized store through safe preparation", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "pc-init-root-config-"));
  const root = repo(t, parent);
  const remote = join(parent, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  const rootConfig = join(root, "backlog.config.yml");
  const originalConfig = "project_name: Fixture\n";
  writeFileSync(rootConfig, originalConfig);
  const runner = new Runner([{ id: "registered", path: root, displayName: "fixture" }]);
  let prepares = 0;
  const result = reconcilePrimeClawProject({
    cwd: root, pluginRoot: PLUGIN, home: dirname(root), runner,
    taskHistoryPreparer: (input) => { prepares += 1; return prepareTaskHistoryWorkspace(input); },
  });
  assert.equal(prepares, 1);
  assert.equal(result.taskProvider.status, "blocked");
  assert.equal(result.taskProvider.code, "task-history");
  assert.match(result.taskProvider.detail, /config-not-preserved/);
  assert.match(result.taskProvider.detail, /root configuration/);
  assert.equal(readFileSync(rootConfig, "utf8"), originalConfig);
  assert.equal(existsSync(join(root, "backlog")), false);
  assert.equal(existsSync(join(root, ".backlog")), false);
});

test("production initialization prepares and reuses an independent published .backlog workspace", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "pc-init-history-"));
  const root = repo(t, parent);
  const remote = join(parent, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-qu", "origin", "main");
  const backlog = resolve("deps/backlog/dist/backlog");
  if (!existsSync(backlog)) { t.skip("managed backlog executable unavailable"); return; }
  const runner = { run(command, args, options = {}) {
    const executable = command === "backlog" ? backlog : command;
    try { return { stdout: execFileSync(executable, args, { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "", status: 0 }; }
    catch (error) { const result = { stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? error.message ?? error), status: Number.isInteger(error.status) ? error.status : 1 }; if (!options.allowFailure) throw error; return result; }
  } };
  const options = { cwd: root, pluginRoot: PLUGIN, home: dirname(root), runner, taskHistoryPreparer: prepareTaskHistoryWorkspace };
  const codeHead = git(root, "rev-parse", "HEAD").trim();
  const first = reconcilePrimeClawProject(options);
  assert.equal(first.taskProvider.status, "initialized");
  assert.equal(first.taskProvider.provider, "backlog");
  assert.ok(first.taskProvider.taskHistoryHead);
  assert.ok(lstatSync(join(root, ".backlog", ".git")).isDirectory());
  assert.equal(git(root, "rev-parse", "HEAD").trim(), codeHead);
  assert.equal(git(root, "ls-files", "--", ".backlog").trim(), "");
  assert.match(git(root, "ls-remote", "--heads", remote, TASK_HISTORY_REF), new RegExp(`^${first.taskProvider.taskHistoryHead}\\s`));
  const second = reconcilePrimeClawProject(options);
  assert.equal(second.taskProvider.status, "selected");
  assert.equal(second.taskProvider.taskHistoryHead, first.taskProvider.taskHistoryHead);
  assert.equal(second.changed, false);
});

test("reconcile reports task-history preparation exceptions without losing asset reconciliation", (t) => {
  const root = repo(t);
  const result = reconcilePrimeClawProject({
    cwd: root, pluginRoot: PLUGIN, home: dirname(root), runner: new Runner(),
    taskHistoryPreparer: () => { throw new Error("fixture preparation failure"); },
  });
  assert.equal(result.taskProvider.status, "failed");
  assert.match(result.taskProvider.detail, /task-history preparation failed: fixture preparation failure/);
  assert.equal(result.conflicts, 1);
  assert.ok(existsSync(join(root, ".agents", "skills", "prepare", "SKILL.md")));
});

test("reconcile returns exact failed evidence when the initialized store is not lifecycle-ready",t=>{
  const root=repo(t), runner=new Runner();
  const orig=runner.run.bind(runner);
  runner.run=(command,args,options={})=>{
    if(command==="backlog"&&args[0]==="init"){
      mkdirSync(join(options.cwd,".backlog"),{recursive:true});
      writeFileSync(join(options.cwd,".backlog","config.yml"),'project_name: "fixture"\n');
      return{stdout:"initialized\n",stderr:"",status:0};
    }
    return orig(command,args,options);
  };
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.equal(result.taskProvider.status,"failed");
  assert.match(result.taskProvider.detail,/no recognizable statuses/);
  assert.equal(result.conflicts,1);
});

test("reconcile preserves an existing Beads store without initializing Backlog",t=>{
  const root=repo(t), runner=new Runner();
  const origRun=runner.run.bind(runner);
  runner.run=(command,args,options={})=>{
    if(command==="bd"&&args.join(" ")==="config get no-db")return{stdout:"false\n",stderr:"",status:0};
    return origRun(command,args,options);
  };
  mkdirSync(join(root,".beads"),{recursive:true});
  writeFileSync(join(root,".beads","config.yaml"),"# beads\n");
  writeFileSync(join(root,".beads","metadata.json"),JSON.stringify({database:"dolt",backend:"dolt",dolt_mode:"embedded",dolt_database:"db"}));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.deepEqual(result.taskProvider,{status:"selected",provider:"beads"});
  assert.equal(runner.providerInits??0,0);
});

test("reconcile blocks dual provider evidence with exact remediation instead of initializing",t=>{
  const root=repo(t), runner=new Runner();
  const origRun=runner.run.bind(runner);
  runner.run=(command,args,options={})=>{
    if(command==="bd"&&args.join(" ")==="config get no-db")return{stdout:"false\n",stderr:"",status:0};
    return origRun(command,args,options);
  };
  mkdirSync(join(root,"backlog"),{recursive:true});
  writeFileSync(join(root,"backlog","config.yml"),"project_name: fixture\n");
  mkdirSync(join(root,".beads"),{recursive:true});
  writeFileSync(join(root,".beads","config.yaml"),"# beads\n");
  writeFileSync(join(root,".beads","metadata.json"),JSON.stringify({database:"dolt",backend:"dolt",dolt_mode:"embedded",dolt_database:"db"}));
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.equal(result.taskProvider.status,"blocked");
  assert.equal(result.taskProvider.code,"dual-providers");
  assert.match(result.taskProvider.remediation,/exactly one live store/);
  assert.equal(runner.providerInits??0,0);
  assert.equal(existsSync(join(root,".backlog")),false);
  // Blocked provider evidence is a surfaced conflict with actionable detail (defect 4).
  assert.equal(result.conflicts,1);
  const summary=summarizeReconcile(result, true);
  assert.match(summary,/conflicts=1/);
  assert.match(summary,/provider=blocked\(dual-providers: /);
  assert.match(summary,/exactly one live store/);
});

test("reconcile reports backlog init failure without failing asset reconciliation",t=>{
  const root=repo(t), runner=new Runner();
  const orig=runner.run.bind(runner);
  runner.run=(command,args,options={})=>{
    if(command==="backlog"&&args[0]==="init")return{stdout:"",stderr:"disk full",status:1};
    return orig(command,args,options);
  };
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});
  assert.equal(result.taskProvider.status,"failed");
  assert.match(result.taskProvider.detail,/disk full/);
  assert.equal(result.skippedActiveEpisode,false);
  assert.ok(result.items.length>0);
  // Failed provider setup is a surfaced conflict carrying the exact cause (defect 4).
  assert.equal(result.conflicts,1);
  const summary=summarizeReconcile(result, true);
  assert.match(summary,/conflicts=1/);
  assert.match(summary,/provider=failed\(.*disk full/);
});

test("reconcile does not touch the provider seam for an active Episode worktree",t=>{
  const root=repo(t), runner=new Runner();
  writeEpisodeOwnership(root,activeOwnership("owner",join(root,"wt")));
  const episode=join(root,"episode-wt"); mkdirSync(episode,{recursive:true});
  const result=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,isActiveEpisode:()=>true});
  assert.equal(result.skippedActiveEpisode,true);
  assert.deepEqual(result.taskProvider,{status:"not-run",reason:"episode-activity"});
  assert.equal(runner.providerInits??0,0);
});


test("initialization UX separates read-only provider-switch inspection from exact explicit confirmation", async () => {
  const commands = new Map(), tools = new Map(), events = new Map();
  const calls = [];
  const pi = {
    registerCommand(name, value) { commands.set(name, value); },
    registerTool(tool) { tools.set(tool.name, tool); },
    on(name, handler) { events.set(name, handler); },
  };
  createProjectInitializationExtension({
    migrationInspector(input) {
      calls.push({ kind: "inspect", input });
      return {
        status: "ready", projectRoot: "/fixture", sourceProvider: "beads", targetProvider: input.targetProvider,
        sourceRevision: "a".repeat(40), sourceDigest: "b".repeat(64),
        taskCounts: { open: 2, closed: 1, archived: 1, total: 4 }, activeOwnership: [],
        semanticPlacementPrompt: "decide native placement", confirmation: "confirm exact destructive switch",
      };
    },
    migrationRunner(input) {
      calls.push({ kind: "run", input });
      if (!input.confirmedSwitch) return { status: "blocked", code: "confirmation-required", detail: "not confirmed", remediation: "confirm", targetProvider: input.targetProvider };
      return {
        status: "completed", receiptTaskId: "RECEIPT-1", sourceAbsent: true, selectedProvider: input.targetProvider,
        receipt: {
          schemaVersion: 1, marker: "prime-claw-task-provider-migration-receipt-v1",
          sourceProvider: "beads", targetProvider: input.targetProvider, sourceRevision: input.expectedSourceRevision,
          sourceDigest: "b".repeat(64), destinationDataRevision: "c".repeat(32), destinationDataDigest: "d".repeat(64),
          destinationReceiptRevision: "e".repeat(32), taskCounts: { open: 2, closed: 1, archived: 1, total: 4 },
          mappings: [], ownershipTransitions: [], actor: input.actor, timestamp: "2026-10-27T12:00:00.000Z",
          semanticPlacement: input.semanticPlacement,
        },
      };
    },
  })(pi);
  const notices = [];
  const ctx = { cwd: "/fixture", ui: { notify(message, level) { notices.push({ message, level }); } } };
  const tool = tools.get("initialize_prime_claw");
  const inspected = await tool.execute("inspect", { action: "switch-request", targetProvider: "backlog" }, undefined, undefined, ctx);
  assert.equal(inspected.isError, undefined);
  assert.match(inspected.content[0].text, /beads->backlog/);
  assert.match(inspected.content[0].text, /tasks\(open=2,closed=1,archived=1,total=4\)/);
  assert.match(inspected.content[0].text, /digest=b{64}/);
  assert.match(inspected.content[0].text, /Semantic placement: decide native placement/);
  assert.equal(calls.length, 1);
  const unconfirmed = await tool.execute("blocked", {
    action: "switch-confirm", targetProvider: "backlog", expectedSourceRevision: "a".repeat(40),
    confirmedSwitch: false, actor: "operator", semanticPlacement: "keep unsupported fields in native metadata",
  }, undefined, undefined, ctx);
  assert.match(unconfirmed.content[0].text, /confirmation-required/);
  assert.deepEqual(tool.parameters.properties.targetProvider.enum,["backlog"]);
  assert.equal(tool.parameters.properties.beadsNativePlacements,undefined);
  const completed = await tool.execute("confirm", {
    action: "switch-confirm", targetProvider: "backlog", expectedSourceRevision: "a".repeat(40),
    confirmedSwitch: true, actor: "operator", semanticPlacement: "keep unsupported fields in native metadata",
  }, undefined, undefined, ctx);
  assert.equal(completed.isError, undefined);
  assert.match(completed.content[0].text, /source-absent=true/);
  assert.deepEqual(calls.map((call) => call.kind), ["inspect", "run", "run"]);
  assert.equal(calls[2].input.confirmedSwitch, true);
  assert.equal(calls[2].input.expectedSourceRevision, "a".repeat(40));
  assert.equal(calls[2].input.semanticPlacement, "keep unsupported fields in native metadata");
  assert.equal(calls[2].input.beadsNativePlacements,undefined);
  assert.equal(commands.size,0);
});

test("retired command and reverse direction cannot invoke migration mechanics", async () => {
  const commands=new Map(),tools=new Map(),calls=[];
  createProjectInitializationExtension({
    migrationInspector(input){calls.push(input);throw Error("must not inspect");},
    migrationRunner(input){calls.push(input);throw Error("must not migrate");},
  })({registerCommand(name,value){commands.set(name,value);},registerTool(tool){tools.set(tool.name,tool);},on(){}});
  assert.equal(commands.size,0);
  const ctx={cwd:"/fixture",ui:{notify(){}}};
  for(const action of ["switch-request","switch-confirm"]){
    const result=await tools.get("initialize_prime_claw").execute("reverse",{action,targetProvider:"beads",expectedSourceRevision:"a".repeat(40),confirmedSwitch:true},null,null,ctx);
    assert.equal(result.isError,true);assert.match(result.content[0].text,/only Beads to Backlog/);
  }
  assert.deepEqual(calls,[]);
});

test("startup never inspects or confirms a provider migration",async t=>{
  const root=repo(t),runner=new Runner([{id:"exact",path:root}]),events=new Map(),calls=[];
  createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner,
    migrationInspector(input){calls.push(input);throw Error("must not inspect");},
    migrationRunner(input){calls.push(input);throw Error("must not migrate");},
  })({registerTool(){},on(name,handler){events.set(name,handler);}});
  await events.get("session_start")({}, {cwd:root,ui:{notify(){}}});
  assert.deepEqual(calls,[]);
});

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
import { startTemplateReview } from "../src/prime-agent-plugin/extension-support/template-review.ts";
import { writeEpisodeOwnership } from "../src/prime-agent-plugin/extension-support/episode-ownership.ts";

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

test("inventory exposes sixteen manifest-authoritative project assets including retained compatibility",()=>{
  const inv=loadAssetInventory(PLUGIN); assert.equal(inv.schemaVersion,2); assert.equal(inv.assets.length,16); assert.equal(new Set(inv.assets.map(x=>x.id)).size,16);
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
  assert.equal(freshResult.items.filter(item=>item.action==="created").length,16);
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
    assert.equal(result.items.filter(item=>item.action==="created").length,16);
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
  const first=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true}); assert.equal(first.items.filter(x=>x.action==="created").length,16); assert.equal(first.registration.status,"added"); assert.equal(runner.adds,1); assert.equal(existsSync(join(root,".ralph","plans")),false);
  for (const name of ["plan-task-prep.md","plan-task.md","implement-task-prep.md","implement-task.md"]) assert.equal(readFileSync(join(root,".prime-claw/workflows",name),"utf8"),readFileSync(join(PLUGIN,"workflows",name),"utf8"));
  const manifestPath=join(root,".prime-claw/templates.json"), beforeManifest=statSync(manifestPath,{bigint:true});
  const second=reconcilePrimeClawProject({cwd:join(root,".agents"),pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true}); const afterManifest=statSync(manifestPath,{bigint:true}); assert.equal(second.changed,false); assert.equal(second.manifestWritten,false); assert.equal(afterManifest.ino,beforeManifest.ino); assert.equal(afterManifest.mtimeNs,beforeManifest.mtimeNs); assert.equal(second.registration.status,"reused"); assert.equal(runner.adds,1);
  const target=join(root,".agents/skills/prepare/SKILL.md"); writeFileSync(target,readFileSync(target,"utf8")+"\ncustom\n");
  const third=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}); const item=third.items.find(x=>x.assetId==="project-skill-prepare"); assert.equal(item.action,"preserved"); assert.match(item.reason,/customized/); assert.match(readFileSync(target,"utf8"),/custom/);
  const accepted=acceptProjectOverride(root,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner}); assert.equal(accepted.state,"accepted-override");
  const fourth=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner}); assert.equal(fourth.items.find(x=>x.assetId==="project-skill-prepare").reason,"accepted override");
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

test("extension shares core across command, tool, and awaited startup without a model turn",async t=>{
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
  assert.deepEqual([...commands.keys()],["initialize-prime-claw"]); assert.deepEqual([...tools.keys()],["initialize_prime_claw"]); assert.ok(events.has("session_start")); assert.ok(events.has("resources_discover"));
  const ctx={cwd:root,ui:{notify(message,level){notifications.push({message,level})}}}; await events.get("session_start")({},ctx); assert.ok(existsSync(join(root,".prime-claw/templates.json"))); assert.equal(notifications.length,1); const discovered=await events.get("resources_discover")({},ctx); assert.equal(discovered.skillPaths.length,7); assert.ok(discovered.skillPaths.every(path=>path.endsWith("SKILL.md"))); assert.equal(await events.get("resources_discover")({},ctx),undefined); await events.get("session_start")({},ctx); assert.equal(notifications.length,1);
  const result=await tools.get("initialize_prime_claw").execute("id",{action:"reconcile"},null,null,ctx); assert.equal(result.isError,undefined); assert.equal(runner.adds,0);
  await commands.get("initialize-prime-claw").handler("--review project-skill-prepare",ctx);
  assert.match(notifications.at(-1).message,/temporarily overwrite/);
  assert.match(notifications.at(-1).message,/ready to continue or cancel/);
  const customized=join(root,".agents/skills/prepare/SKILL.md");writeFileSync(customized,readFileSync(customized,"utf8")+"\ncustom command policy\n");
  await commands.get("initialize-prime-claw").handler("",ctx);
  assert.match(notifications.at(-1).message,/project-skill-prepare/);assert.match(notifications.at(-1).message,/--review project-skill-prepare/);
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
  assert.throws(()=>startTemplateReview(worktree,"project-skill-prepare",true,{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
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


test("adapter exposes restored terminal fallback diff to both tool and slash-command callers", async (t) => {
  const root=repo(t),runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});git(root,"add",".");git(root,"commit","-qm","initialize");
  const target=join(root,".agents/skills/prepare/SKILL.md");writeFileSync(target,readFileSync(target,"utf8")+"\nadapter fallback customization\n");git(root,"add",target);git(root,"commit","-qm","customize");runner.orcaError="Orca diff unavailable";
  const commands=new Map(),tools=new Map(),notifications=[];createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner})({registerCommand(name,value){commands.set(name,value)},registerTool(value){tools.set(value.name,value)},on(){}});const ctx={cwd:root,ui:{notify(message,level){notifications.push({message,level})}}};
  const tool=await tools.get("initialize_prime_claw").execute("fallback",{action:"review-start",assetId:"project-skill-prepare",confirmedReady:true},null,null,ctx);assert.equal(tool.isError,undefined);assert.match(tool.content[0].text,/adapter fallback customization/);assert.match(tool.content[0].text,/git-diff fallback/);
  await commands.get("initialize-prime-claw").handler("--review-ready project-skill-prepare",ctx);assert.match(notifications.at(-1).message,/adapter fallback customization/);assert.match(notifications.at(-1).message,/git-diff fallback/);
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

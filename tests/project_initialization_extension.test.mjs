import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, symlinkSync, realpathSync, cpSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  acceptProjectOverride,
  loadAssetInventory,
  reconcilePrimeClawProject,
  resetProjectAsset,
  ensureOrcaRegistration,
  isOrcaRegistered,
  resolveNearestProjectRoot,
} from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { createProjectInitializationExtension } from "../src/prime-agent-plugin/extensions/project-initialization.ts";
import { startTemplateReview } from "../src/prime-agent-plugin/extension-support/template-review.ts";

const PLUGIN = resolve("src/prime-agent-plugin");
function git(cwd, ...args) { return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }); }
function repo(t, parent = mkdtempSync(join(tmpdir(), "pc-init-"))) {
  const root = join(parent, "repo"); mkdirSync(root, { recursive: true }); git(root, "init", "-q", "-b", "main"); git(root,"config","user.name","Test"); git(root,"config","user.email","test@example.invalid"); writeFileSync(join(root,"README.md"),"fixture\n"); git(root,"add","README.md"); git(root,"commit","-qm","fixture"); t.after(()=>{}); return root;
}
class Runner {
  constructor(registrations = []) { this.registrations = registrations; this.adds = 0; this.diffs = 0; this.orcaError = null; }
  run(command,args,options={}) {
    if (command === "git") {
      try { return {stdout:execFileSync(command,args,{cwd:options.cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}),stderr:"",status:0}; }
      catch(e) { const r={stdout:String(e.stdout??""),stderr:String(e.stderr??e.message),status:Number.isInteger(e.status)?e.status:1}; if(!options.allowFailure) throw e; return r; }
    }
    if (command !== "orca") throw Error(`unexpected ${command}`);
    if (this.orcaError) return {stdout:"",stderr:this.orcaError,status:1};
    if (args[0] === "repo" && args[1] === "list") return {stdout:JSON.stringify({result:{repos:this.registrations}}),stderr:"",status:0};
    if (args[0] === "repo" && args[1] === "add") { this.adds++; const path=args[args.indexOf("--path")+1]; this.registrations.push({id:`repo-${this.adds}`,path,displayName:"kept"}); return {stdout:JSON.stringify({ok:true}),stderr:"",status:0}; }
    if (args[0] === "file" && args[1] === "diff") { this.diffs++; return {stdout:JSON.stringify({opened:true}),stderr:"",status:0}; }
    throw Error(`unexpected orca ${args.join(" ")}`);
  }
}

test("inventory is the exact 15-asset contract",()=>{
  const inv=loadAssetInventory(PLUGIN); assert.equal(inv.assets.length,15); assert.equal(new Set(inv.assets.map(x=>x.id)).size,15); assert.equal(inv.assets.filter(x=>x.scope==="project").length,10); assert.deepEqual(inv.assets.filter(x=>x.scope==="project"&&x.exposure==="discoverable").map(x=>x.id).sort(),["project-skill-blocked","project-skill-design","project-skill-execute","project-skill-prepare","project-skill-spec-it-out"]);
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
  const first=reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner,registerOrca:true}); assert.equal(first.items.filter(x=>x.action==="created").length,10); assert.equal(first.registration.status,"added"); assert.equal(runner.adds,1); assert.equal(existsSync(join(root,".ralph","plans")),false);
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
  createProjectInitializationExtension({pluginRoot:PLUGIN,home:dirname(root),runner})(pi);
  assert.deepEqual([...commands.keys()],["initialize-prime-claw"]); assert.deepEqual([...tools.keys()],["initialize_prime_claw"]); assert.ok(events.has("session_start")); assert.ok(events.has("resources_discover"));
  const ctx={cwd:root,ui:{notify(message,level){notifications.push({message,level})}}}; await events.get("session_start")({},ctx); assert.ok(existsSync(join(root,".prime-claw/templates.json"))); assert.equal(notifications.length,1); const discovered=await events.get("resources_discover")({},ctx); assert.equal(discovered.skillPaths.length,5); assert.ok(discovered.skillPaths.every(path=>path.endsWith("SKILL.md"))); assert.equal(await events.get("resources_discover")({},ctx),undefined); await events.get("session_start")({},ctx); assert.equal(notifications.length,1);
  const result=await tools.get("initialize_prime_claw").execute("id",{action:"reconcile"},null,null,ctx); assert.equal(result.isError,undefined); assert.equal(runner.adds,0);
  await commands.get("initialize-prime-claw").handler("--review project-skill-prepare",ctx);
  assert.match(notifications.at(-1).message,/temporarily overwrite/);
  assert.match(notifications.at(-1).message,/ready to continue or cancel/);
  const customized=join(root,".agents/skills/prepare/SKILL.md");writeFileSync(customized,readFileSync(customized,"utf8")+"\ncustom command policy\n");
  await commands.get("initialize-prime-claw").handler("",ctx);
  assert.match(notifications.at(-1).message,/project-skill-prepare/);assert.match(notifications.at(-1).message,/--review project-skill-prepare/);
});


test("real legacy Episode identity in the owner worktree protects the linked worktree snapshot", (t) => {
  const root=repo(t), worktree=join(dirname(root),"episode-worktree");
  git(root,"worktree","add","-q","-b","episode/test",worktree);
  t.after(()=>{try{git(root,"worktree","remove","--force",worktree)}catch{};rmSync(worktree,{recursive:true,force:true})});
  const records=join(root,".prime/agent/state/spec-episodes");mkdirSync(records,{recursive:true});
  writeFileSync(join(records,"test.json"),JSON.stringify({worktree,bootstrapAdmission:"delivered"}));
  const result=reconcilePrimeClawProject({cwd:worktree,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(result.skippedActiveEpisode,true);
  assert.equal(existsSync(join(worktree,".prime-claw/templates.json")),false);
  assert.throws(()=>acceptProjectOverride(worktree,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
  assert.throws(()=>resetProjectAsset(worktree,"project-skill-prepare",{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
  assert.throws(()=>startTemplateReview(worktree,"project-skill-prepare",true,{pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()}),/active or uncertain Episode/);
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
  const identities=join(root,".prime/agent/state/spec-episodes");mkdirSync(identities,{recursive:true});writeFileSync(join(identities,"broken.json"),"{bad json");
  const malformed=reconcilePrimeClawProject({cwd:linked,pluginRoot:PLUGIN,home:dirname(root),runner:new Runner()});
  assert.equal(malformed.skipReason,"uncertain-episode-activity");assert.equal(existsSync(join(linked,".agents/skills/prepare/SKILL.md")),false);
  rmSync(join(identities,"broken.json"));const outside=join(dirname(root),"identity-outside.json");writeFileSync(outside,JSON.stringify({worktree:linked,bootstrapAdmission:"delivered"}));symlinkSync(outside,join(identities,"symlink.json"));
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

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { reconcilePrimeClawProject, acceptProjectOverride, resetProjectAsset } from "../src/prime-agent-plugin/extension-support/project-initialization.ts";
import { requestTemplateReview, recoverTemplateReview } from "../src/prime-agent-plugin/extension-support/template-review.ts";
const PLUGIN=resolve("src/prime-agent-plugin");
function git(cwd,...args){return execFileSync("git",["-C",cwd,...args],{encoding:"utf8"})}
class Runner { constructor(){this.registrations=[];this.failDiff=false;this.diffs=0} run(command,args,options={}){if(command==="git"){try{return{stdout:execFileSync(command,args,{cwd:options.cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]}),stderr:"",status:0}}catch(e){const r={stdout:String(e.stdout??""),stderr:String(e.stderr??e.message),status:Number.isInteger(e.status)?e.status:1};if(!options.allowFailure)throw e;return r}} if(command==="orca"&&args[0]==="file"){this.diffs++;return this.failDiff?{stdout:"",stderr:"unavailable",status:1}:{stdout:JSON.stringify({opened:true}),stderr:"",status:0}} if(command==="orca"&&args[1]==="list")return{stdout:JSON.stringify({result:{repos:this.registrations}}),stderr:"",status:0};if(command==="orca"&&args[1]==="add")return{stdout:"{}",stderr:"",status:0};if(command==="bd")return{stdout:"",stderr:"no beads fixture",status:1}; if(command==="backlog"){if(args[0]==="init"){mkdirSync(join(options.cwd,".backlog"),{recursive:true});writeFileSync(join(options.cwd,".backlog","config.yml"),[`project_name: "${args[1] ?? "fixture"}"`,'default_status: "To Do"','statuses: ["To Do", "In Progress", "Done"]',""].join("\n"));return{stdout:"initialized\n",stderr:"",status:0}} if(args[0]==="--version")return{stdout:"1.53.0\n",stderr:"",status:0}; if(args.join(" ")==="config get statuses"){try{const config=readFileSync(join(options.cwd,".backlog","config.yml"),"utf8");const match=config.match(/^statuses: \[(.*)\]$/m);if(match)return{stdout:match[1].split(",").map((entry)=>entry.trim().replace(/^"|"$/g,"")).join(", ")+"\n",stderr:"",status:0}}catch{} return{stdout:"",stderr:"no statuses",status:1}} return{stdout:"",stderr:"no backlog fixture",status:1}} throw Error(`unexpected ${command} ${args}`)}}
function fixture(t){t.after(()=>rmSync(dirname(root),{recursive:true,force:true}));const root=join(mkdtempSync(join(tmpdir(),"pc-review-")),"repo");mkdirSync(root);git(root,"init","-q","-b","main");git(root,"config","user.name","Test");git(root,"config","user.email","test@example.invalid");writeFileSync(join(root,"README.md"),"x\n");git(root,"add","README.md");git(root,"commit","-qm","init");const runner=new Runner();reconcilePrimeClawProject({cwd:root,pluginRoot:PLUGIN,home:dirname(root),runner});git(root,"add",".");git(root,"commit","-qm","initialize");const rel=".agents/skills/prepare/SKILL.md",path=join(root,rel);writeFileSync(path,readFileSync(path,"utf8")+"\ncommitted customization\n");git(root,"add",rel);git(root,"commit","-qm","customize");return{root,runner,rel,path,custom:readFileSync(path,"utf8"),upstream:readFileSync(join(PLUGIN,"skills/project-templates/prepare.md"),"utf8")}}

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
function options(f) { return { pluginRoot: PLUGIN, home: dirname(f.root), runner: f.runner }; }
function snapshot(f) {
  return {
    bytes: readFileSync(f.path), index: readFileSync(join(f.root,".git/index")),
    assetStat: lstatSync(f.path), indexStat: lstatSync(join(f.root,".git/index")),
    manifest: readFileSync(join(f.root,".prime-claw/templates.json")), head: git(f.root,"rev-parse","HEAD"),
  };
}
function unchanged(f, before) {
  assert.deepEqual(readFileSync(f.path),before.bytes);
  assert.deepEqual(readFileSync(join(f.root,".git/index")),before.index);
  assert.equal(lstatSync(f.path).ino,before.assetStat.ino);
  assert.equal(lstatSync(f.path).mtimeMs,before.assetStat.mtimeMs);
  assert.equal(lstatSync(join(f.root,".git/index")).mtimeMs,before.indexStat.mtimeMs);
  assert.deepEqual(readFileSync(join(f.root,".prime-claw/templates.json")),before.manifest);
  assert.equal(git(f.root,"rev-parse","HEAD"),before.head);
  assert.equal(existsSync(join(f.root,".prime-claw/template-review.json")),false);
  assert.equal(f.runner.diffs,0);
}
for (const state of ["clean", "dirty", "staged", "mixed"]) {
  for (const asset of ["skill", "workflow"]) {
    test(`text patch preserves ${state} ${asset} bytes and exact index`, t => {
      const f=fixture(t);
      const assetId=asset==="skill"?"project-skill-prepare":"project-workflow-handoff";
      if(asset==="workflow") {
        f.rel=".prime-claw/workflows/handoff.md";f.path=join(f.root,f.rel);
        f.custom=readFileSync(f.path,"utf8")+"\ncommitted workflow customization\n";
        f.upstream=readFileSync(join(PLUGIN,"workflows/handoff.md"),"utf8");
        writeFileSync(f.path,f.custom);git(f.root,"add",f.rel);git(f.root,"commit","-qm","customize workflow");
      }
      if(state!=="clean")writeFileSync(f.path,f.custom+"dirty customization\n");
      if(state==="staged"||state==="mixed")git(f.root,"add",f.rel);
      if(state==="mixed")writeFileSync(f.path,readFileSync(f.path,"utf8")+"unstaged customization\n");
      const before=snapshot(f);
      const result=requestTemplateReview(f.root,assetId,options(f));
      assert.match(result.message,/Text comparison only/);
      assert.match(result.diff,new RegExp(`diff --git a/${f.rel.replaceAll(".","\\.")} b/`));
      assert.ok(result.diff.includes(`--- a/${f.rel}\n+++ b/${f.rel}\n`));
      assert.match(result.diff,/-committed .*customization|-committed customization/);
      if(state!=="clean")assert.match(result.diff,/-dirty customization/);
      if(state==="mixed")assert.match(result.diff,/-unstaged customization/);
      unchanged(f,before);
      // Standard Git patch applies to a disposable copy of exactly the compared
      // current worktree bytes, without a special viewer or project Git writes.
      const patchRoot=mkdtempSync(join(tmpdir(),"pc-patch-"));t.after(()=>rmSync(patchRoot,{recursive:true,force:true}));
      mkdirSync(dirname(join(patchRoot,f.rel)),{recursive:true});writeFileSync(join(patchRoot,f.rel),before.bytes);
      execFileSync("git",["apply","--unsafe-paths","-"],{cwd:patchRoot,input:result.diff,stdio:"pipe"});
      assert.equal(readFileSync(join(patchRoot,f.rel),"utf8"),f.upstream);
      unchanged(f,before);
    });
  }
}

test("identical templates return an empty patch without starting a review",t=>{
  const f=fixture(t);writeFileSync(f.path,f.upstream);const before=snapshot(f);
  assert.equal(requestTemplateReview(f.root,"project-skill-prepare",options(f)).diff,"");unchanged(f,before);
});

test("comparison failure preserves assets and index and removes disposable inputs",t=>{
  const f=fixture(t),base=f.runner.run.bind(f.runner);let scratch;
  f.runner.run=(command,args,opts)=>{
    if(command==="git"&&args.includes("--no-index")){scratch=opts.cwd;return{stdout:"",stderr:"fixture diff failure",status:2};}
    return base(command,args,opts);
  };
  const before=snapshot(f);
  assert.throws(()=>requestTemplateReview(f.root,"project-skill-prepare",options(f)),/fixture diff failure/);
  assert.ok(scratch);assert.equal(existsSync(scratch),false);unchanged(f,before);
});

test("viewing a patch accepts nothing; override and reset remain separate explicit operations",t=>{
  const f=fixture(t),before=snapshot(f);
  requestTemplateReview(f.root,"project-skill-prepare",options(f));unchanged(f,before);
  const entry=acceptProjectOverride(f.root,"project-skill-prepare",options(f));
  assert.equal(entry.state,"accepted-override");assert.equal(readFileSync(f.path,"utf8"),f.custom);
  assert.deepEqual(readFileSync(join(f.root,".git/index")),before.index);
  const accepted=readFileSync(join(f.root,".prime-claw/templates.json"));
  requestTemplateReview(f.root,"project-skill-prepare",options(f));
  assert.deepEqual(readFileSync(join(f.root,".prime-claw/templates.json")),accepted);
  const reset=resetProjectAsset(f.root,"project-skill-prepare",options(f));
  assert.equal(reset.state,"managed");assert.equal(readFileSync(f.path,"utf8"),f.upstream);
  assert.deepEqual(readFileSync(join(f.root,".git/index")),before.index);
});

function legacyReview(f, status="interrupted") {
  const path=join(f.root,".prime-claw/template-review.json");
  const state={schemaVersion:1,projectRoot:f.root,assetId:"project-skill-prepare",destination:f.rel,
    originalSha256:digest(f.custom),upstreamSha256:digest(f.upstream),status,
    selector:`path:${f.root}`,startedAt:"2026-10-01T00:00:00.000Z",ownerPid:process.pid};
  writeFileSync(f.path,f.upstream);writeFileSync(path,JSON.stringify(state,null,2)+"\n");
  return {path,bytes:readFileSync(path)};
}
for(const status of ["prepared","held","interrupted"]) {
  test(`legacy ${status} evidence is retained until explicit restore`,t=>{
    const f=fixture(t),legacy=legacyReview(f,status),index=readFileSync(join(f.root,".git/index")),indexMtime=lstatSync(join(f.root,".git/index")).mtimeMs;
    writeFileSync(f.path,"later operator edit\n");
    assert.throws(()=>requestTemplateReview(f.root,"project-skill-prepare",options(f)),/explicit keep or restore/);
    assert.throws(()=>reconcilePrimeClawProject({cwd:f.root,...options(f)}),/explicit keep or restore/);
    assert.throws(()=>acceptProjectOverride(f.root,"project-skill-prepare",options(f)),/explicit keep or restore/);
    assert.throws(()=>resetProjectAsset(f.root,"project-skill-prepare",options(f)),/explicit keep or restore/);
    assert.deepEqual(readFileSync(legacy.path),legacy.bytes);assert.equal(readFileSync(f.path,"utf8"),"later operator edit\n");
    const result=recoverTemplateReview(f.root,"restore",options(f));
    assert.equal(result.restored,true);assert.equal(readFileSync(f.path,"utf8"),f.custom);
    assert.equal(existsSync(legacy.path),false);assert.deepEqual(readFileSync(join(f.root,".git/index")),index);
    assert.equal(lstatSync(join(f.root,".git/index")).mtimeMs,indexMtime);
  });
}

test("explicit legacy keep preserves edited and staged bytes without committing",t=>{
  const f=fixture(t),legacy=legacyReview(f,"held");writeFileSync(f.path,"keep staged bytes\n");git(f.root,"add",f.rel);
  writeFileSync(f.path,"keep worktree bytes\n");const index=readFileSync(join(f.root,".git/index")),head=git(f.root,"rev-parse","HEAD");
  const kept=recoverTemplateReview(f.root,"keep",options(f));
  assert.equal(kept.kept,true);assert.equal(readFileSync(f.path,"utf8"),"keep worktree bytes\n");
  assert.deepEqual(readFileSync(join(f.root,".git/index")),index);assert.equal(git(f.root,"rev-parse","HEAD"),head);
  assert.equal(existsSync(legacy.path),false);
});

test("legacy restore with changed index refuses before overwriting current bytes or evidence",t=>{
  const f=fixture(t),legacy=legacyReview(f);writeFileSync(f.path,"new index bytes\n");git(f.root,"add",f.rel);writeFileSync(f.path,"new current bytes\n");
  const index=readFileSync(join(f.root,".git/index"));
  assert.throws(()=>recoverTemplateReview(f.root,"restore",options(f)),/cannot prove original bytes/);
  assert.equal(readFileSync(f.path,"utf8"),"new current bytes\n");assert.deepEqual(readFileSync(legacy.path),legacy.bytes);
  assert.deepEqual(readFileSync(join(f.root,".git/index")),index);
});

test("comparison refuses linked directories and leaves external content untouched",t=>{
  const f=fixture(t),parent=dirname(f.path),outside=mkdtempSync(join(tmpdir(),"pc-shared-review-")),shared=join(outside,"SKILL.md");
  t.after(()=>rmSync(outside,{recursive:true,force:true}));writeFileSync(shared,"shared review customization\n");rmSync(parent,{recursive:true,force:true});symlinkSync(outside,parent);
  assert.throws(()=>requestTemplateReview(f.root,"project-skill-prepare",options(f)),/unsafe managed directory collision/);
  assert.equal(readFileSync(shared,"utf8"),"shared review customization\n");assert.equal(lstatSync(parent).isSymbolicLink(),true);
});

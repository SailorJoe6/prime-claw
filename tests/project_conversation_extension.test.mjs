import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import projectConversation from "../src/prime-agent-plugin/extensions/project-conversation.ts";
import {
  appendActiveOversight,
  applyConversationContext,
  IDENTITY_KERNEL,
  OVERSIGHT_MARKER_TYPE,
  OVERSIGHT_PACKAGE_TYPE,
} from "../src/prime-agent-plugin/extension-support/conversation-oversight.ts";

function fixture(t, { sessionId="owner", prompt=IDENTITY_KERNEL, entries=[] }={}) {
  const cwd=mkdtempSync(join(tmpdir(),"pc-oversight-"));t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  const packagePath=join(cwd,".ralph/skills/oversee-episode/SKILL.md");mkdirSync(dirname(packagePath),{recursive:true});writeFileSync(packagePath,"---\nname: oversee-episode\n---\nREVISION ONE");
  const branch=structuredClone(entries);const events=new Map();const notifications=[];let aborts=0;
  const ctx={cwd,ui:{notify(message,level){notifications.push({message,level})}},abort(){aborts++},getSystemPrompt(){return prompt},sessionManager:{getSessionId(){return sessionId},getBranch(){return branch}}};
  const pi={on(name,handler){events.set(name,handler)},appendEntry(customType,data){branch.push({type:"custom",customType,data})},registerFlag(){throw Error("no flag")},registerCommand(){throw Error("no command")},registerTool(){throw Error("no tool")},sendUserMessage(){throw Error("no startup turn")},setActiveTools(){throw Error("no tool mutation")}};
  projectConversation(pi);return{cwd,packagePath,branch,events,notifications,get aborts(){return aborts},ctx,pi};
}
function identity(f,{episodeId="episode-1",sourceLocation=".ralph/plans/future/alpha",slug="alpha"}={}){const path=join(f.cwd,".prime/agent/state/spec-episodes",`${slug}.json`);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({version:2,slug,sourceLocation,ownerSessionId:f.ctx.sessionManager.getSessionId(),episodeId,episodeActiveSessionId:"active",episodeSessionFile:join(f.cwd,"episode.jsonl"),branch:`episode/${slug}`,worktree:join(f.cwd,"worktree"),sessionName:`${slug}-episode`,bootstrapAdmission:"delivered"}));return{sourceLocation,slug,episodeId,episodeSessionFile:join(f.cwd,"episode.jsonl")}}
function context(f,messages=[]){return f.events.get("context")({messages},f.ctx)}

test("registers only readiness lifecycle and universal context hooks",()=>{const cwd=mkdtempSync(join(tmpdir(),"pc-register-"));try{const events=new Map();projectConversation({on(n,h){events.set(n,h)}});assert.deepEqual([...events.keys()],["session_start","session_shutdown","context"])}finally{rmSync(cwd,{recursive:true,force:true})}});

test("inactive conversation keeps kernel and injects no oversight package",async t=>{const f=fixture(t);await f.events.get("session_start")({},f.ctx);assert.deepEqual(context(f,[{role:"user",content:"hello"}]),{messages:[{role:"user",content:"hello"}]});assert.equal(f.aborts,0)});

test("active marker injects exactly one freshly read canonical package",async t=>{const f=fixture(t);await f.events.get("session_start")({},f.ctx);const episode=identity(f);appendActiveOversight(f.pi,f.ctx,episode);const stale={role:"custom",customType:OVERSIGHT_PACKAGE_TYPE,content:"STALE"};let result=context(f,[stale]);assert.equal(result.messages.filter(m=>m.customType===OVERSIGHT_PACKAGE_TYPE).length,1);assert.match(result.messages.at(-1).content,/REVISION ONE/);writeFileSync(f.packagePath,"---\nname: oversee-episode\n---\nREVISION TWO");result=context(f,result.messages);assert.equal(result.messages.filter(m=>m.customType===OVERSIGHT_PACKAGE_TYPE).length,1);assert.match(result.messages.at(-1).content,/REVISION TWO/);assert.doesNotMatch(result.messages.at(-1).content,/REVISION ONE/)});

test("duplicate activation is a no-op and a different active episode is rejected",t=>{const f=fixture(t);const episode=identity(f);appendActiveOversight(f.pi,f.ctx,episode);appendActiveOversight(f.pi,f.ctx,episode);assert.equal(f.branch.filter(e=>e.customType===OVERSIGHT_MARKER_TYPE).length,1);assert.throws(()=>appendActiveOversight(f.pi,f.ctx,{...episode,episodeId:"other"}),/different active episode/)});

test("explicit exact-session EPISODE identity overrides default ownership",t=>{const entry={type:"custom",customType:"prime-claw-bounded-identity",data:{version:1,role:"EPISODE",sessionId:"episode"}};const f=fixture(t,{sessionId:"episode",entries:[entry]});const result=context(f);assert.equal(result.messages.filter(m=>m.customType==="prime-claw-bounded-identity-package").length,1);assert.match(result.messages.at(-1).content,/role=EPISODE/);assert.equal(result.messages.filter(m=>m.customType===OVERSIGHT_PACKAGE_TYPE).length,0)});

test("copied marker is inert in an ordinary fork",t=>{const parent=fixture(t);const episode=identity(parent);appendActiveOversight(parent.pi,parent.ctx,episode);const fork=fixture(t,{sessionId:"fork",entries:parent.branch});const result=context(fork);assert.equal(result.messages.filter(m=>m.customType===OVERSIGHT_PACKAGE_TYPE).length,0);assert.equal(fork.aborts,0)});

test("active corruption blocks visibly before downstream provider work",t=>{for(const kind of ["missing-kernel","duplicate-kernel","missing-package","bad-package","expectation-mismatch","bad-marker"]){const prompt=kind==="missing-kernel"?"BASE":kind==="duplicate-kernel"?`${IDENTITY_KERNEL} ${IDENTITY_KERNEL}`:IDENTITY_KERNEL;const f=fixture(t,{prompt});const episode=identity(f);appendActiveOversight(f.pi,f.ctx,episode);if(kind==="missing-package")rmSync(f.packagePath);if(kind==="bad-package")writeFileSync(f.packagePath,"bad");if(kind==="expectation-mismatch"){const p=join(f.cwd,".prime/agent/state/spec-episodes/alpha.json");const d=JSON.parse(readFileSync(p, "utf8"));d.episodeId="wrong";writeFileSync(p,JSON.stringify(d))}if(kind==="bad-marker")f.branch.at(-1).data.version=99;assert.throws(()=>context(f),/prime-claw conversation blocked/);assert.equal(f.aborts,1);assert.equal(f.notifications.length,1)}});

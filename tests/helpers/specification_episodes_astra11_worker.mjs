import assert from "node:assert/strict";
import child from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { acquireProjectLock, ensureControlDirectory, releaseProjectLock } from "../../.prime/agent/extensions/specification-episodes.ts";

const kind = process.argv[2];
const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), `prime-claw-astra11-${kind}-`)));
const common = join(root, "repo/.git");
const locks = join(common, "prime-claw/locks");
const lockPath = join(locks, "project-mutation.lock");
fs.mkdirSync(locks, { recursive: true });
try {
  if (kind === "cleanup") {
    const savedLocks = join(root, "saved-locks"); const outside = join(root, "external");
    const externalLock = join(outside, "project-mutation.lock");
    fs.mkdirSync(externalLock, { recursive: true }); fs.writeFileSync(join(externalLock, "unowned-sentinel"), "MUST SURVIVE");
    const realExec = child.execFileSync; let injected = false;
    child.execFileSync = (command, args, options) => {
      const request = typeof options?.input === "string" ? JSON.parse(options.input) : null;
      if (request?.operation === "acquire-lock" && !injected) { injected = true; fs.renameSync(locks, savedLocks); fs.symlinkSync(outside, locks, "dir"); }
      return realExec(command, args, options);
    };
    syncBuiltinESMExports();
    try { assert.throws(() => acquireProjectLock(lockPath, "disp-astra11", "owner-astra11")); }
    finally { child.execFileSync = realExec; syncBuiltinESMExports(); }
    assert.equal(injected, true); assert.equal(fs.readFileSync(join(externalLock, "unowned-sentinel"), "utf8"), "MUST SURVIVE");
    assert.equal(fs.existsSync(join(savedLocks, "project-mutation.lock")), false);
  } else if (kind === "owner") {
    const savedLock = join(root, "created-lock"); const realExec = child.execFileSync; let injected = false;
    child.execFileSync = (command, args, options) => {
      const request = typeof options?.input === "string" ? JSON.parse(options.input) : null;
      const result = realExec(command, args, options);
      if (request?.operation === "acquire-lock" && !injected) { injected = true; fs.renameSync(lockPath, savedLock); fs.mkdirSync(lockPath); fs.writeFileSync(join(lockPath, "owner.json"), JSON.stringify({token:"another-owner"})); }
      return result;
    };
    syncBuiltinESMExports();
    try { assert.throws(() => acquireProjectLock(lockPath, "disp-astra11", "owner-astra11"), /lock incarnation changed/); }
    finally { child.execFileSync = realExec; syncBuiltinESMExports(); }
    assert.equal(injected, true); assert.equal(JSON.parse(fs.readFileSync(join(lockPath,"owner.json"),"utf8")).token,"another-owner"); assert.equal(fs.existsSync(join(savedLock,"owner.json")),true);
  } else if (kind === "postvalidate") {
    const realExec = child.execFileSync; let injected = false;
    child.execFileSync = (command, args, options) => {
      const request = typeof options?.input === "string" ? JSON.parse(options.input) : null;
      if (request?.operation === "validate-lock" && !injected) { injected = true; throw new Error("injected post-helper validation failure"); }
      return realExec(command, args, options);
    };
    syncBuiltinESMExports();
    try { assert.throws(() => acquireProjectLock(lockPath, "disp-astra19", "owner-astra19"), /post-helper validation failure/); }
    finally { child.execFileSync = realExec; syncBuiltinESMExports(); }
    assert.equal(injected, true); assert.equal(fs.existsSync(lockPath), false); assert.equal(fs.existsSync(`${lockPath}.guard`), false);
  } else if (kind === "intercall") {
    ensureControlDirectory(common, "locks");
    const savedLocks = join(root, "observed-locks");
    fs.renameSync(locks, savedLocks); fs.mkdirSync(locks);
    assert.throws(() => acquireProjectLock(lockPath,"disp-astra11","owner-astra11"), /lock parent incarnation changed|directory(?: authority)?(?: incarnation)? changed/);
    assert.equal(fs.existsSync(join(savedLocks, "project-mutation.lock")), false);
    assert.equal(fs.existsSync(join(locks, "project-mutation.lock")), false);
  } else if (kind === "release-response") {
    const acquired = acquireProjectLock(lockPath,"disp-astra19","owner-astra19");
    const realExec = child.execFileSync; let injected = false;
    child.execFileSync = (command, args, options) => {
      const request = typeof options?.input === "string" ? JSON.parse(options.input) : null;
      if (request?.operation === "remove-lock" && !injected) { const result = realExec(command,args,options); injected = true; throw new Error("lost lock-release response"); }
      return realExec(command,args,options);
    };
    syncBuiltinESMExports();
    try { releaseProjectLock(acquired); }
    finally { child.execFileSync = realExec; syncBuiltinESMExports(); }
    assert.equal(injected,true); assert.equal(fs.existsSync(lockPath),false); assert.equal(fs.existsSync(`${lockPath}.guard`),false);
  } else if (kind === "release") {
    const savedLock = join(root, "created-lock"); const acquired = acquireProjectLock(lockPath,"disp-astra11","owner-astra11");
    fs.renameSync(lockPath,savedLock); fs.mkdirSync(lockPath); fs.writeFileSync(join(lockPath,"owner.json"),JSON.stringify({token:"another-owner"}));
    assert.throws(() => releaseProjectLock(acquired),/lock incarnation changed before release/);
    assert.equal(JSON.parse(fs.readFileSync(join(lockPath,"owner.json"),"utf8")).token,"another-owner"); assert.equal(fs.existsSync(join(savedLock,"owner.json")),true);
  } else throw new Error(`unknown ASTRA-11 case: ${kind}`);
  console.log(`ASTRA11_${kind.toUpperCase()}_OK`);
} finally { fs.rmSync(root,{recursive:true,force:true}); }

import assert from "node:assert/strict";
import child from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { removeDurableFile } from "../../.prime/agent/extensions/specification-episodes.ts";

const kind = process.argv[2];
const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), `prime-claw-astra22-${kind}-`)));
const common = join(root, "repo/.git"); const state = join(common, "prime-claw/state"); const quarantine = join(common, "prime-claw/quarantine");
fs.mkdirSync(state, { recursive: true }); fs.mkdirSync(quarantine, { recursive: true });
const target = join(state, "blocker.json"); const owned = JSON.stringify({version:1,disposition_id:"owned"}); fs.writeFileSync(target, owned);
const realExec = child.execFileSync; let injected = false;
child.execFileSync = (command, args, options) => {
  const request = typeof options?.input === "string" ? JSON.parse(options.input) : null;
  if (kind === "replacement" && request?.operation === "read-file" && request.path.endsWith("blocker.json") && !injected) {
    const result = realExec(command, args, options); injected = true;
    fs.renameSync(target, join(root, "approved-blocker.json")); fs.writeFileSync(target, JSON.stringify({version:1,disposition_id:"replacement"}));
    return result;
  }
  if (kind === "response" && request?.operation === "remove-file" && !injected) {
    const result = realExec(command, args, options); injected = true; throw new Error("injected lost helper response");
  }
  return realExec(command, args, options);
};
syncBuiltinESMExports();
try {
  if (kind === "response") {
    removeDurableFile(target); assert.equal(injected, true); assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readdirSync(quarantine).filter((name) => fs.readFileSync(join(quarantine,name),"utf8") === owned).length, 1);
  } else if (kind === "replacement") {
    assert.throws(() => removeDurableFile(target), /incarnation changed|retirement/); assert.equal(injected, true);
    assert.equal(JSON.parse(fs.readFileSync(target,"utf8")).disposition_id, "replacement"); assert.equal(fs.readFileSync(join(root,"approved-blocker.json"),"utf8"), owned);
  } else throw new Error(`unknown mode ${kind}`);
  console.log(`ASTRA22_${kind.toUpperCase()}_OK`);
} finally { child.execFileSync = realExec; syncBuiltinESMExports(); fs.rmSync(root,{recursive:true,force:true}); }

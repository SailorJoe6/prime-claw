import { acquireProjectLock } from "../../.prime/agent/extensions/specification-episodes.ts";
const lock=process.argv[2]; acquireProjectLock(lock,"disp-abandoned","session-abandoned"); console.log("ORPHAN_LOCK_READY");

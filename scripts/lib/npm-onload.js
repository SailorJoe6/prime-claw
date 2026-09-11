// prime-claw Phase 1 workaround: the OpenShell L7 proxy socket-resets URLs
// whose path contains an encoded slash (%2F, any case) — npm's canonical form
// for scoped packages. Decode it to a literal slash, which the proxy allows.
function decodePath(url) {
  try {
    const u = new URL(url);
    if (/%2f/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/%2f/gi, "/");
      return u.toString();
    }
  } catch {}
  return url;
}
const _fetch = globalThis.fetch;
globalThis.fetch = (input, init) => _fetch(typeof input === "string" ? decodePath(input) : input, init);
try {
  const https = require("node:https");
  const _req = https.request;
  https.request = function (url, ...rest) {
    if (typeof url === "string") url = decodePath(url);
    else if (url && typeof url === "object" && url.path && /%2f/i.test(url.path)) {
      url = { ...url, path: url.path.replace(/%2f/gi, "/") };
    }
    return _req.call(this, url, ...rest);
  };
} catch {}

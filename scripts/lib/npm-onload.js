// prime-claw runtime preload.
//
// 1) OpenShell L7 resets npm URLs containing encoded slashes (%2F). npm's scoped
//    package URLs use that form, so decode them to literal slashes.
// 2) openai-codex OAuth stays host-side in an OpenShell provider. prime-agent must
//    locally parse a JWT to derive an account id, so auth.json contains a NON-SECRET
//    synthetic JWT. Immediately before chatgpt.com I/O, rewrite the synthetic
//    Authorization/account headers to the OpenShell placeholders from the environment;
//    L7 swaps those for real values at the boundary. Real OAuth never enters the process.

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

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return "";
}

function isCodexUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === "chatgpt.com" || host === "ab.chatgpt.com" ||
      host === "api.openai.com" || host === "auth.openai.com";
  } catch {
    return false;
  }
}

function projectedCodexHeaders(source) {
  const access = process.env.access_token || "";
  const account = process.env.account_id || "";
  if (!access.startsWith("openshell:resolve:") || !account.startsWith("openshell:resolve:")) {
    return source;
  }
  const headers = new Headers(source || {});
  headers.set("authorization", `Bearer ${access}`);
  headers.set("chatgpt-account-id", account);
  return headers;
}

const _fetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  let nextInput = typeof input === "string" ? decodePath(input) : input;
  let nextInit = init;
  const url = requestUrl(nextInput);
  if (isCodexUrl(url)) {
    const inherited = init?.headers || (nextInput && nextInput.headers);
    const headers = projectedCodexHeaders(inherited);
    if (typeof Request === "function" && nextInput instanceof Request) {
      nextInput = new Request(nextInput, { headers });
      nextInit = init ? { ...init, headers } : undefined;
    } else {
      nextInit = { ...(init || {}), headers };
    }
  }
  return _fetch(nextInput, nextInit);
};

// Prime Agent prefers WebSocket for Codex and falls back to SSE. Rewrite both paths.
try {
  const NativeWebSocket = globalThis.WebSocket;
  if (typeof NativeWebSocket === "function") {
    globalThis.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, args, newTarget) {
        const [url, options, ...rest] = args;
        if (isCodexUrl(String(url))) {
          const nextOptions = { ...(options || {}), headers: projectedCodexHeaders(options?.headers) };
          return Reflect.construct(target, [url, nextOptions, ...rest], newTarget);
        }
        return Reflect.construct(target, args, newTarget);
      },
    });
  }
} catch {}

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

"""Unit-env body: real Node preload behavior for npm-onload."""

from unit_env_entry import require_unit_env
require_unit_env()

import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

def test_npm_onload_rewrites_request_paths_and_synthetic_codex_headers_offline():
    preload = str(REPO / "scripts" / "lib" / "npm-onload.js")
    js = r"""
const https = require('node:https');
https.request = (input) => {
  const value = typeof input === 'string' ? input : input.path;
  console.log(JSON.stringify({kind:'https', value}));
  return {on(){return this}, end(){}};
};
globalThis.fetch = async (input, init) => {
  const h = new Headers(init?.headers);
  console.log(JSON.stringify({
    kind:'fetch', value:String(input),
    authorization:h.get('authorization'),
    account:h.get('chatgpt-account-id')
  }));
  return {ok:true};
};
require(process.argv[1]);
fetch('https://registry.npmjs.org/@scope%2Fpackage');
fetch('https://chatgpt.com/backend-api/codex/responses', {
  headers: {authorization:'Bearer SYNTHETIC.JWT.VALUE', 'chatgpt-account-id':'synthetic'}
});
https.request({hostname:'registry.npmjs.org', path:'/@scope%2Fpackage'});
"""
    env = dict(os.environ, access_token="openshell:resolve:env:v1_access_token",
               account_id="openshell:resolve:env:v1_account_id")
    result = subprocess.run(
        ["node", "-e", js, preload], capture_output=True, text=True,
        env=env, check=False)
    assert result.returncode == 0, result.stderr
    rows = [__import__("json").loads(line) for line in result.stdout.splitlines()]
    assert rows == [
        {"kind": "fetch", "value": "https://registry.npmjs.org/@scope/package",
         "authorization": None, "account": None},
        {"kind": "fetch", "value": "https://chatgpt.com/backend-api/codex/responses",
         "authorization": "Bearer openshell:resolve:env:v1_access_token",
         "account": "openshell:resolve:env:v1_account_id"},
        {"kind": "https", "value": "/@scope/package"},
    ]

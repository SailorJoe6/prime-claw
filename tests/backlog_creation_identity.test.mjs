import assert from "node:assert/strict";
import test from "node:test";
import { projectBacklogCreationIdentity } from "../src/prime-agent-plugin/extension-support/backlog-creation-identity.ts";

async function* bytes(text, width) {
  const input = Buffer.from(text);
  for (let offset = 0; offset < input.length; offset += width) yield input.subarray(offset, offset + width);
}

const facts = { id: "CASE-1", path: '.backlog/tasks/a é task "one".md', status: "In Progress" };
const task = JSON.stringify(facts);
const json = `{"schemaVersion":1,"kind":"task-view","task":${task}}`;

test("Backlog creation projection handles escaped keys, split UTF-8 and nested fields", async () => {
  const input = `{"extra":[true,false,null,-0.2e+3,{"task":{"id":"WRONG"}}],"task":{` +
    `"path":${JSON.stringify(facts.path)},"i\\u0064":"CASE-1","status":"In Progress","notes":"other\\npath"},` +
    `"kind":"task-view","schemaVersion":1}\n`;
  assert.deepEqual(await projectBacklogCreationIdentity(bytes(input, 1)), facts);
});

test("Backlog creation projection discards a large single nested value", async () => {
  const input = json.replace(`"task":${task}`, `"task":{"notes":"${"x".repeat(1_200_000)}",${task.slice(1)}`);
  assert.deepEqual(await projectBacklogCreationIdentity(bytes(input, 4096)), facts);
});

test("Backlog creation projection rejects ambiguous, malformed and partial responses", async () => {
  for (const input of [json.slice(0, -1), json + "{}", json.replace('"CASE-1"', '"WRONG","id":"CASE-1"'),
    json.replace('"CASE-1"', '"CASE-1\\v"'), json.replace('"schemaVersion":1', '"schemaVersion":2'),
    json.replace('"task":', '"task":{},"task":'), json.replace('"task":', '"extra":[01],"task":')]) {
    await assert.rejects(projectBacklogCreationIdentity(bytes(input, 3)), /invalid or unsupported/);
  }
});

/** Pair-specific current Beads content -> native Backlog authoring.
 * No importer, transport ownership, source retirement, or revision archive lives here.
 */
import { MigrationBacklogWebError } from "./migration-backlog-web.ts";

type Row = Record<string, unknown>;

export interface BeadsCurrentTaskPackage {
  sourceTaskId: string;
  exportRow: Row;
  nativeView: Row;
}

export interface BeadsCurrentTaskContext {
  sourceRevision: string;
  sourceDigest: string;
  status: string;
  parentTaskId?: string;
  dependencies: string[];
  priorities: string[];
  types: string[];
}

export interface BeadsCurrentTaskProjection {
  /** Actual POST /api/tasks fields, not the CLI JSON vocabulary. */
  payload: Record<string, unknown>;
  comments: Array<{ body: string; author: string }>;
  /** Authored state in the full CLI task-view vocabulary. Generated dates are not source dates. */
  expected: Record<string, unknown>;
}

/** Structural dependency: the existing native Web transport owns all I/O. */
export interface BeadsCurrentTaskWeb {
  createTask(payload: Record<string, unknown>): Promise<any>;
  updateTask(id: string, payload: Record<string, unknown>): Promise<any>;
  readTask(id: string): Promise<any>;
}

function fail(stage: string): never {
  // Never echo source values, native responses, or arbitrary provider exceptions.
  throw new Error(`Beads current task operation failed (${stage}). No automatic retry was attempted.`);
}

function object(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (object(left) && object(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
  }
  return false;
}

function readableJson(value: unknown): string {
  // Escaping '<' keeps even a quoted COMMENT marker legal in native comments.
  // This remains readable JSON, never an encoded export or snapshot envelope.
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) fail("non-json-current-value");
  return serialized.replace(/</g, "\\u003c");
}

function unsafeMarkdown(value: string): boolean {
  return value !== value.trim() || /\r/.test(value) || /\n[\t ]*\n[\t ]*\n/.test(value)
    || /^\s*---\s*$/m.test(value)
    // Native legacy fallback can read this title from inside a source comment.
    || /## Final Summary\s*(?:\n|$)/i.test(value)
    || /<!--\s*COMMENTS?:/i.test(value)
    || /^\s*<!-- (?:SECTION:[A-Z][A-Z0-9_]*|AC|DOD):(?:BEGIN|END) -->[\t ]*$/m.test(value);
}

function prose(value: unknown, label: string, singleLine = false): string {
  if (typeof value !== "string") return `${label} (JSON): ${readableJson(value)}`;
  if (unsafeMarkdown(value) || (singleLine && /\n/.test(value))) {
    return `${label} (exact JSON string): ${readableJson(value)}`;
  }
  return value;
}

function list(value: unknown): string[] {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

// Drop only active deferral-only fields. Capture packages are outside the two
// current source rows; unknown current fields survive regardless of their names.
const DEFERRAL_FIELDS = new Set([
  "defer_until", "deferred_until", "deferUntil", "deferredUntil", "deferred_at", "deferredAt",
  "snoozed_until", "snoozedUntil", "snooze_until", "snoozeUntil",
]);

interface Field { origin: "native" | "export"; key: string; value: unknown }

function projectComments(pkg: BeadsCurrentTaskPackage): Array<{ body: string; author: string }> {
  const native = Array.isArray(pkg.nativeView.comments) ? pkg.nativeView.comments : [];
  const exported = Array.isArray(pkg.exportRow.comments) ? pkg.exportRow.comments : [];
  const fields = (value: unknown): Row => object(value) ? value : { text: value };
  const bodyValue = (row: Row) => row.text ?? row.body ?? row.content;
  const identity = (row: Row) => row.id ?? row.comment_id;
  const semantic = (a: Row, b: Row) => equal(bodyValue(a), bodyValue(b))
    && equal(a.author ?? a.created_by, b.author ?? b.created_by)
    && equal(a.created_at ?? a.createdAt, b.created_at ?? b.createdAt);
  const comments = native.map((value) => ({ row: fields(value), alternatives: [] as Row[] }));
  for (const value of exported) {
    const row = fields(value);
    const found = comments.find((entry) => identity(row) !== undefined && identity(entry.row) !== undefined
      ? equal(identity(row), identity(entry.row)) : semantic(row, entry.row));
    if (found) {
      if (!equal(row, found.row)) found.alternatives.push(row);
    } else comments.push({ row, alternatives: [] });
  }
  return comments.map(({ row, alternatives }) => {
    const chosenBody = bodyValue(row);
    const rawAuthor = row.author ?? row.created_by;
    const author = typeof rawAuthor === "string" && rawAuthor.trim()
      && !/<!--\s*COMMENTS?:/i.test(rawAuthor) && !/^\s*---\s*$/m.test(rawAuthor)
      ? rawAuthor.replace(/\s+/g, " ").trim() : "beads";
    const parts: string[] = [];
    const add = (key: string, value: unknown) => parts.push(`Beads ${readableJson(key)}: ${prose(value, readableJson(key))}`);
    if (chosenBody === undefined) add("text", null);
    else if (chosenBody === "") parts.push('Beads comment text (exact JSON string): ""');
    else parts.push(prose(chosenBody, "Beads comment text"));
    if (rawAuthor !== undefined && rawAuthor !== author) add("author", rawAuthor);
    const timestamp = row.created_at ?? row.createdAt;
    if (timestamp !== undefined) add("source created_at", timestamp);
    for (const [key, value] of Object.entries(row)) {
      if (DEFERRAL_FIELDS.has(key)) continue;
      if (["text", "body", "content"].includes(key) && equal(value, chosenBody)) continue;
      if (["author", "created_by"].includes(key) && equal(value, rawAuthor)) continue;
      if (["created_at", "createdAt"].includes(key) && equal(value, timestamp)) continue;
      add(key, value);
    }
    for (const alternative of alternatives) {
      for (const [key, value] of Object.entries(alternative)) {
        if (DEFERRAL_FIELDS.has(key) || equal(value, row[key])) continue;
        if (["text", "body", "content"].includes(key) && equal(value, chosenBody)) continue;
        if (["author", "created_by"].includes(key) && equal(value, rawAuthor)) continue;
        if (["created_at", "createdAt"].includes(key) && equal(value, timestamp)) continue;
        add(`export ${key}`, value);
      }
    }
    return { body: parts.join("\n\n"), author };
  });
}

/** Project complete current fields only. Callers supply already-mapped destination relationships/status. */
export function projectBeadsCurrentTask(pkg: BeadsCurrentTaskPackage, context: BeadsCurrentTaskContext): BeadsCurrentTaskProjection {
  try {
    if (!object(pkg.exportRow) || !object(pkg.nativeView) || !pkg.sourceTaskId || !context.status
      || !context.sourceRevision || !context.sourceDigest) fail("projection-input");
    const notes: string[] = [];
    const seen = new Map<string, unknown[]>();
    const supplement = (field: Field) => {
      const values = seen.get(field.key) ?? [];
      if (values.some((value) => equal(value, field.value))) return;
      values.push(field.value); seen.set(field.key, values);
      notes.push(`Beads ${field.origin} ${readableJson(field.key)}: ${prose(field.value, readableJson(field.key))}`);
    };
    const handled = new Set<string>(["id", "comments"]);
    const take = (keys: string[], represented: (value: unknown) => boolean = () => true): Field | undefined => {
      keys.forEach((key) => handled.add(key));
      const entries: Field[] = [];
      for (const [origin, row] of [["native", pkg.nativeView], ["export", pkg.exportRow]] as const) {
        for (const key of keys) if (Object.hasOwn(row, key) && row[key] !== undefined) entries.push({ origin, key, value: row[key] });
      }
      const chosen = entries[0];
      if (chosen) {
        for (const entry of entries) if (!equal(entry.value, chosen.value) || !represented(entry.value)) supplement(entry);
      }
      return chosen;
    };
    const text = (keys: string[], label: string): string => {
      const field = take(keys);
      return field ? prose(field.value, `Beads ${label}`) : "";
    };
    const rawTitle = take(["title"], (value) => typeof value === "string" && value === value.trim() && Boolean(value));
    const title = typeof rawTitle?.value === "string" && rawTitle.value.trim() ? rawTitle.value.trim() : pkg.sourceTaskId;
    const description = text(["description"], "description");
    const implementationPlan = text(["design", "implementationPlan", "plan"], "design");
    const originalNotes = text(["notes", "implementationNotes"], "notes");
    const finalSummary = text(["close_reason", "finalSummary"], "close_reason");
    const ac = take(["acceptance_criteria", "acceptanceCriteria", "acceptanceCriteriaItems"]);
    const criteria: Array<{ text: string; checked: boolean }> = [];
    if (ac) {
      const values = Array.isArray(ac.value) ? ac.value : ac.value === "" ? [] : [ac.value];
      values.forEach((value, index) => {
        if (object(value) && Object.hasOwn(value, "text")) {
          criteria.push({ text: prose(value.text, "Beads acceptance criterion", true) || 'Beads acceptance criterion (JSON): ""', checked: value.checked === true });
          for (const [key, item] of Object.entries(value)) {
            if (key !== "text" && key !== "checked") supplement({ origin: ac.origin, key: `${ac.key}[${index}].${key}`, value: item });
            if (key === "checked" && typeof item !== "boolean") supplement({ origin: ac.origin, key: `${ac.key}[${index}].checked`, value: item });
          }
        } else criteria.push({ text: prose(value, "Beads acceptance_criteria", true) || 'Beads acceptance criterion (JSON): ""', checked: false });
      });
    }
    const labels = take(["labels"], (value) => equal(value, list(value)));
    const assignee = take(["assignee", "assignees"], (value) => typeof value === "string"
      ? (value === "" || (value === value.trim() && Boolean(value))) : equal(value, list(value)));
    const normalizePriority = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const priorities = (context.priorities.length ? context.priorities : ["high", "medium", "low"]).map(normalizePriority).filter(Boolean);
    const types = (context.types.length ? context.types : ["bug", "feature", "enhancement", "task", "chore", "docs", "spike"]).map((value) => value.trim()).filter(Boolean);
    const rawPriority = take(["priority"], (value) => typeof value === "string" && priorities.includes(normalizePriority(value)));
    let priority: string | undefined;
    if (rawPriority) {
      const raw = rawPriority.value;
      const exact = typeof raw === "string" ? priorities.find((value) => value === normalizePriority(raw)) : undefined;
      const numeric = (typeof raw === "number" || (typeof raw === "string" && /^[0-4]$/.test(raw))) ? Number(raw) : NaN;
      const alias = Number.isFinite(numeric) && numeric >= 0 && numeric <= 4 ? numeric <= 1 ? "high" : numeric >= 3 ? "low" : "medium" : undefined;
      const numbered = Number.isInteger(numeric) && numeric >= 0 && numeric <= 4
        ? priorities.find((value) => value === `p${numeric}`) : undefined;
      priority = exact ?? numbered ?? priorities.find((value) => value === alias) ?? priorities[0];
    }
    const rawType = take(["issue_type", "type"], (value) => typeof value === "string" && types.some((type) => type.toLowerCase() === value.trim().toLowerCase()));
    let type: string | undefined;
    if (rawType) {
      const raw = typeof rawType.value === "string" ? rawType.value.trim().toLowerCase() : "";
      const aliases: Record<string, string> = { story: "feature", milestone: "task", epic: "task", decision: "task", "merge-request": "task", molecule: "task", gate: "task", convoy: "task" };
      type = types.find((value) => value.toLowerCase() === raw)
        ?? types.find((value) => value.toLowerCase() === aliases[raw])
        ?? types.find((value) => value.toLowerCase() === "task") ?? types[0];
    }
    take(["status"], (value) => value === "deferred" || value === context.status);
    take(["parent", "parent_id", "parentTaskId"], (value) => typeof value === "string" || value === null);
    const dependencies = take(["dependencies"]);
    if (dependencies && Array.isArray(dependencies.value)) {
      dependencies.value.forEach((value, index) => {
        if (object(value)) {
          for (const [key, item] of Object.entries(value)) {
            if (!["id", "depends_on_id", "issue_id"].includes(key)) supplement({ origin: dependencies.origin, key: `dependencies[${index}].${key}`, value: item });
          }
        } else if (typeof value !== "string") supplement({ origin: dependencies.origin, key: `dependencies[${index}]`, value });
      });
    } else if (dependencies && dependencies.value !== null) supplement(dependencies);
    for (const [origin, row] of [["native", pkg.nativeView], ["export", pkg.exportRow]] as const) {
      for (const [key, value] of Object.entries(row)) {
        if (!handled.has(key) && !DEFERRAL_FIELDS.has(key) && value !== undefined) supplement({ origin, key, value });
      }
      if (Object.hasOwn(row, "comments") && !Array.isArray(row.comments)) supplement({ origin, key: "comments", value: row.comments });
    }
    const implementationNotes = [originalNotes, ...notes].filter(Boolean).join("\n\n");
    const comments = projectComments(pkg);
    const references = [
      `prime-claw-beads-source:${pkg.sourceTaskId}`,
      `prime-claw-beads-current:${readableJson({ sourceTaskId: pkg.sourceTaskId, sourceRevision: context.sourceRevision, sourceDigest: context.sourceDigest })}`,
    ];
    const payload: Record<string, unknown> = {
      title, description, implementationPlan, implementationNotes, finalSummary,
      status: context.status, labels: list(labels?.value), assignee: list(assignee?.value),
      dependencies: [...context.dependencies], references, acceptanceCriteriaItems: criteria,
      disableDefinitionOfDoneDefaults: true,
      ...(context.parentTaskId ? { parentTaskId: context.parentTaskId } : {}),
      ...(priority ? { priority } : {}), ...(type ? { type } : {}),
    };
    const expected: Record<string, unknown> = {
      title, description: description || null, implementationPlan: implementationPlan || null,
      implementationNotes: implementationNotes || null, finalSummary: finalSummary || null,
      status: context.status, type: type ?? null, priority: priority ?? null,
      assignees: payload.assignee, labels: payload.labels, dependencies: payload.dependencies, references,
      parentTaskId: context.parentTaskId ?? null,
      acceptanceCriteria: criteria.map((item, index) => ({ index: index + 1, ...item })),
      acceptanceCriteriaCount: criteria.length, acceptanceCriteriaCompleted: criteria.filter((item) => item.checked).length,
      comments: comments.map((item, index) => ({ index: index + 1, ...item })),
      definitionOfDone: [], reporter: null, project: null, milestone: null, dueDate: null,
      documentation: [], modifiedFiles: [],
    };
    return { payload, comments, expected };
  } catch { fail("projection"); }
}

/** Compare the complete authored state from `backlog task view --json`. */
export function assertBeadsCurrentTask(view: unknown, projection: BeadsCurrentTaskProjection, destinationId: string): void {
  if (!object(view) || view.schemaVersion !== 1 || view.kind !== "task-view" || !object(view.task)) fail("native-readback-envelope");
  const task = view.task;
  if (task.id !== destinationId) fail("native-readback-identity");
  for (const [key, expected] of Object.entries(projection.expected)) {
    if (key === "comments") {
      if (!Array.isArray(task.comments)) fail("native-readback-comments");
      const actual = task.comments.map((value) => {
        if (!object(value) || typeof value.createdAt !== "string" || !value.createdAt) fail("native-readback-comments");
        return { index: value.index, body: value.body, author: value.author };
      });
      if (!equal(actual, expected)) fail("native-readback-comments");
    } else if (!equal(task[key], expected)) fail("native-readback-fields");
  }
}

/** One POST, one sequential PUT per actual source comment, then full CLI verification. */
export async function authorBeadsCurrentTask(web: BeadsCurrentTaskWeb, projection: BeadsCurrentTaskProjection, assertTarget?: (id: string) => void): Promise<string> {
  let created: unknown;
  try { created = await web.createTask(projection.payload); }
  catch (error) {
    if (error instanceof MigrationBacklogWebError) throw error;
    fail("native-create; effects may be partial");
  }
  if (!object(created) || typeof created.id !== "string" || !created.id || /\s/.test(created.id) || created.id.startsWith("-")) fail("native-create-response; effects may be partial");
  const id = created.id;
  assertTarget?.(id);
  for (const comment of projection.comments) {
    try { await web.updateTask(id, { commentsAppend: [comment.body], commentAuthor: comment.author }); }
    catch (error) {
      if (error instanceof MigrationBacklogWebError) throw error;
      fail("native-comment; effects may be partial");
    }
  }
  let view: unknown;
  try { view = await web.readTask(id); }
  catch (error) {
    if (error instanceof MigrationBacklogWebError) throw error;
    fail("native-readback; authored task remains unverified");
  }
  assertBeadsCurrentTask(view, projection, id);
  return id;
}

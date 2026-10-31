import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const VISIBILITIES = new Set(["public", "private"]);
const PRIVACY_CLASSES = new Set([
  "PUBLIC",
  "AGGREGATE",
  "SYNTHETIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
]);
const EVIDENCE_MODES = new Set([
  "LIVE_SOURCE",
  "VERIFIED_IMPORT",
  "HUMAN_ATTESTED",
  "DERIVED",
  "SYNTHETIC",
]);
const PUBLIC_PRIVACY_CLASSES = new Set(["PUBLIC", "AGGREGATE", "SYNTHETIC"]);
const SECRET_KEYS = policyKeyPattern([
  "secret", "password", "privatekey", "apikey", "accesstoken", "refreshtoken", "seedphrase", "mnemonic",
]);
const DIRECT_CONTACT_KEYS = policyKeyPattern([
  "email", "phone", "mobile", "telephone", "ssn", "socialsecurity", "dateofbirth",
]);

function policyKeyPattern(markers) {
  // Fixed ASCII markers allow normalized separators without matching inside words.
  return new RegExp(`(^|_)(${markers.map(marker => [...marker].join("_*")).join("|")})($|_)`, "i");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function walkFiles(root, suffix = ".json") {
  const files = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkFiles(resolved, suffix)));
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        files.push(resolved);
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return files.sort();
}

function findSensitiveKeys(value, prefix = "", matches = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSensitiveKeys(item, `${prefix}[${index}]`, matches));
    return matches;
  }
  if (!value || typeof value !== "object") return matches;

  for (const [key, child] of Object.entries(value)) {
    const pointer = prefix ? `${prefix}.${key}` : key;
    const policyKey = key.normalize("NFKC")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-z0-9]+/gi, "_");
    if (SECRET_KEYS.test(policyKey)) matches.push({ kind: "secret", path: pointer });
    if (DIRECT_CONTACT_KEYS.test(policyKey)) matches.push({ kind: "direct-contact", path: pointer });
    findSensitiveKeys(child, pointer, matches);
  }
  return matches;
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be an object"];
  }
  if (manifest.schemaVersion !== "1.0") errors.push("manifest.schemaVersion must be 1.0");
  if (!/^dreamnet:\/\/[a-z0-9][a-z0-9./_-]+$/i.test(manifest.repoId ?? "")) {
    errors.push("manifest.repoId must be a dreamnet:// URI");
  }
  if (!manifest.objectType) errors.push("manifest.objectType is required");
  if (!VISIBILITIES.has(manifest.visibility)) {
    errors.push("manifest.visibility must be public or private");
  }
  if (!manifest.owners?.length) errors.push("manifest.owners must contain at least one owner");
  if (manifest.canonicalBranch !== "main") {
    errors.push("manifest.canonicalBranch must be main");
  }
  return errors;
}

function validateEvent(event, manifest, relativePath) {
  const errors = [];
  if (event.schemaVersion !== "1.0") errors.push(`${relativePath}: schemaVersion must be 1.0`);
  if (!/^urn:dreamnet:event:[0-9a-f-]{36}$/i.test(event.eventId ?? "")) {
    errors.push(`${relativePath}: eventId must be a DreamNet event URN`);
  }
  if (!event.eventType) errors.push(`${relativePath}: eventType is required`);
  if (!Number.isFinite(Date.parse(event.occurredAt ?? ""))) {
    errors.push(`${relativePath}: occurredAt must be an ISO timestamp`);
  }
  if (!PRIVACY_CLASSES.has(event.privacyClass)) {
    errors.push(`${relativePath}: invalid privacyClass`);
  }
  if (!EVIDENCE_MODES.has(event.evidenceMode)) {
    errors.push(`${relativePath}: invalid evidenceMode`);
  }
  if (!event.provenance?.sourceRef) {
    errors.push(`${relativePath}: provenance.sourceRef is required`);
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(event.contentHash ?? "")) {
    errors.push(`${relativePath}: invalid contentHash`);
  } else {
    const actual = `sha256:${sha256(stableJson(event.payload))}`;
    if (event.contentHash !== actual) {
      errors.push(`${relativePath}: contentHash does not match payload`);
    }
  }

  const sensitive = findSensitiveKeys(event.payload);
  for (const match of sensitive.filter((item) => item.kind === "secret")) {
    errors.push(`${relativePath}: secret-shaped field is forbidden at payload.${match.path}`);
  }
  if (manifest.visibility === "public") {
    if (!PUBLIC_PRIVACY_CLASSES.has(event.privacyClass)) {
      errors.push(`${relativePath}: ${event.privacyClass} data is forbidden in public repositories`);
    }
    for (const match of sensitive.filter((item) => item.kind === "direct-contact")) {
      errors.push(`${relativePath}: direct-contact field is forbidden in public data at payload.${match.path}`);
    }
  }
  if (
    ["CONFIDENTIAL", "RESTRICTED"].includes(event.privacyClass) &&
    event.storageMode !== "ENCRYPTED_POINTER"
  ) {
    errors.push(`${relativePath}: confidential data requires storageMode ENCRYPTED_POINTER`);
  }

  return errors;
}

async function inspectRepository(repoPath) {
  const root = path.resolve(repoPath);
  const manifestPath = path.join(root, ".dreamnet", "repo.json");
  const errors = [];
  const events = [];
  let manifest;

  try {
    manifest = await readJson(manifestPath);
    errors.push(...validateManifest(manifest));
    if (errors.length) {
      return { events, validation: { valid: false, repository: root, filesChecked: 0, errors } };
    }
  } catch (error) {
    return { events, validation: {
      valid: false,
      repository: root,
      filesChecked: 0,
      errors: [`Cannot read ${manifestPath}: ${error.message}`],
    } };
  }

  const eventFiles = await walkFiles(path.join(root, "events"));
  const seenIds = new Set();
  const seenHashes = new Set();

  for (const file of eventFiles) {
    const relativePath = path.relative(root, file).replaceAll("\\", "/");
    try {
      const event = await readJson(file);
      errors.push(...validateEvent(event, manifest, relativePath));
      events.push({ event, relativePath });
      if (seenIds.has(event.eventId)) errors.push(`${relativePath}: duplicate eventId`);
      if (seenHashes.has(event.contentHash)) errors.push(`${relativePath}: duplicate contentHash`);
      seenIds.add(event.eventId);
      seenHashes.add(event.contentHash);
    } catch (error) {
      errors.push(`${relativePath}: ${error.message}`);
    }
  }

  return { events, validation: {
    valid: errors.length === 0,
    repository: root,
    repoId: manifest.repoId,
    filesChecked: eventFiles.length,
    errors,
  } };
}

export async function validateRepository(repoPath) {
  return (await inspectRepository(repoPath)).validation;
}

export async function initializeRepository(repoPath, options) {
  if (!options.repoId || !options.objectType || !VISIBILITIES.has(options.visibility)) {
    throw new Error("--repo-id, --object-type, and --visibility are required");
  }

  const root = path.resolve(repoPath);
  const directories = [".dreamnet", "events", "snapshots", "indexes", "receipts"];
  await Promise.all(directories.map((directory) => mkdir(path.join(root, directory), { recursive: true })));

  const manifest = {
    schemaVersion: "1.0",
    repoId: options.repoId,
    objectType: options.objectType,
    visibility: options.visibility,
    canonicalBranch: "main",
    owners: ["BrandonDucar"],
    paths: {
      events: "events",
      snapshots: "snapshots",
      indexes: "indexes",
      receipts: "receipts",
    },
    projectionPolicy: "REBUILDABLE",
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(root, ".dreamnet", "repo.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return { initialized: true, repository: root, manifestPath };
}

export async function createEvent(repoPath, options) {
  if (!options.eventType || !options.sourceRef || !options.evidenceMode || !options.payloadPath) {
    throw new Error("--event-type, --source, --evidence-mode, and --payload are required");
  }
  if (!EVIDENCE_MODES.has(options.evidenceMode)) {
    throw new Error(`Unsupported evidence mode: ${options.evidenceMode}`);
  }

  const root = path.resolve(repoPath);
  const manifest = await readJson(path.join(root, ".dreamnet", "repo.json"));
  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length) throw new Error(manifestErrors.join("\n"));
  const payload = await readJson(path.resolve(options.payloadPath));
  const now = new Date();
  const eventId = `urn:dreamnet:event:${randomUUID()}`;
  const event = {
    schemaVersion: "1.0",
    eventId,
    eventType: options.eventType,
    occurredAt: now.toISOString(),
    privacyClass: manifest.visibility === "public" ? "PUBLIC" : "INTERNAL",
    evidenceMode: options.evidenceMode,
    storageMode: "INLINE",
    provenance: {
      sourceRef: options.sourceRef,
      retrievedAt: now.toISOString(),
    },
    payload,
    contentHash: `sha256:${sha256(stableJson(payload))}`,
  };

  const datePath = [
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ];
  const directory = path.join(root, "events", ...datePath);
  const eventErrors = validateEvent(event, manifest, "new-event");
  if (eventErrors.length) throw new Error(eventErrors.join("\n"));
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${eventId.split(":").at(-1)}.json`);
  await writeFile(filePath, `${JSON.stringify(event, null, 2)}\n`, { flag: "wx" });
  return { created: true, eventId, contentHash: event.contentHash, filePath };
}

export async function buildIndex(repoPath) {
  const root = path.resolve(repoPath);
  const { events, validation } = await inspectRepository(root);
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const entries = [];

  // Index exactly the parsed objects that passed validation, not a second read.
  for (const { event, relativePath } of events) {
    entries.push({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      privacyClass: event.privacyClass,
      evidenceMode: event.evidenceMode,
      contentHash: event.contentHash,
      path: relativePath,
    });
  }

  entries.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const index = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    eventCount: entries.length,
    entries,
    indexHash: `sha256:${sha256(stableJson(entries))}`,
  };
  const indexDirectory = path.join(root, "indexes");
  await mkdir(indexDirectory, { recursive: true });
  const indexPath = path.join(indexDirectory, "events.json");
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return { indexed: true, eventCount: entries.length, indexPath, indexHash: index.indexHash };
}

export const internals = {
  findSensitiveKeys,
  sha256,
  stableJson,
  validateEvent,
  validateManifest,
};

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildIndex,
  createEvent,
  initializeRepository,
  validateRepository,
  internals,
} from "../lib/git-grid.mjs";

async function temporaryRepository(visibility = "public") {
  const root = await mkdtemp(path.join(os.tmpdir(), "git-grid-"));
  await initializeRepository(root, {
    repoId: "dreamnet://test/events",
    objectType: "test-ledger",
    visibility,
  });
  return root;
}

test("initializes and validates an empty repository", async () => {
  const root = await temporaryRepository();
  const result = await validateRepository(root);
  assert.equal(result.valid, true);
  assert.equal(result.filesChecked, 0);
});

test("creates a content-addressed event and deterministic index", async () => {
  const root = await temporaryRepository();
  const payloadPath = path.join(root, "payload.json");
  await writeFile(payloadPath, JSON.stringify({ symbol: "XAU", price: 2400 }));

  const created = await createEvent(root, {
    eventType: "market.observed",
    sourceRef: "https://example.com/market/xau",
    evidenceMode: "LIVE_SOURCE",
    payloadPath,
  });
  assert.match(created.contentHash, /^sha256:[0-9a-f]{64}$/);

  const validation = await validateRepository(root);
  assert.equal(validation.valid, true);
  assert.equal(validation.filesChecked, 1);

  const index = await buildIndex(root);
  assert.equal(index.eventCount, 1);
});

test("rejects direct contact data in public repositories", async () => {
  const root = await temporaryRepository();
  const payloadPath = path.join(root, "payload.json");
  await writeFile(payloadPath, JSON.stringify({ name: "Example", phone: "555-0100" }));

  const invalidPayload = JSON.parse(await readFile(payloadPath, "utf8"));
  await writeFile(payloadPath, JSON.stringify({ fixture: "safe" }));
  const created = await createEvent(root, {
    eventType: "lead.observed",
    sourceRef: "https://example.gov/record/1",
    evidenceMode: "LIVE_SOURCE",
    payloadPath,
  });
  const event = JSON.parse(await readFile(created.filePath, "utf8"));
  event.payload = invalidPayload;
  event.contentHash = `sha256:${internals.sha256(internals.stableJson(invalidPayload))}`;
  await writeFile(created.filePath, JSON.stringify(event));

  const validation = await validateRepository(root);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /direct-contact field is forbidden/);
});

test("rejects secret-shaped fields in private repositories", async () => {
  const root = await temporaryRepository("private");
  const payloadPath = path.join(root, "payload.json");
  await writeFile(payloadPath, JSON.stringify({ apiKey: "not-allowed" }));

  const invalidPayload = JSON.parse(await readFile(payloadPath, "utf8"));
  await writeFile(payloadPath, JSON.stringify({ fixture: "safe" }));
  const created = await createEvent(root, {
    eventType: "config.observed",
    sourceRef: "urn:test:source",
    evidenceMode: "SYNTHETIC",
    payloadPath,
  });
  const event = JSON.parse(await readFile(created.filePath, "utf8"));
  event.payload = invalidPayload;
  event.contentHash = `sha256:${internals.sha256(internals.stableJson(invalidPayload))}`;
  await writeFile(created.filePath, JSON.stringify(event));

  const validation = await validateRepository(root);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /secret-shaped field is forbidden/);
});

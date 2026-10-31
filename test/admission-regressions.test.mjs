import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEvent, initializeRepository, buildIndex, validateRepository } from '../lib/git-grid.mjs';

async function fixture(t, visibility = 'public') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'git-grid-admission-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  await initializeRepository(root, { repoId: 'dreamnet://test/admission', objectType: 'test-ledger', visibility });
  return root;
}
async function add(root, payload) {
  const payloadPath = path.join(root, 'payload.json');
  await writeFile(payloadPath, JSON.stringify(payload));
  return createEvent(root, { payloadPath, eventType: 'test.observed', evidenceMode: 'SYNTHETIC', sourceRef: 'urn:test:fixture' });
}
test('public contact data is rejected before any event is persisted', async t => {
  const root = await fixture(t);
  await assert.rejects(add(root, { phone: 'fixture-only' }), /direct-contact field is forbidden/);
  assert.deepEqual(await readdir(path.join(root, 'events')), []);
});
test('private repositories also reject secret fields before persistence', async t => {
  const root = await fixture(t, 'private');
  await assert.rejects(add(root, { nested: { apiKey: 'fixture-not-a-real-key' } }), /secret-shaped field is forbidden/);
  assert.deepEqual(await readdir(path.join(root, 'events')), []);
});
test('invalid repository policy blocks event creation', async t => {
  const root = await fixture(t);
  const manifestPath = path.join(root, '.dreamnet', 'repo.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(manifestPath, JSON.stringify({ ...manifest, visibility: 'publik' }));
  await assert.rejects(add(root, { result: 'safe' }), /manifest.visibility/);
  assert.deepEqual(await readdir(path.join(root, 'events')), []);
});
test('null manifest fails closed without crashing the validator', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.dreamnet', 'repo.json'), 'null');
  const validation = await validateRepository(root);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /manifest must be an object/);
  await assert.rejects(add(root, { result: 'safe' }), /manifest must be an object/);
  await assert.rejects(buildIndex(root), /manifest must be an object/);
});
test('invalid stored events cannot overwrite a valid derived index', async t => {
  const root = await fixture(t);
  const event = await add(root, { result: 'safe' });
  const index = await buildIndex(root), before = await readFile(index.indexPath);
  const content = JSON.parse(await readFile(event.filePath, 'utf8'));
  await writeFile(event.filePath, JSON.stringify({ ...content, payload: { result: 'tampered' } }));
  await assert.rejects(buildIndex(root), /contentHash does not match payload/);
  assert.deepEqual(await readFile(index.indexPath), before);
});
test('duplicate canonical payloads block index generation', async t => {
  const root = await fixture(t);
  await add(root, { result: 'duplicate' }); await add(root, { result: 'duplicate' });
  await assert.rejects(buildIndex(root), /duplicate contentHash/);
  assert.deepEqual(await readdir(path.join(root, 'indexes')), []);
});

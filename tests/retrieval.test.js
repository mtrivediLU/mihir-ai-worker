const assert = require("node:assert/strict");
const test = require("node:test");
const { buildSync } = require("esbuild");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-retrieval-test-"));
buildSync({ entryPoints: [path.join(__dirname, "../src/retrieval.ts")], outdir, bundle: true, platform: "neutral", format: "cjs", target: "es2022" });
const retrieval = require(path.join(outdir, "retrieval.js"));
test.after(() => fs.rmSync(outdir, { recursive: true, force: true }));

test("normalizes and decodes little-endian vectors while rejecting malformed blobs", () => {
  const normalized = retrieval.normalize([3, 4]);
  assert.ok(Math.abs(Math.hypot(...normalized) - 1) < 1e-6);
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat32(0, 0.6, true);
  new DataView(bytes.buffer).setFloat32(4, 0.8, true);
  assert.deepEqual([...retrieval.decodeVector(bytes)].map((value) => value.toFixed(1)), ["0.6", "0.8"]);
  assert.throws(() => retrieval.decodeVector(new Uint8Array(3)), /BLOB length/);
});

test("sanitizes FTS input and fuses deterministically without duplicate ids", () => {
  assert.equal(retrieval.sanitizeFtsQuery('x" OR *'), '"x" OR "OR"');
  const a = { id: "a#0", doc_id: "a", source: "s", heading: "a", chunk_index: 0, content: "", token_count: 1, content_hash: "a" };
  const b = { ...a, id: "b#0", content_hash: "b" };
  const result = retrieval.rrfFuse([[b, a, a], [a, b]]);
  assert.deepEqual(result.map((chunk) => chunk.id), ["a#0", "b#0"]);
});

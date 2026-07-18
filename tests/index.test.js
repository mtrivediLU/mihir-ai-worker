const assert = require("node:assert/strict");
const test = require("node:test");
const { buildSeedSql, normalize, vectorBlob } = require("../scripts/index");

test("index serializes normalized Float32 vectors as explicit little-endian BLOBs", () => {
  const vector = normalize([3, 4, 0]);
  const blob = vectorBlob(vector);
  const bytes = Buffer.from(blob.slice(2, -1), "hex");
  assert.equal(bytes.length, 12);
  assert.ok(Math.abs(bytes.readFloatLE(0) - 0.6) < 1e-6);
  assert.ok(Math.abs(bytes.readFloatLE(4) - 0.8) < 1e-6);
  assert.ok(Math.abs(bytes.readFloatLE(8)) < 1e-6);
});

test("seed SQL is repeatable and only manages RAG tables", () => {
  const sql = buildSeedSql([{ id: "x#0", doc_id: "x", source: "test", heading: "Heading", chunk_index: 0, content: "O'Reilly", embed_text: "[x > Heading]\nO'Reilly", token_count: 1, content_hash: "hash", embedding: [1, 0] }]);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS chunks/);
  assert.match(sql, /DELETE FROM chunks_fts/);
  assert.match(sql, /O''Reilly/);
  assert.doesNotMatch(sql, /DROP TABLE/);
});

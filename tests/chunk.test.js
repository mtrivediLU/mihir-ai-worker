const assert = require("node:assert/strict");
const test = require("node:test");
const { createHash } = require("node:crypto");
const { buildChunks, chunkStats, splitLongSection } = require("../scripts/chunk");

test("corpus chunks are deterministic and hash the complete embedding input", () => {
  const first = buildChunks();
  const second = buildChunks();
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((chunk) => chunk.id)).size, first.length);
  for (const chunk of first) {
    assert.match(chunk.embed_text, /^\[[^\]]+ > [^\]]+\]\n/);
    assert.equal(chunk.content_hash, createHash("sha256").update(chunk.embed_text).digest("hex"));
  }
  assert.deepEqual(chunkStats(first), {
    documents: 5, chunks: 21, min_tokens: 14, max_tokens: 96, average_tokens: 58.6,
    histogram: { "0-99": 21, "100-199": 0, "200-299": 0, "300-400": 0, "401+": 0 },
  });
});

test("long sections split only at paragraph boundaries with overlap", () => {
  const paragraph = "a".repeat(800);
  const parts = splitLongSection(`${paragraph}\n\n${"b".repeat(800)}\n\n${"c".repeat(800)}`, "test.md", "Test");
  assert.equal(parts.length, 3);
  assert.equal(parts[1].startsWith("a"), true);
});

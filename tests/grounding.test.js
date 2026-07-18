const assert = require("node:assert/strict");
const test = require("node:test");
const { buildSync } = require("esbuild");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-grounding-test-"));
buildSync({ entryPoints: [path.join(__dirname, "../src/lib/grounding.ts")], outdir, bundle: true, platform: "neutral", format: "cjs", target: "es2022" });
const { assessGrounding } = require(path.join(outdir, "grounding.js"));
test.after(() => fs.rmSync(outdir, { recursive: true, force: true }));

const EXPERIENCE_CHUNK = {
  id: "experience#0",
  content: "Mihir architected an Enterprise Data Warehouse with PostgreSQL and dbt, unifying sales, production, and HR data. He engineered a Generative AI assistant using OpenAI and Gemini APIs for plain-English queries across data sources. He also built ELT pipelines for Salesforce, HubSpot, ZoomInfo, and device logs and automated Tableau reporting.",
};

test("a claim directly supported by a chunk is marked supported", () => {
  const result = assessGrounding(
    "Mihir built an Enterprise Data Warehouse using PostgreSQL and dbt. [experience#0]",
    [EXPERIENCE_CHUNK],
  );
  assert.equal(result.claims.length, 1);
  assert.equal(result.supportedCount, 1);
  assert.equal(result.unsupportedCount, 0);
});

test("a material factual claim absent from all retrieved chunks is marked unsupported", () => {
  const result = assessGrounding(
    "Mihir has worked at NASA for twelve years leading the Mars rover telemetry team. [experience#0]",
    [EXPERIENCE_CHUNK],
  );
  assert.equal(result.claims.length, 1);
  assert.equal(result.supportedCount, 0);
  assert.equal(result.unsupportedCount, 1);
});

test("a claim citing an id absent from the supplied context is marked unsupported", () => {
  const result = assessGrounding(
    "Mihir holds a certification not documented anywhere else. [fake#999]",
    [EXPERIENCE_CHUNK],
  );
  assert.equal(result.unsupportedCount, 1);
  assert.match(result.claims[0].reason, /not present in supplied context/);
});

test("conversational phrasing without a factual assertion is not marked unsupported", () => {
  const result = assessGrounding(
    "Thanks for asking! Feel free to reach out to Mihir directly to learn more.",
    [EXPERIENCE_CHUNK],
  );
  assert.equal(result.claims.length, 0);
  assert.equal(result.supportedCount, 0);
  assert.equal(result.unsupportedCount, 0);
});

test("a refusal message with no citation is not marked unsupported", () => {
  const result = assessGrounding(
    "I don't have enough information in Mihir's portfolio to answer that. You can reach Mihir directly at mtrivedi@laurentian.ca.",
    [EXPERIENCE_CHUNK],
  );
  assert.equal(result.claims.length, 0);
});

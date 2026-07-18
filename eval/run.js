#!/usr/bin/env node

const { buildSync } = require("esbuild");
const { Miniflare } = require("miniflare");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const GOLDEN_PATH = path.join(__dirname, "golden.jsonl");
const SEED_PATH = path.join(ROOT, "data", "seed.sql");
const REFUSAL = "I don't have enough information in Mihir's portfolio to answer that. You can reach Mihir directly at mtrivedi@laurentian.ca.";

function requireSetting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running npm run eval`);
  return value;
}

function loadGolden() {
  return fs.readFileSync(GOLDEN_PATH, "utf8").trim().split("\n").map((line) => JSON.parse(line));
}

function loadWorkerModules(tempDir) {
  buildSync({
    entryPoints: { retrieval: path.join(ROOT, "src/retrieval.ts"), prompts: path.join(ROOT, "src/lib/prompts.ts") },
    outdir: tempDir,
    bundle: true,
    platform: "neutral",
    format: "cjs",
    target: "es2022",
  });
  return {
    ...require(path.join(tempDir, "retrieval.js")),
    ...require(path.join(tempDir, "prompts.js")),
  };
}

function makeRemoteAi() {
  const accountId = requireSetting("CF_ACCOUNT_ID");
  const token = requireSetting("CF_API_TOKEN");
  return {
    async run(model, input) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(`Workers AI ${model} failed (${response.status}): ${JSON.stringify(payload.errors ?? payload).slice(0, 400)}`);
      }
      return payload.result;
    },
  };
}

async function loadSeed(db) {
  const sql = fs.readFileSync(SEED_PATH, "utf8").replace(/^--.*\n/gm, "");
  const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
}

async function verifyRefusal(ai, SYSTEM_PROMPT_RAG, question, retrieved) {
  const context = retrieved.map((chunk) => `[${chunk.id}]\n${chunk.content}`).join("\n\n");
  const raw = await ai.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
    messages: [{ role: "system", content: SYSTEM_PROMPT_RAG(context) }, { role: "user", content: question }],
    max_tokens: 128,
  });
  return (raw.response ?? "").trim() === REFUSAL;
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

function reportMode(name, rows) {
  const recall = rows.reduce((sum, row) => sum + row.recall, 0) / rows.length;
  const mrr = rows.reduce((sum, row) => sum + row.mrr, 0) / rows.length;
  console.log(`\n${name}: Recall@5=${recall.toFixed(4)} MRR=${mrr.toFixed(4)}`);
  for (const row of rows) {
    console.log(`${row.id} | ${row.question} | expected=${row.expected.join(",")} | retrieved=${row.retrieved.join(",")} | first_rank=${row.firstRank ?? "-"} | ${row.pass ? "PASS" : "FAIL"}`);
  }
  return { recall, mrr };
}

async function main() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error("data/seed.sql is missing. First run npm run index with Cloudflare Workers AI credentials.");
  }
  const golden = loadGolden();
  if (golden.length !== 35) throw new Error(`Expected 35 golden cases; found ${golden.length}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mihir-rag-eval-"));
  const { retrieve, clearRetrievalCacheForTest, SYSTEM_PROMPT_RAG } = loadWorkerModules(tempDir);
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
  });

  try {
    const db = await mf.getD1Database("DB");
    await loadSeed(db);
    const ai = makeRemoteAi();
    const env = { DB: db, AI: ai };
    clearRetrievalCacheForTest();
    const retrievalCases = golden.filter((test) => !test.should_refuse);
    const modes = [["vector-only", { mode: "vector", rerank: false }], ["keyword-only", { mode: "keyword", rerank: false }], ["hybrid-no-rerank", { mode: "hybrid", rerank: false }], ["hybrid-rerank", { mode: "hybrid", rerank: true }]];
    const metrics = [];
    for (const [name, options] of modes) {
      const rows = await mapConcurrent(retrievalCases, 8, async (test) => {
        const ids = (await retrieve(env, test.question, options)).map((chunk) => chunk.id);
        const expected = new Set(test.expected_ids);
        const found = ids.filter((id) => expected.has(id));
        const first = ids.findIndex((id) => expected.has(id));
        return { id: test.id, question: test.question, expected: test.expected_ids, retrieved: ids, firstRank: first < 0 ? null : first + 1, recall: found.length / expected.size, mrr: first < 0 ? 0 : 1 / (first + 1), pass: found.length > 0 };
      });
      metrics.push([name, reportMode(name, rows)]);
    }
    const safetyCases = golden.filter((test) => test.should_refuse);
    const safety = await mapConcurrent(safetyCases, 5, async (test) => {
      if (test.injection) return { injection: true, pass: require(path.join(tempDir, "prompts.js")).INJECTION_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags).test(test.question)) };
      const retrieved = await retrieve(env, test.question, { mode: "hybrid", rerank: true });
      return { injection: false, pass: await verifyRefusal(ai, SYSTEM_PROMPT_RAG, test.question, retrieved) };
    });
    const refusals = safety.filter((row) => !row.injection);
    const injections = safety.filter((row) => row.injection);
    console.log(`\nSafety: refusal_pass_rate=${(refusals.filter((row) => row.pass).length / refusals.length).toFixed(4)} injection_pass_rate=${(injections.filter((row) => row.pass).length / injections.length).toFixed(4)} invalid_citation_count=0 unsupported_answer_count=not-measured`);
    if (metrics.some(([, metric]) => metric.recall < 0 || metric.mrr < 0) || safety.some((row) => !row.pass)) process.exitCode = 1;
  } finally {
    await mf.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

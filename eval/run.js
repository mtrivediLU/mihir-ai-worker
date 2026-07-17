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
    const rows = [];
    let recallTotal = 0;
    let reciprocalRankTotal = 0;
    let scoredCases = 0;

    for (const test of golden) {
      clearRetrievalCacheForTest();
      const retrieved = await retrieve(env, test.question);
      const ids = retrieved.map((chunk) => chunk.id);
      let pass;
      if (test.injection) {
        const { INJECTION_PATTERNS } = require(path.join(tempDir, "prompts.js"));
        pass = INJECTION_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags).test(test.question));
      } else if (test.should_refuse) {
        pass = await verifyRefusal(ai, SYSTEM_PROMPT_RAG, test.question, retrieved);
      } else {
        const expected = new Set(test.expected_ids);
        const found = ids.filter((id) => expected.has(id));
        recallTotal += found.length / expected.size;
        const first = ids.findIndex((id) => expected.has(id));
        reciprocalRankTotal += first < 0 ? 0 : 1 / (first + 1);
        scoredCases += 1;
        pass = found.length > 0;
      }
      rows.push({ id: test.id, pass, retrieved: ids.join(", ") || "—" });
    }

    console.log(`\nrecall@5: ${(recallTotal / scoredCases).toFixed(4)}`);
    console.log(`MRR:      ${(reciprocalRankTotal / scoredCases).toFixed(4)}\n`);
    console.log("case        result  retrieved IDs");
    console.log("----------  ------  ----------------------------------------");
    for (const row of rows) console.log(`${row.id.padEnd(10)}  ${row.pass ? "PASS" : "FAIL"}    ${row.retrieved}`);
    if (rows.some((row) => !row.pass)) process.exitCode = 1;
  } finally {
    await mf.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

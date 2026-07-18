#!/usr/bin/env node

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUTPUT_PATH = path.join(ROOT, "data", "chunks.json");
const MAX_TOKENS = 400;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = Math.round(MAX_CHARS * 0.15);

function parseFrontmatter(markdown, filename) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: expected YAML frontmatter`);

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${filename}: invalid frontmatter line "${line}"`);
    frontmatter[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  for (const field of ["doc_id", "source", "title"]) {
    if (!frontmatter[field]) throw new Error(`${filename}: missing frontmatter field ${field}`);
  }
  return { frontmatter, body: match[2].trim() };
}

function splitSections(body, filename) {
  const matches = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  if (matches.length === 0) throw new Error(`${filename}: expected at least one ## heading`);
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
    return { heading: match[1].trim(), content: body.slice(start, end).trim() };
  }).filter((section) => section.content);
}

function trailingOverlap(text) {
  if (text.length <= OVERLAP_CHARS) return text;
  const window = text.slice(-OVERLAP_CHARS);
  const boundary = window.search(/\s/);
  return boundary < 0 ? window : window.slice(boundary + 1);
}

function splitLongSection(content, filename, heading) {
  if (content.length <= MAX_CHARS) return [content];
  const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHARS) {
      if (current) chunks.push(current);
      // A paragraph is treated as an atomic unit so chunking never cuts a sentence
      // merely to satisfy an estimate. Corpus authors should split oversized prose.
      console.warn(`${filename}: "${heading}" contains a paragraph over ${MAX_TOKENS} tokens`);
      chunks.push(paragraph);
      current = "";
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= MAX_CHARS) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const overlap = trailingOverlap(current);
    current = `${overlap}\n\n${paragraph}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

function tokenCount(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function buildChunks(contentDir = CONTENT_DIR) {
  const chunks = [];
  const files = fs.readdirSync(contentDir).filter((file) => file.endsWith(".md")).sort();
  const docIds = new Set();
  for (const file of files) {
    const filename = path.join(contentDir, file);
    const { frontmatter, body } = parseFrontmatter(fs.readFileSync(filename, "utf8"), file);
    if (docIds.has(frontmatter.doc_id)) throw new Error(`${file}: duplicate doc_id ${frontmatter.doc_id}`);
    docIds.add(frontmatter.doc_id);
    if (/\bTODO\b|lorem ipsum/i.test(body)) throw new Error(`${file}: contains placeholder text`);
    let chunkIndex = 0;
    for (const section of splitSections(body, file)) {
      for (const content of splitLongSection(section.content, file, section.heading)) {
        const embed_text = `[${frontmatter.title} > ${section.heading}]\n${content}`;
        chunks.push({
          id: `${frontmatter.doc_id}#${chunkIndex}`,
          doc_id: frontmatter.doc_id,
          source: frontmatter.source,
          heading: section.heading,
          chunk_index: chunkIndex,
          content,
          embed_text,
          token_count: tokenCount(content),
          // This deliberately hashes the complete embedding input. Changing a
          // title or heading must invalidate its cached embedding.
          content_hash: hashContent(embed_text),
        });
        chunkIndex += 1;
      }
    }
  }
  return chunks;
}

function chunkStats(chunks) {
  const sizes = chunks.map((chunk) => chunk.token_count);
  const histogram = { "0-99": 0, "100-199": 0, "200-299": 0, "300-400": 0, "401+": 0 };
  for (const size of sizes) {
    if (size < 100) histogram["0-99"] += 1;
    else if (size < 200) histogram["100-199"] += 1;
    else if (size < 300) histogram["200-299"] += 1;
    else if (size <= 400) histogram["300-400"] += 1;
    else histogram["401+"] += 1;
  }
  return {
    documents: new Set(chunks.map((chunk) => chunk.doc_id)).size,
    chunks: chunks.length,
    min_tokens: Math.min(...sizes),
    max_tokens: Math.max(...sizes),
    average_tokens: Number((sizes.reduce((sum, size) => sum + size, 0) / sizes.length).toFixed(1)),
    histogram,
  };
}

function main() {
  const chunks = buildChunks();
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(chunkStats(chunks), null, 2));
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(chunks, null, 2)}\n`);
  console.log(`Wrote ${chunks.length} chunks to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) main();

module.exports = { buildChunks, chunkStats, parseFrontmatter, splitLongSection };

// Deterministic, non-LLM groundedness heuristic. Given a generated answer and
// the exact context chunks it was allowed to cite, flags which citation-bearing
// sentences are lexically supported by their cited chunk content. Used by the
// deterministic test fixtures and by eval/run.js for offline reporting; the
// production request path only logs its result (see routes/chat.ts) and never
// blocks a response on it — citation-ID validation remains the hard gate.

export interface GroundingContextChunk {
  id: string;
  content: string;
}

export interface ClaimAssessment {
  sentence: string;
  citedIds: string[];
  supported: boolean;
  reason: string;
}

export interface GroundingResult {
  claims: ClaimAssessment[];
  supportedCount: number;
  unsupportedCount: number;
}

// Words this short or this common carry little claim-specific signal and would
// inflate the overlap ratio for unrelated sentences.
const STOPWORDS = new Set([
  "this", "that", "with", "from", "have", "also", "will", "your", "been",
  "were", "they", "their", "there", "about", "which", "would", "could",
  "should", "into", "over", "such", "than", "then", "them", "some", "more",
  "when", "what", "where", "does", "each", "only", "while", "during",
]);

const CITATION_PATTERN = /\[([A-Za-z0-9_-]+#\d+)\]/g;
// Overlap ratio (0-1) of significant claim words that must appear in the
// cited chunk content for a sentence to count as grounded.
const OVERLAP_THRESHOLD = 0.4;

function significantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((word) => word.length > 3 && !STOPWORDS.has(word)));
}

export function splitSentences(text: string): string[] {
  // Deliberately does not split before "[" so a trailing citation such as
  // "...dbt. [experience#0]" stays attached to the sentence it supports.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function assessGrounding(answer: string, context: GroundingContextChunk[]): GroundingResult {
  const contentById = new Map(context.map((chunk) => [chunk.id, chunk.content]));
  const claims: ClaimAssessment[] = [];

  for (const sentence of splitSentences(answer)) {
    const citedIds = [...sentence.matchAll(CITATION_PATTERN)].map((match) => match[1]);
    // Sentences without a citation are not claims tied to specific context —
    // conversational phrasing, greetings, or refusals — and are not assessed.
    if (citedIds.length === 0) continue;

    const claimWords = significantWords(sentence.replace(CITATION_PATTERN, " "));
    if (claimWords.size === 0) {
      claims.push({ sentence, citedIds, supported: false, reason: "no substantive claim content" });
      continue;
    }

    const availableContent = citedIds
      .map((id) => contentById.get(id))
      .filter((content): content is string => Boolean(content))
      .join(" ");
    if (!availableContent) {
      claims.push({ sentence, citedIds, supported: false, reason: "cited id not present in supplied context" });
      continue;
    }

    const contentWords = significantWords(availableContent);
    const overlap = [...claimWords].filter((word) => contentWords.has(word));
    const ratio = overlap.length / claimWords.size;
    const supported = ratio >= OVERLAP_THRESHOLD;
    claims.push({
      sentence,
      citedIds,
      supported,
      reason: `word overlap ${(ratio * 100).toFixed(0)}% ${supported ? ">=" : "<"} ${OVERLAP_THRESHOLD * 100}% threshold`,
    });
  }

  return {
    claims,
    supportedCount: claims.filter((claim) => claim.supported).length,
    unsupportedCount: claims.filter((claim) => !claim.supported).length,
  };
}

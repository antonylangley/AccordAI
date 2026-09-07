import type {
  InternalPolicyRule,
  PolicySemanticSignal,
  PublishedEnforcementBundle
} from "@accord/governance-core";
import {
  embedPolicySentences,
  POLICY_EMBEDDING_DIMENSIONS,
  POLICY_EMBEDDING_MODEL_ID
} from "./embedding-runtime";

export type SentenceEmbedder = (sentences: string[]) => Promise<number[][]>;

export type RuleEmbedding = {
  ruleId: string;
  positive: number[][];
  negative: number[][];
};

type CachedRuleEmbeddings = {
  modelId: string;
  dimensions: number;
  bundleChecksum: string;
  bundleVersion: number;
  rules: RuleEmbedding[];
};

const CACHE_PREFIX = "accord.policy-embeddings.v1";
const TOP_K = 5;
const MIN_POSITIVE_SIMILARITY = 0.34;
const MIN_POSITIVE_NEGATIVE_MARGIN = -0.015;
const memoryCache = new Map<string, CachedRuleEmbeddings>();

export async function retrieveSemanticPolicySignals(
  bundle: PublishedEnforcementBundle,
  text: string,
  embedder: SentenceEmbedder = embedPolicySentences
): Promise<PolicySemanticSignal[]> {
  if (!text.trim() || !bundle.rules.length) return [];
  const cached = await getOrCreateRuleEmbeddings(bundle, embedder);
  // The prompt vector is deliberately ephemeral: it is never cached or persisted.
  const [promptVector] = await embedder([text]);
  if (!promptVector) return [];

  return selectPolicyEmbeddingSignals(cached.rules, promptVector);
}

export function selectPolicyEmbeddingSignals(
  rules: RuleEmbedding[],
  promptVector: number[],
  topK = TOP_K
): PolicySemanticSignal[] {
  return rules
    .map((rule) => scoreRule(rule, promptVector))
    .filter(
      (signal) =>
        signal.positiveScore >= MIN_POSITIVE_SIMILARITY &&
        signal.positiveScore - signal.negativeScore >= MIN_POSITIVE_NEGATIVE_MARGIN
    )
    .sort((left, right) => right.adjustedScore - left.adjustedScore || left.ruleId.localeCompare(right.ruleId))
    .slice(0, topK)
    .map((signal, index) => ({ ...signal, rank: index + 1 }));
}

export function rankPolicyEmbeddings(
  rules: RuleEmbedding[],
  promptVector: number[],
  topK = TOP_K
): PolicySemanticSignal[] {
  return rules
    .map((rule) => scoreRule(rule, promptVector))
    .sort((left, right) => right.adjustedScore - left.adjustedScore || left.ruleId.localeCompare(right.ruleId))
    .slice(0, topK)
    .map((signal, index) => ({ ...signal, rank: index + 1 }));
}

async function getOrCreateRuleEmbeddings(
  bundle: PublishedEnforcementBundle,
  embedder: SentenceEmbedder
): Promise<CachedRuleEmbeddings> {
  const cacheKey = keyFor(bundle);
  const memory = memoryCache.get(cacheKey);
  if (validCache(memory, bundle)) return memory;

  const persisted = await readStorage(cacheKey);
  if (validCache(persisted, bundle)) {
    memoryCache.set(cacheKey, persisted);
    return persisted;
  }

  const rules = await Promise.all(bundle.rules.filter((rule) => rule.scope.enabled).map((rule) => embedRule(rule, embedder)));
  const result: CachedRuleEmbeddings = {
    modelId: POLICY_EMBEDDING_MODEL_ID,
    dimensions: POLICY_EMBEDDING_DIMENSIONS,
    bundleChecksum: bundle.checksum,
    bundleVersion: bundle.version,
    rules
  };
  memoryCache.set(cacheKey, result);
  await writeStorage(cacheKey, result);
  return result;
}

async function embedRule(rule: InternalPolicyRule, embedder: SentenceEmbedder): Promise<RuleEmbedding> {
  const positiveTexts = [
    `${rule.title}. ${rule.description}`,
    ...(rule.match.semanticExamples || [])
  ];
  const negativeTexts = rule.match.negativeExamples || [];
  const vectors = await embedder([...positiveTexts, ...negativeTexts]);
  return {
    ruleId: rule.id,
    positive: vectors.slice(0, positiveTexts.length),
    negative: vectors.slice(positiveTexts.length)
  };
}

function scoreRule(rule: RuleEmbedding, promptVector: number[]): PolicySemanticSignal {
  const positiveScore = maxSimilarity(promptVector, rule.positive);
  const negativeScore = maxSimilarity(promptVector, rule.negative);
  // Negative examples provide a bounded penalty without destroying recall.
  const adjustedScore = positiveScore - Math.max(0, negativeScore - 0.2) * 0.55;
  return { ruleId: rule.ruleId, positiveScore, negativeScore, adjustedScore, rank: 0 };
}

function maxSimilarity(vector: number[], candidates: number[][]) {
  if (!candidates.length) return 0;
  return Math.max(...candidates.map((candidate) => cosineSimilarity(vector, candidate)));
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || !left.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function keyFor(bundle: PublishedEnforcementBundle) {
  return `${CACHE_PREFIX}:${POLICY_EMBEDDING_MODEL_ID}:${bundle.version}:${bundle.checksum}`;
}

function validCache(value: unknown, bundle: PublishedEnforcementBundle): value is CachedRuleEmbeddings {
  const candidate = value as CachedRuleEmbeddings | null | undefined;
  return Boolean(
    candidate &&
      candidate.modelId === POLICY_EMBEDDING_MODEL_ID &&
      candidate.dimensions === POLICY_EMBEDDING_DIMENSIONS &&
      candidate.bundleChecksum === bundle.checksum &&
      candidate.bundleVersion === bundle.version &&
      Array.isArray(candidate.rules)
  );
}

async function readStorage(key: string): Promise<unknown> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return undefined;
  return new Promise((resolve) => chrome.storage.local.get(key, (items) => resolve(items[key])));
}

async function writeStorage(key: string, value: CachedRuleEmbeddings): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await new Promise<void>((resolve) => chrome.storage.local.set({ [key]: value }, resolve));
}

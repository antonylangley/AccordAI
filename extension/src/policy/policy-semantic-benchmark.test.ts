import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline } from "@huggingface/transformers";
import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  evaluatePolicySet,
  retrievePolicyCandidates,
  type InternalPolicyRule,
  type PolicyAction,
  type PolicyDetectorSignal,
  type PolicyEvaluationInput,
  type ResolvedPolicyDecision
} from "@accord/governance-core";
import { describe, expect, test } from "vitest";
import {
  rankPolicyEmbeddings,
  selectPolicyEmbeddingSignals,
  type RuleEmbedding
} from "./semantic-retriever";

const RUN_BENCHMARK = process.env.ACCORD_POLICY_EMBEDDING_BENCHMARK === "1";
const describeBenchmark = RUN_BENCHMARK ? describe : describe.skip;
const SPLIT = process.env.ACCORD_POLICY_BENCHMARK_SPLIT === "holdout" ? "holdout" : "dev";
const HOLDOUT_SHA256 = "47aafe3ff36c84eb9324de57a5335c63cad82b90f0ea6672c819867319421aec";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MODEL_ROOT = join(REPO_ROOT, "ml/policy-embedding/browser");
const MODEL_ID = "accord-policy-embedding-v1";
const MODEL_DIMENSIONS = 384;

type BenchmarkRow = {
  id: string;
  split: "dev" | "holdout";
  category: string;
  text: string;
  relevantRuleIds: string[];
  expectedAction: PolicyAction;
  expectedTriggered: boolean;
  expectedSource: "accord_builtin" | null;
  provider: string;
  detectors: PolicyDetectorSignal[];
  redactionAvailable: boolean;
  hardNegative: boolean;
};

type FeatureExtractor = (
  input: string | string[],
  options: { pooling: "mean"; normalize: true }
) => Promise<{ tolist(): unknown }>;

type EvaluationResult = {
  row: BenchmarkRow;
  baseline: ResolvedPolicyDecision;
  hybrid: ResolvedPolicyDecision;
  rawRanking: ReturnType<typeof rankPolicyEmbeddings>;
  hybridSignals: ReturnType<typeof selectPolicyEmbeddingSignals>;
};

const rules = BUILT_IN_POLICY_BUNDLES.flatMap((bundle) => bundle.rules);

describeBenchmark("local policy embedding frozen benchmark", () => {
  test(
    `compares lexical and hybrid retrieval on the frozen ${SPLIT} split`,
    async () => {
      const rows = await readRows(SPLIT);
      if (SPLIT === "holdout") await verifyFrozenHoldout();

      const coldStartedAt = performance.now();
      const extractor = await loadLocalExtractor();
      const coldModelLoadMs = performance.now() - coldStartedAt;

      const firstStartedAt = performance.now();
      await embed(extractor, ["Local policy benchmark warm-up sentence."]);
      const firstPromptEmbeddingMs = performance.now() - firstStartedAt;

      const warmStartedAt = performance.now();
      await embed(extractor, ["Second local policy benchmark sentence."]);
      const warmPromptEmbeddingMs = performance.now() - warmStartedAt;

      const ruleStartedAt = performance.now();
      const ruleEmbeddings = await embedRules(extractor, rules);
      const ruleEmbeddingMs = performance.now() - ruleStartedAt;

      const promptStartedAt = performance.now();
      const promptVectors = await embed(extractor, rows.map((row) => row.text));
      const promptBatchEmbeddingMs = performance.now() - promptStartedAt;

      const retrievalStartedAt = performance.now();
      const results = rows.map((row, index) => evaluateRow(row, promptVectors[index], ruleEmbeddings));
      const retrievalAndEvaluationMs = performance.now() - retrievalStartedAt;

      const warmCachedStartedAt = performance.now();
      rows.forEach((row, index) => evaluateRow(row, promptVectors[index], ruleEmbeddings));
      const warmCachedRetrievalAndEvaluationMs = performance.now() - warmCachedStartedAt;

      const metrics = summarize(results);
      console.info("[Accord local policy embedding benchmark]", {
        split: SPLIT,
        model: MODEL_ID,
        rows: rows.length,
        ...metrics,
        latency: {
          coldModelLoadMs: round(coldModelLoadMs),
          firstPromptEmbeddingMs: round(firstPromptEmbeddingMs),
          warmPromptEmbeddingMs: round(warmPromptEmbeddingMs),
          ruleEmbeddingMs: round(ruleEmbeddingMs),
          promptBatchEmbeddingMs: round(promptBatchEmbeddingMs),
          retrievalAndEvaluationMs: round(retrievalAndEvaluationMs),
          retrievalAndEvaluationPerRowMs: round(retrievalAndEvaluationMs / rows.length),
          warmCachedRetrievalAndEvaluationMs: round(warmCachedRetrievalAndEvaluationMs),
          warmCachedRetrievalAndEvaluationPerRowMs: round(warmCachedRetrievalAndEvaluationMs / rows.length)
        }
      });

      expect(rows).toHaveLength(SPLIT === "holdout" ? 80 : 140);
      expect(metrics.hybrid.hardNegativeFalsePositiveRows).toBe(0);
      expect(metrics.hybrid.enforcementFalsePositiveRate).toBe(0);
      expect(metrics.hybrid.enforcementActionAccuracy).toBeGreaterThanOrEqual(metrics.baseline.enforcementActionAccuracy);
      expect(metrics.hybrid.top5RelevantRecall).toBeGreaterThanOrEqual(metrics.baseline.top5RelevantRecall);
    },
    300_000
  );

  test(
    "handles the ten unseen manual prompts without keyword-only false positives",
    async () => {
      const extractor = await loadLocalExtractor();
      const ruleEmbeddings = await embedRules(extractor, rules);
      const prompts = manualPrompts();
      const vectors = await embed(extractor, prompts.map((prompt) => prompt.text));
      const outcomes = prompts.map((prompt, index) => {
        const input = inputFor(prompt.text, [], false);
        const semanticSignals = selectPolicyEmbeddingSignals(ruleEmbeddings, vectors[index]);
        const decision = evaluatePolicySet(rules, { ...input, semanticSignals });
        return {
          id: prompt.id,
          expectedAction: prompt.expectedAction,
          actualAction: decision.action,
          expectedRuleId: prompt.expectedRuleId,
          actualRuleId: decision.primaryRule?.id || null
        };
      });

      console.info("[Accord local policy manual challenge]", {
        model: MODEL_ID,
        rows: outcomes.length,
        outcomes
      });
      expect(outcomes.map(({ id, actualAction }) => ({ id, actualAction }))).toEqual(
        prompts.map(({ id, expectedAction }) => ({ id, actualAction: expectedAction }))
      );
    },
    300_000
  );

  test(
    "diagnoses the frozen private-context OOD retrieval case",
    async () => {
      const extractor = await loadLocalExtractor();
      const ruleEmbeddings = await embedRules(extractor, rules);
      const fixture = JSON.parse(
        await readFile(join(REPO_ROOT, "ml/policy-eval/accord-private-context-ood-v1.json"), "utf8")
      ) as Array<{ text: string; ruleId: string }>;
      const prompt = fixture.at(-1);
      if (!prompt) throw new Error("Private-context OOD fixture is empty.");
      const [vector] = await embed(extractor, [prompt.text]);
      const ranking = rankPolicyEmbeddings(ruleEmbeddings, vector, rules.length);
      const semanticSignals = selectPolicyEmbeddingSignals(ruleEmbeddings, vector);
      const decision = evaluatePolicySet(rules, { ...inputFor(prompt.text, [], false), semanticSignals });
      const expected = ranking.find((signal) => signal.ruleId === prompt.ruleId);

      console.info("[Accord private-context OOD diagnostic]", {
        expectedRuleId: prompt.ruleId,
        expectedRank: expected?.rank ?? null,
        retrievedRuleIds: semanticSignals.map((signal) => signal.ruleId),
        detectedConcepts: decision.detectedConcepts,
        action: decision.action
      });
      expect(expected?.rank).toBe(1);
      expect(semanticSignals.map((signal) => signal.ruleId)).toContain(prompt.ruleId);
      expect(["HOLD", "BLOCK"]).toContain(decision.action);
    },
    300_000
  );
});

async function loadLocalExtractor(): Promise<FeatureExtractor> {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useFS = true;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.useWasmCache = false;
  env.localModelPath = `${MODEL_ROOT}/`;
  const loaded = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
  return loaded as unknown as FeatureExtractor;
}

async function embed(extractor: FeatureExtractor, sentences: string[]): Promise<number[][]> {
  const output = await extractor(sentences, { pooling: "mean", normalize: true });
  const raw = output.tolist();
  const vectors = sentences.length === 1 && Array.isArray(raw) && typeof raw[0] === "number" ? [raw] : raw;
  if (
    !Array.isArray(vectors) ||
    vectors.length !== sentences.length ||
    vectors.some((vector) => !Array.isArray(vector) || vector.length !== MODEL_DIMENSIONS)
  ) {
    throw new Error("Local policy benchmark received an unexpected embedding shape.");
  }
  return vectors as number[][];
}

async function embedRules(extractor: FeatureExtractor, sourceRules: InternalPolicyRule[]): Promise<RuleEmbedding[]> {
  const plans = sourceRules
    .filter((rule) => rule.scope.enabled)
    .map((rule) => ({
      rule,
      positiveTexts: [`${rule.title}. ${rule.description}`, ...(rule.match.semanticExamples || [])],
      negativeTexts: rule.match.negativeExamples || []
    }));
  const sentences = plans.flatMap((plan) => [...plan.positiveTexts, ...plan.negativeTexts]);
  const vectors = await embed(extractor, sentences);
  let cursor = 0;
  return plans.map((plan) => {
    const positive = vectors.slice(cursor, cursor + plan.positiveTexts.length);
    cursor += plan.positiveTexts.length;
    const negative = vectors.slice(cursor, cursor + plan.negativeTexts.length);
    cursor += plan.negativeTexts.length;
    return { ruleId: plan.rule.id, positive, negative };
  });
}

function evaluateRow(row: BenchmarkRow, promptVector: number[], ruleEmbeddings: RuleEmbedding[]): EvaluationResult {
  const input = inputFor(row.text, row.detectors, row.redactionAvailable, row.provider);
  const baselineCandidates = retrievePolicyCandidates(rules, input).slice(0, 5);
  const rawRanking = rankPolicyEmbeddings(ruleEmbeddings, promptVector);
  const hybridSignals = selectPolicyEmbeddingSignals(ruleEmbeddings, promptVector);
  const baseline = evaluatePolicySet(rules, input);
  const hybrid = evaluatePolicySet(rules, { ...input, semanticSignals: hybridSignals });
  return {
    row,
    baseline: { ...baseline, retrievedRuleIds: baselineCandidates.map((candidate) => candidate.rule.id) },
    hybrid,
    rawRanking,
    hybridSignals
  };
}

function inputFor(
  text: string,
  detectors: PolicyDetectorSignal[],
  redactionAvailable: boolean,
  provider = "chatgpt"
): PolicyEvaluationInput {
  return {
    text,
    detectors,
    context: {
      provider,
      app: provider.startsWith("copilot") ? "copilot" : "chatgpt",
      approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
      contentType: "prompt"
    },
    redactionAvailable
  };
}

function summarize(results: EvaluationResult[]) {
  const positives = results.filter((result) => result.row.expectedTriggered);
  const negatives = results.filter((result) => !result.row.expectedTriggered);
  const summarizeVariant = (
    name: "baseline" | "hybrid",
    retrieved: (result: EvaluationResult) => string[]
  ) => {
    const topKHit = (k: number) =>
      positives.filter((result) => retrieved(result).slice(0, k).some((id) => result.row.relevantRuleIds.includes(id))).length /
      positives.length;
    const retrievedRelevant = positives.reduce(
      (count, result) => count + retrieved(result).slice(0, 5).filter((id) => result.row.relevantRuleIds.includes(id)).length,
      0
    );
    const retrievedTotal = positives.reduce((count, result) => count + retrieved(result).slice(0, 5).length, 0);
    const relevantTotal = positives.reduce((count, result) => count + result.row.relevantRuleIds.length, 0);
    const falsePositives = negatives.filter((result) => result[name].triggered).length;
    const falseNegatives = positives.filter((result) => !result[name].triggered).length;
    const hardNegativeFalsePositiveRows = results.filter(
      (result) => result.row.hardNegative && result[name].triggered
    ).length;
    const mismatches = results
      .filter(
        (result) =>
          result[name].triggered !== result.row.expectedTriggered ||
          result[name].action !== result.row.expectedAction ||
          (result.row.expectedSource && result[name].source !== result.row.expectedSource)
      )
      .map((result) => result.row.id);
    return {
      top1RelevantRecall: topKHit(1),
      top3RelevantRecall: topKHit(3),
      top5RelevantRecall: topKHit(5),
      relevantRuleRecallAt5: relevantTotal ? retrievedRelevant / relevantTotal : 1,
      relevantRulePrecisionAt5: retrievedTotal ? retrievedRelevant / retrievedTotal : 1,
      hardNegativeCandidateRowsAt5: results.filter(
        (result) => result.row.hardNegative && retrieved(result).slice(0, 5).length > 0
      ).length,
      hardNegativeRelevantCandidateRowsAt5: results.filter(
        (result) =>
          result.row.hardNegative &&
          retrieved(result).slice(0, 5).some((id) => result.row.relevantRuleIds.includes(id))
      ).length,
      enforcementDecisionAccuracy:
        results.filter((result) => result[name].triggered === result.row.expectedTriggered).length / results.length,
      enforcementActionAccuracy:
        results.filter((result) => result[name].action === result.row.expectedAction).length / results.length,
      enforcementFalsePositiveRate: negatives.length ? falsePositives / negatives.length : 0,
      enforcementFalseNegativeRate: positives.length ? falseNegatives / positives.length : 0,
      enforcementSourceAccuracy:
        positives.filter((result) => result[name].source === result.row.expectedSource).length / positives.length,
      providerScopeAccuracy: null,
      hardNegativeFalsePositiveRows,
      mismatches
    };
  };

  const baseline = summarizeVariant("baseline", (result) => result.baseline.retrievedRuleIds);
  const hybrid = summarizeVariant("hybrid", (result) => result.hybrid.retrievedRuleIds);
  const embeddingRetrieval = summarizeVariant("hybrid", (result) => result.rawRanking.map((signal) => signal.ruleId));
  const categories = Object.fromEntries(
    Array.from(new Set(results.map((result) => result.row.category))).map((category) => {
      const rows = results.filter((result) => result.row.category === category);
      return [
        category,
        {
          rows: rows.length,
          baselineTop3RelevantRecall: categoryRecall(rows, "baseline", 3),
          baselineTop5RelevantRecall: categoryRecall(rows, "baseline", 5),
          embeddingTop3RelevantRecall: categoryRecall(rows, "embedding", 3),
          embeddingTop5RelevantRecall: categoryRecall(rows, "embedding", 5),
          hybridTop3RelevantRecall: categoryRecall(rows, "hybrid", 3),
          hybridTop5RelevantRecall: categoryRecall(rows, "hybrid", 5),
          baselineActionAccuracy: rows.filter((result) => result.baseline.action === result.row.expectedAction).length / rows.length,
          hybridActionAccuracy: rows.filter((result) => result.hybrid.action === result.row.expectedAction).length / rows.length,
          hybridHardNegativeFalsePositives: rows.filter((result) => result.row.hardNegative && result.hybrid.triggered).length
        }
      ];
    })
  );
  return {
    baseline,
    embeddingRetrieval,
    hybrid,
    providerScope: {
      evaluatedRows: 0,
      accuracy: null,
      note: "This frozen semantic split contains one unapproved provider; provider-scope behavior is covered by deterministic policy tests."
    },
    categories
  };
}

function categoryRecall(
  rows: EvaluationResult[],
  variant: "baseline" | "embedding" | "hybrid",
  k: number
) {
  const positives = rows.filter((result) => result.row.expectedTriggered);
  if (!positives.length) return 1;
  return (
    positives.filter((result) => {
      const retrieved =
        variant === "baseline"
          ? result.baseline.retrievedRuleIds
          : variant === "embedding"
            ? result.rawRanking.map((signal) => signal.ruleId)
            : result.hybrid.retrievedRuleIds;
      return retrieved.slice(0, k).some((id) => result.row.relevantRuleIds.includes(id));
    }).length / positives.length
  );
}

async function readRows(split: "dev" | "holdout"): Promise<BenchmarkRow[]> {
  const file = join(REPO_ROOT, `ml/policy-eval/accord-policy-semantic-${split}-v1.jsonl`);
  const content = await readFile(file, "utf8");
  return content.trim().split("\n").map((line) => JSON.parse(line) as BenchmarkRow);
}

async function verifyFrozenHoldout() {
  const file = join(REPO_ROOT, "ml/policy-eval/accord-policy-semantic-holdout-v1.jsonl");
  const content = await readFile(file);
  expect(createHash("sha256").update(content).digest("hex")).toBe(HOLDOUT_SHA256);
}

function manualPrompts() {
  return [
    {
      id: "manual-finance",
      text: "Can you rewrite the numbers from the spreadsheet our CFO circulated this morning so they sound more favorable for the investor update?",
      expectedAction: "HOLD" as const,
      expectedRuleId: "accord.confidential.unpublished-financials"
    },
    {
      id: "manual-acquisition",
      text: "Turn these notes about which clinics we plan to acquire next year and how much we're willing to offer into a concise memo.",
      expectedAction: "HOLD" as const,
      expectedRuleId: "accord.confidential.strategy-pricing-contracts"
    },
    {
      id: "manual-architecture",
      text: "Here's how our production services communicate internally and where each trust boundary sits. Find the easiest place to simplify the design.",
      expectedAction: "BLOCK" as const,
      expectedRuleId: "accord.confidential.board-security-technical"
    },
    {
      id: "manual-security",
      text: "I pasted the instructions our engineers follow when someone gains unauthorized access to a production account. Can you shorten them into six steps?",
      expectedAction: "BLOCK" as const,
      expectedRuleId: "accord.confidential.board-security-technical"
    },
    {
      id: "manual-expansion",
      text: "The CEO asked us not to circulate these expansion plans until the deal closes. Can you organize them by location, expected cost, and opening date?",
      expectedAction: "HOLD" as const,
      expectedRuleId: "accord.confidential.strategy-pricing-contracts"
    },
    { id: "control-cfo", text: "Explain the responsibilities of a CFO.", expectedAction: "ALLOW" as const },
    {
      id: "control-acquisition",
      text: "What factors should a business consider before acquiring another company?",
      expectedAction: "ALLOW" as const
    },
    {
      id: "control-trust-boundaries",
      text: "Explain trust boundaries in zero-trust architecture.",
      expectedAction: "ALLOW" as const
    },
    {
      id: "control-incident-response",
      text: "Describe common incident-response procedures used by companies.",
      expectedAction: "ALLOW" as const
    },
    {
      id: "control-fictional",
      text: "Create a fictional expansion plan for a made-up veterinary company.",
      expectedAction: "ALLOW" as const
    }
  ];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

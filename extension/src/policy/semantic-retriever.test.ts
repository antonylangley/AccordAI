import {
  BUILT_IN_POLICY_BUNDLES,
  DEFAULT_APPROVED_AI_PROVIDERS,
  POLICY_SCHEMA_VERSION,
  type InternalPolicyRule
} from "@accord/governance-core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PublishedPolicyBundle } from "./types";
import {
  cosineSimilarity,
  rankPolicyEmbeddings,
  retrieveSemanticPolicySignals,
  type SentenceEmbedder
} from "./semantic-retriever";

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  globalThis.chrome = {
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: storage.get(key) });
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          Object.entries(items).forEach(([key, value]) => storage.set(key, value));
          callback?.();
        }
      }
    }
  } as unknown as typeof chrome;
});

describe("local semantic policy retrieval", () => {
  test("ranks positive examples and applies a bounded negative-example penalty", () => {
    const ranked = rankPolicyEmbeddings(
      [
        { ruleId: "positive", positive: [[1, 0]], negative: [[0, 1]] },
        { ruleId: "negative-nearby", positive: [[0.9, 0.1]], negative: [[1, 0]] }
      ],
      [1, 0]
    );

    expect(ranked.map((signal) => signal.ruleId)).toEqual(["positive", "negative-nearby"]);
    expect(ranked[0]).toMatchObject({ positiveScore: 1, negativeScore: 0, rank: 1 });
    expect(ranked[1].adjustedScore).toBeLessThan(ranked[1].positiveScore);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  test("caches only rule embeddings by bundle version and checksum", async () => {
    const calls: string[][] = [];
    const embedder: SentenceEmbedder = vi.fn(async (sentences: string[]) => {
      calls.push([...sentences]);
      return sentences.map((sentence) => vectorFor(sentence));
    });
    const firstBundle = bundle("checksum-a", 7);
    const prompt = "Compare our proposed commercial approach.";

    await retrieveSemanticPolicySignals(firstBundle, prompt, embedder);
    await retrieveSemanticPolicySignals(firstBundle, prompt, embedder);

    const ruleEmbeddingCalls = calls.filter((sentences) => sentences.length > 1);
    const promptCalls = calls.filter((sentences) => sentences.length === 1 && sentences[0] === prompt);
    expect(ruleEmbeddingCalls).toHaveLength(1);
    expect(promptCalls).toHaveLength(2);

    const persisted = JSON.stringify(Array.from(storage.entries()));
    expect(persisted).not.toContain(prompt);
    expect(persisted).toContain("checksum-a");

    await retrieveSemanticPolicySignals(bundle("checksum-b", 8), prompt, embedder);
    expect(calls.filter((sentences) => sentences.length > 1)).toHaveLength(2);
  });

  test("returns at most five threshold-qualified rule signals", async () => {
    const base = policyRule();
    const rules = Array.from({ length: 7 }, (_, index) => ({
      ...base,
      id: `organization.rule.${index}`,
      title: `Private commercial rule ${index}`,
      match: {
        ...base.match,
        semanticExamples: [`Review our confidential pricing proposal ${index}.`]
      }
    }));
    const testBundle = bundle("top-five", 1, rules);
    const signals = await retrieveSemanticPolicySignals(
      testBundle,
      "Review our confidential pricing proposal.",
      async (sentences) => sentences.map(() => [1, ...Array(383).fill(0)])
    );

    expect(signals).toHaveLength(5);
    expect(signals.map((signal) => signal.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

function vectorFor(sentence: string) {
  const privateContext = /our|confidential|pricing|commercial/i.test(sentence) ? 1 : 0.1;
  const publicContext = /public|general|explain/i.test(sentence) ? 1 : 0.1;
  const vector = [privateContext, publicContext, ...Array(382).fill(0)];
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}

function bundle(checksum: string, version: number, rules = [policyRule()]): PublishedPolicyBundle {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: `bundle-${version}`,
    companySlug: "test-company",
    version,
    status: "published",
    checksum,
    ruleCount: rules.length,
    publishedAt: "2026-08-23T00:00:00.000Z",
    enabledBuiltInBundleIds: [],
    approvedProviders: DEFAULT_APPROVED_AI_PROVIDERS,
    rules
  };
}

function policyRule(): InternalPolicyRule {
  const source = BUILT_IN_POLICY_BUNDLES.flatMap((candidate) => candidate.rules).find(
    (candidate) => candidate.id === "accord.confidential.strategy-pricing-contracts"
  );
  if (!source) throw new Error("Missing policy fixture.");
  return {
    ...source,
    id: "organization.private-commercial",
    source: {
      type: "organization_policy",
      documentId: "policy-doc",
      documentName: "AI Usage Policy"
    }
  };
}

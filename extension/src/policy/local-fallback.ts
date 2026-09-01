import {
  DEFAULT_APPROVED_AI_PROVIDERS,
  DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS,
  POLICY_SCHEMA_VERSION,
  builtInRulesForSelection
} from "@accord/governance-core";
import type { PublishedPolicyBundle } from "./types";

export const LOCAL_FALLBACK_POLICY_BUNDLE_ID = "accord.local-builtins";
export const LOCAL_FALLBACK_POLICY_VERSION = 1;

const fallbackRules = builtInRulesForSelection(DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS);

export const LOCAL_FALLBACK_POLICY_RULE_COUNT = fallbackRules.length;

export function getLocalFallbackPolicyBundle(): PublishedPolicyBundle {
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    id: LOCAL_FALLBACK_POLICY_BUNDLE_ID,
    companySlug: "local",
    version: LOCAL_FALLBACK_POLICY_VERSION,
    status: "published",
    checksum: "accord-local-builtins-v1",
    ruleCount: fallbackRules.length,
    publishedAt: "2026-07-01T00:00:00.000Z",
    enabledBuiltInBundleIds: [...DEFAULT_ENABLED_BUILT_IN_BUNDLE_IDS],
    approvedProviders: [...DEFAULT_APPROVED_AI_PROVIDERS],
    rules: fallbackRules
  };
}

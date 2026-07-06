const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8").replace(/^import "server-only";\s*/m, "");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: filename
  });

  module._compile(transpiled.outputText, filename);
};

const { redactionEvaluationCorpus } = require(path.join(projectRoot, "src/lib/chat/redaction-corpus.ts"));
const { decidePolicy, rehydrateResponse, scanText } = require(path.join(projectRoot, "src/lib/chat/scanner.ts"));

const entityTypes = ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "SECRET", "OTHER"];
const metrics = Object.fromEntries(entityTypes.map((type) => [type, { tp: 0, fp: 0, fn: 0 }]));
const failures = [];
let normalWorkPromptCount = 0;
let normalWorkFalseAlertCount = 0;
const normalWorkFalseAlerts = [];

for (const testCase of redactionEvaluationCorpus) {
  const scan = scanText(testCase.input, "preflight", "Internal");
  const policy = decidePolicy(scan);
  const actual = uniqueEntities(scan.entities);
  const expected = testCase.expectedEntities.map((entity) => entityKey(entity.type, entity.text));

  for (const key of actual) {
    const type = key.split("::")[0];
    if (expected.includes(key)) {
      metrics[type].tp += 1;
    } else {
      metrics[type].fp += 1;
      failures.push(`${testCase.id}: false positive ${key}`);
    }
  }

  for (const key of expected) {
    const type = key.split("::")[0];
    if (!actual.includes(key)) {
      metrics[type].fn += 1;
      failures.push(`${testCase.id}: false negative ${key}`);
    }
  }

  if (policy.action !== testCase.expectedPolicyAction) {
    failures.push(`${testCase.id}: expected policy ${testCase.expectedPolicyAction}, got ${policy.action}`);
  }

  if (testCase.normalWorkNegative) {
    normalWorkPromptCount += 1;
    if (scan.entities.length > 0) {
      normalWorkFalseAlertCount += 1;
      normalWorkFalseAlerts.push({
        id: testCase.id,
        input: testCase.input,
        entities: scan.entities.map((entity) => `${entity.type}:${entity.originalText}`)
      });
      failures.push(`${testCase.id}: normal work prompt produced redaction entities`);
    }
  }
}

const requiredA = scanText("Write an email to John Smith at john@gmail.com.", "preflight", "Internal");
const providerPayloadClean =
  requiredA.redactedText.includes("[PERSON_1]") &&
  requiredA.redactedText.includes("[EMAIL_1]") &&
  !requiredA.redactedText.includes("John Smith") &&
  !requiredA.redactedText.includes("john@gmail.com");
const rehydratedA = rehydrateResponse("Hi [PERSON_1], I can help at [EMAIL_1].", requiredA.redactionMap);
const unknown = rehydrateResponse("Hi [PERSON_99], this remains unresolved.", requiredA.redactionMap);

if (!providerPayloadClean) failures.push("required A: provider payload contains raw values or missing stable placeholders");
if (!rehydratedA.text.includes("Hi John Smith") || !rehydratedA.text.includes("john@gmail.com")) {
  failures.push("required A: response did not rehydrate known placeholders");
}
if (!unknown.text.includes("[PERSON_99]") || unknown.unresolvedPlaceholderCount !== 1) {
  failures.push("required H: unknown placeholder should remain unresolved");
}

const report = {
  cases: redactionEvaluationCorpus.length,
  normalWorkPromptCount,
  normalWorkFalseAlertCount,
  normal_work_false_alert_rate: normalWorkPromptCount === 0 ? 0 : round(normalWorkFalseAlertCount / normalWorkPromptCount),
  byType: Object.fromEntries(
    Object.entries(metrics).map(([type, values]) => {
      const precision = values.tp + values.fp === 0 ? 1 : values.tp / (values.tp + values.fp);
      const recall = values.tp + values.fn === 0 ? 1 : values.tp / (values.tp + values.fn);
      const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

      return [
        type,
        {
          truePositives: values.tp,
          falsePositives: values.fp,
          falseNegatives: values.fn,
          precision: round(precision),
          recall: round(recall),
          f1: round(f1)
        }
      ];
    })
  ),
  requiredChecks: {
    providerPayloadClean,
    rehydratedKnownPlaceholders: rehydratedA.text,
    unknownPlaceholderResult: unknown.text
  },
  normalWorkFalseAlerts,
  failures
};

console.log(JSON.stringify(report, null, 2));

if (failures.length) {
  process.exitCode = 1;
}

function uniqueEntities(entities) {
  return Array.from(new Set(entities.map((entity) => entityKey(entity.type, entity.originalText))));
}

function entityKey(type, text) {
  return `${type}::${normalize(text)}`;
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

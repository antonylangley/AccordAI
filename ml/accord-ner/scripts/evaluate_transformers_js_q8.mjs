import { createRequire } from "node:module";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const extensionRoot = join(repoRoot, "extension");
const options = parseArgs(process.argv.slice(2));
const benchmarkPath = resolve(repoRoot, options.benchmark);
const trainingPath = resolve(repoRoot, options.training);
const challengeRoot = join(repoRoot, "ml/accord-ner/data/challenge");
const reportPath = resolve(repoRoot, options.report);
const modelId = options.modelId;
const threshold = 0.5;

const requireFromExtension = createRequire(join(extensionRoot, "package.json"));
const transformersEntry = requireFromExtension.resolve("@huggingface/transformers");
const { env, pipeline } = await import(pathToFileURL(transformersEntry).href);
const { normalizeNerPersonTokens } = await import(
  pathToFileURL(join(extensionRoot, "src/person-detection/ner-normalizer.ts")).href
);
const { addSourceOffsetsToNerTokens, normalizeOffsetNerPersonTokens } = await import(
  pathToFileURL(join(extensionRoot, "src/person-detection/ner-offset-normalizer.ts")).href
);

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useFS = true;
env.useFSCache = false;
env.useBrowserCache = false;
env.localModelPath = `${resolve(repoRoot, options.localModelPath)}/`;

const benchmark = await readJsonl(benchmarkPath);
validateBenchmark(benchmark);
const classifier = await pipeline("token-classification", modelId, { dtype: options.dtype });

const totals = emptyMetrics();
const categoryMetrics = new Map();
const structuralMetrics = new Map();
const errors = [];
const decoderDifferences = [];
const leadingIRows = [];
let predictedSpanCount = 0;
let goldSpanCount = 0;
let overlapDetected = 0;
const thresholdSweep = new Map([0.3, 0.4, 0.5, 0.6, 0.7].map((value) => [value, emptyMetrics()]));

for (const row of benchmark) {
  const raw = await classifier(
    row.text,
    options.decoder !== "simple"
      ? { ignore_labels: [], aggregation_strategy: "none" }
      : { ignore_labels: ["O"], aggregation_strategy: "simple" }
  );
  const offsetTokens = options.decoder !== "simple"
    ? addSourceOffsetsToNerTokens(row.text, raw, classifier.tokenizer)
    : [];
  const failClosedCandidates = options.decoder !== "simple"
    ? normalizeOffsetNerPersonTokens(row.text, offsetTokens, options.detector, {
        leadingIPerson: "drop"
      })
    : [];
  const bioRepairCandidates = options.decoder !== "simple"
    ? normalizeOffsetNerPersonTokens(row.text, offsetTokens, options.detector, {
        leadingIPerson: "start"
      })
    : [];
  const normalized = options.decoder === "simple"
    ? normalizeNerPersonTokens(row.text, raw, options.detector)
    : options.decoder === "offset-bio-repair"
      ? bioRepairCandidates
      : failClosedCandidates;
  const predicted = normalized.filter((candidate) => candidate.confidence >= threshold)
    .map(({ start, end, confidence, detector }) => ({ start, end, confidence, detector }));
  const gold = row.entities.map(({ start, end }) => ({ start, end }));

  if (options.comparisonReport && options.decoder !== "simple") {
    const failClosed = thresholdSpans(failClosedCandidates, threshold);
    const bioRepair = thresholdSpans(bioRepairCandidates, threshold);
    const leadingISequences = findLeadingIPersonSequences(offsetTokens);
    if (leadingISequences.length) {
      leadingIRows.push({
        group: row.group,
        category: row.category,
        hasGoldPerson: gold.length > 0,
        leadingISequences
      });
    }
    if (JSON.stringify(failClosed) !== JSON.stringify(bioRepair)) {
      decoderDifferences.push({
        group: row.group,
        category: row.category,
        text: row.text,
        goldPersonSpans: row.entities,
        failClosedPersonSpans: failClosed,
        bioRepairPersonSpans: bioRepair,
        leadingISequences
      });
    }
  }

  for (const [candidateThreshold, metrics] of thresholdSweep) {
    const candidates = normalized.filter((candidate) => candidate.confidence >= candidateThreshold);
    addMetrics(metrics, scoreSpans(gold, candidates), gold.length, candidates.length);
  }

  goldSpanCount += gold.length;
  predictedSpanCount += predicted.length;
  const scored = scoreSpans(gold, predicted);
  addMetrics(totals, scored, gold.length, predicted.length);
  if (!categoryMetrics.has(row.category)) categoryMetrics.set(row.category, emptyMetrics());
  addMetrics(categoryMetrics.get(row.category), scored, gold.length, predicted.length);
  for (const structure of structuralCategories(row)) {
    if (!structuralMetrics.has(structure)) structuralMetrics.set(structure, emptyMetrics());
    addMetrics(structuralMetrics.get(structure), scored, gold.length, predicted.length);
  }

  overlapDetected += gold.filter((expected) => predicted.some((actual) => overlaps(expected, actual))).length;

  if (scored.fp || scored.fn) {
    errors.push({
      text: row.text,
      group: row.group,
      category: row.category,
      goldPersonSpans: gold,
      predictedPersonSpans: predicted,
      errorType: classifyError(gold, predicted, scored),
      failureSource: diagnoseFailureSource(gold, predicted, normalized, offsetTokens, threshold),
      rawBioTokens: rawBioEvidence(offsetTokens),
      normalizedPersonCandidates: normalized.map(({ start, end, confidence, detector }) => ({
        start,
        end,
        confidence,
        detector,
        acceptedAtThreshold: confidence >= threshold
      }))
    });
  }
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, errors.map((row) => JSON.stringify(row)).join("\n") + (errors.length ? "\n" : ""), "utf8");
if (options.comparisonReport) {
  const comparisonReportPath = resolve(repoRoot, options.comparisonReport);
  await mkdir(dirname(comparisonReportPath), { recursive: true });
  await writeFile(
    comparisonReportPath,
    decoderDifferences.map((row) => JSON.stringify(row)).join("\n") +
      (decoderDifferences.length ? "\n" : ""),
    "utf8"
  );
  console.log(`Decoder-difference report: ${relative(repoRoot, comparisonReportPath)}`);
  console.log(`Decoder-difference rows: ${decoderDifferences.length}`);
  console.log(
    `Leading-I rows: gold=${leadingIRows.filter((row) => row.hasGoldPerson).length} ` +
      `no-gold=${leadingIRows.filter((row) => !row.hasGoldPerson).length} ` +
      `hard-negative=${leadingIRows.filter((row) => row.category === "hard_negative").length}`
  );
}

const leakage = await measureLeakage(benchmark);

console.log(`Model: ${modelId} (Transformers.js ${options.dtype})`);
console.log(`Decoder: ${options.decoder}`);
console.log(`Threshold: ${threshold.toFixed(2)}`);
console.log(`Rows: ${benchmark.length}`);
console.log(`Gold PERSON spans: ${goldSpanCount}`);
console.log(`Predicted PERSON spans: ${predictedSpanCount}`);
printMetrics("Exact", totals);
console.log(`Overlap/person-detected recall: ${ratio(overlapDetected, goldSpanCount)}`);
console.log("\nThreshold analysis (official threshold remains 0.50):");
for (const [candidateThreshold, metrics] of thresholdSweep) {
  printMetrics(candidateThreshold.toFixed(2), metrics);
}
console.log("\nCategory metrics:");
for (const [category, metrics] of categoryMetrics) printMetrics(category, metrics);
console.log("\nStructural metrics (categories may overlap):");
for (const [structure, metrics] of structuralMetrics) printMetrics(structure, metrics);
const hardNegative = categoryMetrics.get("hard_negative");
console.log(
  `Hard-negative false-positive rows: ${hardNegative?.falsePositiveRows ?? 0}/${hardNegative?.rows ?? 0}`
);
console.log("\nLeakage:");
console.log(`Duplicate benchmark rows: ${leakage.duplicateBenchmarkRows}`);
console.log(`Exact training sentence overlap: ${leakage.trainingSentenceOverlap}`);
console.log(`Exact existing-challenge sentence overlap: ${leakage.challengeSentenceOverlap}`);
console.log(`Normalized PERSON-name overlap with training: ${leakage.trainingNameOverlap}/${leakage.benchmarkUniqueNames}`);
console.log(`Normalized PERSON-name overlap with existing challenges: ${leakage.challengeNameOverlap}/${leakage.benchmarkUniqueNames}`);
console.log("\nErrors by category/type:");
for (const [key, count] of summarizeErrors(errors)) console.log(`${key}: ${count}`);
console.log(`Error report: ${relative(repoRoot, reportPath)}`);

function parseArgs(args) {
  const defaults = {
    benchmark: "ml/accord-ner/data/challenge/accord_person_browser_benchmark_v1.jsonl",
    training: "ml/accord-ner/data/raw/accord_person_v3.jsonl",
    report: "ml/accord-ner/reports/accord_person_browser_benchmark_v1_errors.jsonl",
    modelId: "accord-ner-v0.2",
    localModelPath: "extension/public/models",
    dtype: "q8",
    detector: "accord_ner_v0_2",
    decoder: "simple",
    comparisonReport: ""
  };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument: ${key ?? ""}`);
    const property = {
      "--benchmark": "benchmark",
      "--training": "training",
      "--report": "report",
      "--model-id": "modelId",
      "--local-model-path": "localModelPath",
      "--dtype": "dtype",
      "--detector": "detector",
      "--decoder": "decoder",
      "--comparison-report": "comparisonReport"
    }[key];
    if (!property) throw new Error(`Unknown argument: ${key}`);
    defaults[property] = value;
  }
  if (!["simple", "offset", "offset-bio-repair"].includes(defaults.decoder)) {
    throw new Error(`Unsupported decoder: ${defaults.decoder}`);
  }
  return defaults;
}

function thresholdSpans(candidates, candidateThreshold) {
  return candidates
    .filter((candidate) => candidate.confidence >= candidateThreshold)
    .map(({ start, end, confidence, detector, originalText }) => ({
      start,
      end,
      confidence,
      detector,
      originalText
    }));
}

function findLeadingIPersonSequences(tokens) {
  const sequences = [];
  let activePerson = false;
  let activeLeadingSequence = null;

  const flushLeading = () => {
    if (activeLeadingSequence) sequences.push(activeLeadingSequence);
    activeLeadingSequence = null;
  };

  for (const token of tokens) {
    const rawLabel = String(token.entity || token.label || token.entity_group || "").trim().toUpperCase();
    const isBeginPerson = /^(?:B-)(?:PER|PERSON)$/u.test(rawLabel);
    const isInsidePerson = /^(?:I-)(?:PER|PERSON)$/u.test(rawLabel);

    if (isBeginPerson) {
      flushLeading();
      activePerson = true;
      continue;
    }
    if (isInsidePerson) {
      if (!activePerson) {
        activeLeadingSequence = {
          start: token.start,
          end: token.end,
          scores: [token.score]
        };
      } else if (activeLeadingSequence) {
        activeLeadingSequence.end = token.end;
        activeLeadingSequence.scores.push(token.score);
      }
      activePerson = true;
      continue;
    }

    flushLeading();
    activePerson = false;
  }

  flushLeading();
  return sequences;
}

async function measureLeakage(rows) {
  const training = await readJsonl(trainingPath);
  const challengeFiles = (await readdir(challengeRoot))
    .filter((name) => name.endsWith(".jsonl") && join(challengeRoot, name) !== benchmarkPath);
  const challenges = (await Promise.all(challengeFiles.map((name) => readJsonl(join(challengeRoot, name))))).flat();
  const benchmarkSentences = rows.map((row) => normalizeSentence(row.text));
  const duplicateBenchmarkRows = benchmarkSentences.length - new Set(benchmarkSentences).size;
  const trainingSentences = new Set(training.map((row) => normalizeSentence(row.text)));
  const challengeSentences = new Set(challenges.map((row) => normalizeSentence(row.text)));
  const benchmarkNames = collectNames(rows);
  const trainingNames = collectNames(training);
  const challengeNames = collectNames(challenges);
  return {
    duplicateBenchmarkRows,
    trainingSentenceOverlap: benchmarkSentences.filter((text) => trainingSentences.has(text)).length,
    challengeSentenceOverlap: benchmarkSentences.filter((text) => challengeSentences.has(text)).length,
    trainingNameOverlap: [...benchmarkNames].filter((name) => trainingNames.has(name)).length,
    challengeNameOverlap: [...benchmarkNames].filter((name) => challengeNames.has(name)).length,
    benchmarkUniqueNames: benchmarkNames.size
  };
}

function collectNames(rows) {
  return new Set(
    rows.flatMap((row) => (row.entities || []).map((entity) => normalizeName(entity.text || ""))).filter(Boolean)
  );
}

function validateBenchmark(rows) {
  const groups = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row.text || !row.category || !row.group || !Array.isArray(row.entities)) {
      throw new Error(`Invalid benchmark row ${index + 1}`);
    }
    if (groups.has(row.group)) throw new Error(`Duplicate benchmark group: ${row.group}`);
    groups.add(row.group);
    for (const entity of row.entities) {
      if (entity.type !== "PERSON" || !Number.isInteger(entity.start) || !Number.isInteger(entity.end)) {
        throw new Error(`Invalid PERSON span in ${row.group}`);
      }
      if (row.text.slice(entity.start, entity.end) !== entity.text) {
        throw new Error(`Offset mismatch in ${row.group}: ${entity.start}:${entity.end}`);
      }
    }
  }
}

function normalizeSentence(text) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function normalizeName(text) {
  return text.normalize("NFKC").replace(/[’]/g, "'").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function scoreSpans(gold, predicted) {
  const goldKeys = new Set(gold.map(spanKey));
  const predictedKeys = new Set(predicted.map(spanKey));
  const tp = [...predictedKeys].filter((key) => goldKeys.has(key)).length;
  return { tp, fp: predicted.length - tp, fn: gold.length - tp };
}

function classifyError(gold, predicted, scored) {
  if (gold.some((expected) => predicted.some((actual) => overlaps(expected, actual) && spanKey(expected) !== spanKey(actual)))) {
    return "boundary";
  }
  if (scored.fp && scored.fn) return "FP+FN";
  return scored.fp ? "FP" : "FN";
}

function rawBioEvidence(tokens) {
  return tokens.map((token) => ({
    label: String(token.entity || token.label || token.entity_group || ""),
    score: Number(token.score),
    start: Number(token.start),
    end: Number(token.end)
  }));
}

function isPersonLabel(token) {
  return /^(?:B-|I-)?(?:PER|PERSON)$/u.test(
    String(token.entity || token.label || token.entity_group || "").trim().toUpperCase()
  );
}

function diagnoseFailureSource(gold, predicted, normalized, offsetTokens, candidateThreshold) {
  const rawPersonTokens = offsetTokens.filter(isPersonLabel);
  const rawPersonSequences = [];
  let activeSequence = [];
  for (const token of offsetTokens) {
    if (isPersonLabel(token)) {
      activeSequence.push(token);
    } else if (activeSequence.length) {
      rawPersonSequences.push(activeSequence);
      activeSequence = [];
    }
  }
  if (activeSequence.length) rawPersonSequences.push(activeSequence);
  const falseNegatives = gold.filter((expected) => !predicted.some((actual) => spanKey(actual) === spanKey(expected)));
  const details = falseNegatives.map((expected) => {
    const exactNormalized = normalized.find((candidate) => spanKey(candidate) === spanKey(expected));
    if (exactNormalized && exactNormalized.confidence < candidateThreshold) {
      return { span: expected, source: "threshold", reason: "exact candidate below threshold" };
    }
    const overlappingRaw = rawPersonTokens.filter((token) => overlaps(expected, token));
    if (!overlappingRaw.length) {
      return { span: expected, source: "model", reason: "no overlapping PERSON BIO token" };
    }
    const exactRawSequence = rawPersonSequences.find((sequence) => {
      const coverage = {
        start: Math.min(...sequence.map((token) => Number(token.start))),
        end: Math.max(...sequence.map((token) => Number(token.end)))
      };
      return spanKey(coverage) === spanKey(expected);
    });
    if (exactRawSequence) {
      return { span: expected, source: "decoder", reason: "raw PERSON coverage exactly matches gold but decoder did not emit it" };
    }
    const rawCoverage = {
      start: Math.min(...overlappingRaw.map((token) => Number(token.start))),
      end: Math.max(...overlappingRaw.map((token) => Number(token.end)))
    };
    return {
      span: expected,
      source: "model",
      reason: spanKey(rawCoverage) === spanKey(expected)
        ? "raw PERSON evidence is interrupted by O/non-PERSON labels"
        : `raw PERSON coverage is ${rawCoverage.start}:${rawCoverage.end}, not exact gold`
    };
  });
  if (!details.length) {
    return [{ source: "model", reason: "false-positive PERSON labels originate in raw model output" }];
  }
  return details;
}

function structuralCategories(row) {
  const categories = new Set();
  for (const entity of row.entities || []) {
    const value = String(entity.text || "");
    if (/\p{Ll}/u.test(value) && value === value.toLocaleLowerCase()) categories.add("lowercase");
    if (/\p{Script=Cyrillic}/u.test(value)) categories.add("cyrillic");
    if (/\p{Script=Hangul}/u.test(value)) categories.add("korean");
    if (/\p{Script=Han}/u.test(value)) {
      categories.add(/\s/u.test(value) ? "japanese" : "cjk");
    }
    if (/[^\x00-\x7F]/u.test(value) && /\p{Script=Latin}/u.test(value) &&
        !/[\p{Script=Cyrillic}\p{Script=Hangul}\p{Script=Han}]/u.test(value)) {
      categories.add("unicode_latin");
    }
  }
  return categories;
}

function emptyMetrics() {
  return { rows: 0, gold: 0, predicted: 0, tp: 0, fp: 0, fn: 0, falsePositiveRows: 0 };
}

function addMetrics(target, scored, gold, predicted) {
  target.rows += 1;
  target.gold += gold;
  target.predicted += predicted;
  target.tp += scored.tp;
  target.fp += scored.fp;
  target.fn += scored.fn;
  if (scored.fp) target.falsePositiveRows += 1;
}

function printMetrics(label, metrics) {
  const precision = metrics.tp / (metrics.tp + metrics.fp || 1);
  const recall = metrics.tp / (metrics.tp + metrics.fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);
  console.log(
    `${label}: rows=${metrics.rows} TP=${metrics.tp} FP=${metrics.fp} FN=${metrics.fn} ` +
      `precision=${precision.toFixed(4)} recall=${recall.toFixed(4)} F1=${f1.toFixed(4)}`
  );
}

function ratio(numerator, denominator) {
  return (numerator / (denominator || 1)).toFixed(4);
}

function overlaps(first, second) {
  return first.start < second.end && second.start < first.end;
}

function spanKey(span) {
  return `${span.start}:${span.end}`;
}

function summarizeErrors(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.category}/${row.errorType}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort(([first], [second]) => first.localeCompare(second));
}

async function readJsonl(path) {
  const contents = await readFile(path, "utf8");
  return contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

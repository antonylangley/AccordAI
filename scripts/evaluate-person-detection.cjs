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

const { scanText } = require(path.join(projectRoot, "packages/governance-core/src/scanner.ts"));
const { detectPersonCandidates } = require(path.join(projectRoot, "extension/src/person-detection/person-detector.ts"));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const corpus = buildCorpus();
  const metrics = { tp: 0, fp: 0, fn: 0 };
  const detectorBreakdown = {
    nerOnlyTruePositives: 0,
    heuristicOnlyTruePositives: 0,
    detectorAgreementTruePositives: 0
  };
  const falsePositives = [];
  const falseNegatives = [];

  for (const testCase of corpus) {
    const heuristicScan = scanText(testCase.input, "preflight", "Internal");
    const localDetection = await detectPersonCandidates(testCase.input);
    const hybridScan = scanText(testCase.input, "preflight", "Internal", {
      additionalCandidates: localDetection.candidates
    });
    const expected = testCase.expectedPeople.map(normalize);
    const actual = uniquePeople(hybridScan.entities);
    const heuristic = uniquePeople(heuristicScan.entities);
    const localCandidates = uniqueCandidatePeople(localDetection.candidates);

    for (const person of actual) {
      if (expected.includes(person)) {
        metrics.tp += 1;
        const heuristicHit = heuristic.includes(person);
        const localHit = localCandidates.includes(person);
        if (heuristicHit && localHit) detectorBreakdown.detectorAgreementTruePositives += 1;
        else if (heuristicHit) detectorBreakdown.heuristicOnlyTruePositives += 1;
        else if (localHit) detectorBreakdown.nerOnlyTruePositives += 1;
      } else {
        metrics.fp += 1;
        falsePositives.push({ id: testCase.id, text: testCase.input, person });
      }
    }

    for (const person of expected) {
      if (!actual.includes(person)) {
        metrics.fn += 1;
        falseNegatives.push({ id: testCase.id, text: testCase.input, person });
      }
    }
  }

  const precision = metrics.tp + metrics.fp === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fp);
  const recall = metrics.tp + metrics.fn === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const report = {
    cases: corpus.length,
    positiveCases: corpus.filter((testCase) => testCase.expectedPeople.length).length,
    negativeCases: corpus.filter((testCase) => !testCase.expectedPeople.length).length,
    person: {
      truePositives: metrics.tp,
      falsePositives: metrics.fp,
      falseNegatives: metrics.fn,
      precision: round(precision),
      recall: round(recall),
      f1: round(f1)
    },
    ...detectorBreakdown,
    falsePositives,
    falseNegatives
  };

  console.log(JSON.stringify(report, null, 2));

  if (falsePositives.length || falseNegatives.length) {
    process.exitCode = 1;
  }
}

function buildCorpus() {
  const names = [
    "John Smith",
    "Jane Miller",
    "David O'Connor",
    "David O’Connor",
    "María José García",
    "Jean-Pierre Dubois",
    "Saoirse O'Brien",
    "Mohammed Al-Fayed",
    "José Luis Rodríguez",
    "Anna van der Berg",
    "Ludwig van Beethoven",
    "Mary-Kate Olsen",
    "João da Silva",
    "Nguyễn Văn An",
    "Wei Zhang",
    "Li Wei",
    "Aisha bint Ahmed",
    "Priya Sharma",
    "Arjun Patel",
    "Fatima Al-Hassan",
    "Ana María López",
    "Carlos Hernández",
    "Élodie Martin",
    "François Dupont",
    "Hans Müller",
    "Sofia Rossi",
    "Yuki Tanaka",
    "Min-Jae Kim",
    "Chen Wei",
    "Nadia Petrova"
  ];
  const contexts = [
    (name) => `${name} completed the technical review.`,
    (name) => `Email ${name} about the report.`,
    (name) => `Tell ${name} the report is ready.`,
    (name) => `The candidate ${name} approved the document.`,
    (name) => `Patient ${name} called yesterday.`,
    (name) => `Ask ${name} to review this function.`,
    (name) => `The reviewer is ${name}.`,
    (name) => `Contact ${name} at 555-123-4567.`
  ];
  const multiPeople = [
    ["Mary Jones", "David O'Connor"],
    ["John Smith", "María José García"],
    ["Wei Zhang", "Li Wei"],
    ["Anna van der Berg", "João da Silva"],
    ["Jean-Pierre Dubois", "José Luis Rodríguez"]
  ];
  const positives = [];

  names.forEach((name, nameIndex) => {
    contexts.forEach((context, contextIndex) => {
      positives.push({
        id: `positive:${nameIndex}:${contextIndex}`,
        input: context(name),
        expectedPeople: [name]
      });
    });
  });

  multiPeople.forEach((people, index) => {
    positives.push({
      id: `positive:multi:${index}`,
      input: `${people[0]} and ${people[1]} should review the contract.`,
      expectedPeople: people
    });
  });

  const negatives = [
    "Representational State Transfer is an architectural style.",
    "Customer Support Team owns this queue.",
    "Q3 Risk Review is finished.",
    "The Monday Client Meeting was moved.",
    "React State Update caused a rerender.",
    "New York Office is closing.",
    "Accord Guard is active.",
    "OpenAI API keys must stay server-side.",
    "Artificial Intelligence Platform is the project title.",
    "GraphQL Query Builder generated the schema.",
    "Northstar Financial is the demo tenant.",
    "Model Context Protocol is enabled.",
    "TypeScript Compiler API parsed the code.",
    "Human Resources Dashboard loads slowly.",
    "Customer Success Motion is a roadmap item.",
    "Friday Planning Meeting starts at noon.",
    "Boston Office is closed tomorrow.",
    "Security Operations Center handles alerts.",
    "Design System Tokens changed.",
    "Prompt Injection Defense needs tests.",
    "class CustomerSupportTeam {}",
    "function ReactStateUpdate() { return null; }",
    "const NewYorkOffice = true;",
    "README_Q3_Risk_Review.md",
    "[PERSON_1] is already a placeholder.",
    "Email Regex Validator should not redact.",
    "Bank Account Workflow is unchanged.",
    "Legal Review Queue has two tickets.",
    "Medical Claims Portal failed.",
    "Source Code Scanner is local."
  ].map((input, index) => ({
    id: `negative:${index}`,
    input,
    expectedPeople: []
  }));

  return [...positives, ...negatives];
}

function uniquePeople(entities) {
  return Array.from(new Set(entities.filter((entity) => entity.type === "PERSON").map((entity) => normalize(entity.originalText))));
}

function uniqueCandidatePeople(candidates) {
  return Array.from(new Set(candidates.filter((candidate) => candidate.type === "PERSON").map((candidate) => normalize(candidate.originalText))));
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

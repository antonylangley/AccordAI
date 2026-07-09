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
  const lowercaseContextMetrics = { tp: 0, fp: 0, fn: 0 };
  const humanListMetrics = { tp: 0, fp: 0, fn: 0 };
  const coordinatedContextMetrics = { tp: 0, fp: 0, fn: 0 };
  const detectorBreakdown = {
    nerOnlyTruePositives: 0,
    localCandidateOnlyTruePositives: 0,
    heuristicOnlyTruePositives: 0,
    detectorAgreementTruePositives: 0
  };
  const personDetectorStatusCounts = {};
  const falsePositives = [];
  const falseNegatives = [];
  let normalWorkPromptCount = 0;
  let normalWorkFalseAlertCount = 0;

  for (const testCase of corpus) {
    const heuristicScan = scanText(testCase.input, "preflight", "Internal");
    const localDetection = await detectPersonCandidates(testCase.input);
    const status = localDetection.coverage?.nerStatus || "unknown";
    personDetectorStatusCounts[status] = (personDetectorStatusCounts[status] || 0) + 1;
    const hybridScan = scanText(testCase.input, "preflight", "Internal", {
      additionalCandidates: localDetection.candidates
    });
    const expected = testCase.expectedPeople.map(normalize);
    const actual = uniquePeople(hybridScan.entities);
    const heuristic = uniquePeople(heuristicScan.entities);
    const localCandidates = uniqueCandidatePeople(localDetection.candidates);

    applyMetrics(metrics, expected, actual);
    if (testCase.tags?.includes("lowercase_context_person")) {
      applyMetrics(lowercaseContextMetrics, expected, actual);
    }
    if (testCase.tags?.includes("human_list_context")) {
      applyMetrics(humanListMetrics, expected, actual);
    }
    if (testCase.tags?.includes("coordinated_human_context")) {
      applyMetrics(coordinatedContextMetrics, expected, actual);
    }
    if (testCase.tags?.includes("normal_work_negative")) {
      normalWorkPromptCount += 1;
      if (actual.length > 0) normalWorkFalseAlertCount += 1;
    }

    for (const person of actual) {
      if (expected.includes(person)) {
        const heuristicHit = heuristic.includes(person);
        const localHit = localCandidates.includes(person);
        if (heuristicHit && localHit) detectorBreakdown.detectorAgreementTruePositives += 1;
        else if (heuristicHit) detectorBreakdown.heuristicOnlyTruePositives += 1;
        else if (localHit) detectorBreakdown.localCandidateOnlyTruePositives += 1;
      } else {
        falsePositives.push({ id: testCase.id, text: testCase.input, person });
      }
    }

    for (const person of expected) {
      if (!actual.includes(person)) {
        falseNegatives.push({ id: testCase.id, text: testCase.input, person });
      }
    }
  }

  const fullScores = scores(metrics);
  const lowercaseScores = scores(lowercaseContextMetrics);
  const humanListScores = scores(humanListMetrics);
  const coordinatedContextScores = scores(coordinatedContextMetrics);
  const lowercaseCases = corpus.filter((testCase) => testCase.tags?.includes("lowercase_context_person"));
  const humanListCases = corpus.filter((testCase) => testCase.tags?.includes("human_list_context"));
  const coordinatedContextCases = corpus.filter((testCase) => testCase.tags?.includes("coordinated_human_context"));
  const report = {
    cases: corpus.length,
    positiveCases: corpus.filter((testCase) => testCase.expectedPeople.length).length,
    negativeCases: corpus.filter((testCase) => !testCase.expectedPeople.length).length,
    lowercase_context_person_support: {
      cases: lowercaseCases.length,
      expectedPeople: lowercaseCases.reduce((sum, testCase) => sum + testCase.expectedPeople.length, 0)
    },
    lowercase_context_person_precision: lowercaseScores.precision,
    lowercase_context_person_recall: lowercaseScores.recall,
    lowercase_context_person_f1: lowercaseScores.f1,
    human_list_context_precision: humanListScores.precision,
    human_list_context_recall: humanListScores.recall,
    human_list_context_f1: humanListScores.f1,
    coordinated_human_context_precision: coordinatedContextScores.precision,
    coordinated_human_context_recall: coordinatedContextScores.recall,
    coordinated_human_context_f1: coordinatedContextScores.f1,
    normal_work_false_alert_rate: normalWorkPromptCount === 0 ? 0 : round(normalWorkFalseAlertCount / normalWorkPromptCount),
    person: {
      truePositives: metrics.tp,
      falsePositives: metrics.fp,
      falseNegatives: metrics.fn,
      precision: fullScores.precision,
      recall: fullScores.recall,
      f1: fullScores.f1
    },
    humanListContext: {
      cases: humanListCases.length,
      truePositives: humanListMetrics.tp,
      falsePositives: humanListMetrics.fp,
      falseNegatives: humanListMetrics.fn
    },
    coordinatedHumanContext: {
      cases: coordinatedContextCases.length,
      truePositives: coordinatedContextMetrics.tp,
      falsePositives: coordinatedContextMetrics.fp,
      falseNegatives: coordinatedContextMetrics.fn
    },
    ...detectorBreakdown,
    personDetectorStatusCounts,
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

  const lowercaseContext = [
    {
      input: "write birthday invitations to my friends neta rogovsky, kevin trejos, brandon gizzo.",
      expectedPeople: ["neta rogovsky", "kevin trejos", "brandon gizzo"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "email neta rogovsky and kevin trejos abt saturday",
      expectedPeople: ["neta rogovsky", "kevin trejos"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "invite my friends david o'connor and maria garcia",
      expectedPeople: ["david o'connor", "maria garcia"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "the attendees are jean-pierre dubois, anna van der berg, and jo\u00e3o da silva",
      expectedPeople: ["jean-pierre dubois", "anna van der berg", "jo\u00e3o da silva"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "send this to kevin trejos",
      expectedPeople: ["kevin trejos"],
      tags: ["lowercase_context_person", "human_list_context"]
    },
    {
      input: "cc mary jones and david o'connor",
      expectedPeople: ["mary jones", "david o'connor"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "participants include wei zhang, li wei, and aisha bint ahmed",
      expectedPeople: ["wei zhang", "li wei", "aisha bint ahmed"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "my coworkers neta rogovsky and brandon gizzo are coming",
      expectedPeople: ["neta rogovsky", "brandon gizzo"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "email the recipients sarah connor, miles morales, peter parker",
      expectedPeople: ["sarah connor", "miles morales", "peter parker"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "ask john smith and mary jones to review it",
      expectedPeople: ["john smith", "mary jones"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "cc david o'connor and maria garcia",
      expectedPeople: ["david o'connor", "maria garcia"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "message jean-pierre dubois, anna van der berg and wei zhang",
      expectedPeople: ["jean-pierre dubois", "anna van der berg", "wei zhang"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "invite neta rogovsky, kevin trejos, and brandon gizzo",
      expectedPeople: ["neta rogovsky", "kevin trejos", "brandon gizzo"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "tell jo\u00e3o da silva and mar\u00eda jos\u00e9 garc\u00eda the meeting moved",
      expectedPeople: ["jo\u00e3o da silva", "mar\u00eda jos\u00e9 garc\u00eda"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "send this to li wei and aisha bint ahmed",
      expectedPeople: ["li wei", "aisha bint ahmed"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    },
    {
      input: "email sarah connor; miles morales; peter parker about the launch",
      expectedPeople: ["sarah connor", "miles morales", "peter parker"],
      tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context"]
    }
  ].map((testCase, index) => ({
    id: `lowercase-context:${index}`,
    ...testCase
  }));

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
    expectedPeople: [],
    tags: ["normal_work_negative"]
  }));

  const lowercaseNegatives = [
    "my friends list is stored in the database",
    "the people API returns customer records",
    "invite users to the platform",
    "participants include support team and product team",
    "send this to customer support",
    "the attendees endpoint is returning null",
    "friends net work status is down",
    "react state update and context provider",
    "birthday invitation template and customer email",
    "email support and sales about saturday",
    "ask product and engineering to review it",
    "message customer support and account management",
    "tell react state and context provider to update",
    "email the report and contract",
    "copy files and folders",
    "invite users and admins",
    "friends and family plan"
  ].map((input, index) => ({
    id: `lowercase-context-negative:${index}`,
    input,
    expectedPeople: [],
    tags: ["lowercase_context_person", "human_list_context", "coordinated_human_context", "normal_work_negative"]
  }));

  return [...positives, ...lowercaseContext, ...negatives, ...lowercaseNegatives];
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

function applyMetrics(metrics, expected, actual) {
  for (const person of actual) {
    if (expected.includes(person)) metrics.tp += 1;
    else metrics.fp += 1;
  }

  for (const person of expected) {
    if (!actual.includes(person)) metrics.fn += 1;
  }
}

function scores(metrics) {
  const precision = metrics.tp + metrics.fp === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fp);
  const recall = metrics.tp + metrics.fn === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    precision: round(precision),
    recall: round(recall),
    f1: round(f1)
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

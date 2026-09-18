import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const SKILL_DIR = "/Users/antonylangley/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const RUNTIME_PYTHON = "/Users/antonylangley/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const workspaceDir = "/Users/antonylangley/Projects/accord";
const buildDir = path.join(workspaceDir, ".codex-tmp/attachment-fixture-build/pptx-finalizer");
const finalPath = path.join(workspaceDir, "test-fixtures/attachment-uploads/08-redact-project-briefing.pptx");
await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href
);
const family = "Arial";
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = presentation.slides.add();
slide.background.fill = "#FFFFFF";

const accent = slide.shapes.add({
  geometry: "rect",
  position: { left: 0, top: 0, width: 18, height: 720 },
  fill: "#635BFF",
  line: { fill: "none", width: 0 },
});
const title = slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 58, width: 1136, height: 72 },
  fill: "none",
  line: { fill: "none", width: 0 },
});
title.text = "Project Northstar briefing contacts";
title.text.style = { typeface: family, fontSize: 34, bold: true, color: "#0B172B", autoFit: "none" };

const subtitle = slide.shapes.add({
  geometry: "textbox",
  position: { left: 76, top: 137, width: 1080, height: 48 },
  fill: "none",
  line: { fill: "none", width: 0 },
});
subtitle.text = "Synthetic fixture for local attachment redaction testing";
subtitle.text.style = { typeface: family, fontSize: 18, color: "#667085", autoFit: "none" };

const body = slide.shapes.add({
  geometry: "textbox",
  position: { left: 76, top: 230, width: 1060, height: 290 },
  fill: "#F7F8FB",
  line: { fill: "#D8DEE9", width: 1 },
});
body.text = [
  "Meeting owner: Lena Foster",
  "Email: lena.foster@example.test",
  "Phone: 646-555-0134",
  "",
  "Backup contact: Marcus Reed",
  "Email: marcus.reed@example.test",
  "Phone: 646-555-0188",
  "",
  "Prompt: Turn these contacts into a short handoff note.",
].join("\n");
body.text.style = { typeface: family, fontSize: 22, color: "#0B172B", autoFit: "shrinkText" };
body.text.paragraphFormat = { marginLeft: 28, marginRight: 28, marginTop: 24, marginBottom: 24, spaceAfter: 8 };

const expected = slide.shapes.add({
  geometry: "textbox",
  position: { left: 76, top: 570, width: 1060, height: 64 },
  fill: "none",
  line: { fill: "none", width: 0 },
});
expected.text = "Expected result: ALLOW after redaction. Accord should upload a governed text copy without the original names, emails, or phone numbers.";
expected.text.style = { typeface: family, fontSize: 16, color: "#667085", autoFit: "shrinkText" };
slide.speakerNotes.textFrame.setText("All names and contact details in this fixture are synthetic.");

const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const preview = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(
  "/Users/antonylangley/Projects/accord/.codex-tmp/attachment-fixture-build/pptx-preview.png",
  new Uint8Array(await preview.arrayBuffer()),
);

const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: [family] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, "08-redact-project-briefing.pptx.validation.json"),
});
console.log(JSON.stringify(result, null, 2));

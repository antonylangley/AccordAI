import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/antonylangley/Projects/accord/test-fixtures/attachment-uploads";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Project contacts");
sheet.showGridLines = false;
sheet.getRange("A1:D1").merge();
sheet.getRange("A1").values = [["Project Cedar contacts"]];
sheet.getRange("A1:D1").format = {
  font: { name: "Arial", size: 15, bold: true, color: "#0B172B" },
  verticalAlignment: "center",
};
sheet.getRange("A3:D7").values = [
  ["Name", "Email", "Phone", "Assignment"],
  ["Priya Shah", "priya.shah@example.test", "415-555-0128", "Customer interviews"],
  ["Elliot Brooks", "elliot.brooks@example.test", "415-555-0153", "Product research"],
  ["Sofia Martinez", "sofia.martinez@example.test", "415-555-0171", "Launch operations"],
  ["Expected outcome", "ALLOW after redaction", "No raw PII", "Governed text copy"],
];
sheet.getRange("A3:D3").format = {
  fill: "#635BFF",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
};
sheet.getRange("A4:D7").format = {
  font: { name: "Arial", size: 10, color: "#0B172B" },
  verticalAlignment: "center",
  borders: { preset: "all", style: "thin", color: "#D8DEE9" },
};
sheet.getRange("A7:D7").format = {
  fill: "#EEF1F6",
  font: { name: "Arial", size: 9, bold: true, color: "#667085" },
};
sheet.getRange("A1:D7").format.rowHeight = 24;
sheet.getRange("A:A").format.columnWidth = 22;
sheet.getRange("B:B").format.columnWidth = 34;
sheet.getRange("C:C").format.columnWidth = 20;
sheet.getRange("D:D").format.columnWidth = 27;
workbook.recalculate();

const inspection = await workbook.inspect({
  kind: "table",
  sheetId: "Project contacts",
  range: "A1:D7",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 6,
});
console.log(inspection.ndjson);

const preview = await workbook.render({
  sheetName: "Project contacts",
  range: "A1:D7",
  scale: 2,
  format: "png",
});
await fs.writeFile(
  "/Users/antonylangley/Projects/accord/.codex-tmp/attachment-fixture-build/xlsx-preview.png",
  new Uint8Array(await preview.arrayBuffer()),
);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/06-redact-project-contacts.xlsx`);

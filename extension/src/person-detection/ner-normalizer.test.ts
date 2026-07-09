import { describe, expect, test } from "vitest";
import { normalizeNerPersonTokens } from "./ner-normalizer";

describe("NER PERSON normalization", () => {
  test("merges split apostrophe tokens into an exact source span", () => {
    const text = "Email David O'Connor about the report.";
    const david = text.indexOf("David");
    const o = text.indexOf("O'Connor");
    const apostrophe = text.indexOf("'");
    const connor = text.indexOf("Connor");
    const candidates = normalizeNerPersonTokens(text, [
      { entity: "B-PER", start: david, end: david + "David".length, score: 0.98 },
      { entity: "I-PER", start: o, end: o + 1, score: 0.95 },
      { entity: "I-PER", start: apostrophe, end: apostrophe + 1, score: 0.9 },
      { entity: "I-PER", start: connor, end: connor + "Connor".length, score: 0.97 }
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        type: "PERSON",
        originalText: "David O'Connor",
        start: david,
        end: connor + "Connor".length
      })
    ]);
    expect(text.slice(candidates[0].start, candidates[0].end)).toBe(candidates[0].originalText);
  });

  test("merges Unicode multi-token names without normalizing source text", () => {
    const text = "María José García approved the document.";
    const maria = text.indexOf("María");
    const jose = text.indexOf("José");
    const garcia = text.indexOf("García");
    const candidates = normalizeNerPersonTokens(text, [
      { entity: "B-PERSON", start: maria, end: maria + "María".length, score: 0.97 },
      { entity: "I-PERSON", start: jose, end: jose + "José".length, score: 0.96 },
      { entity: "I-PERSON", start: garcia, end: garcia + "García".length, score: 0.96 }
    ]);

    expect(candidates[0]).toMatchObject({
      originalText: "María José García",
      start: maria,
      end: garcia + "García".length
    });
    expect(text.slice(candidates[0].start, candidates[0].end)).toBe("María José García");
  });

  test("supports entity_group PER labels from token-classification pipelines", () => {
    const text = "Tell Nguyễn Văn An the memo is ready.";
    const start = text.indexOf("Nguyễn");
    const end = start + "Nguyễn Văn An".length;
    const candidates = normalizeNerPersonTokens(text, [{ entity_group: "PER", start, end, score: 0.93 }]);

    expect(candidates).toEqual([
      expect.objectContaining({
        originalText: "Nguyễn Văn An",
        start,
        end
      })
    ]);
  });

  test("rejects missing, invalid, or non-PER token spans", () => {
    const text = "React State Update caused a rerender.";
    const candidates = normalizeNerPersonTokens(text, [
      { entity: "B-ORG", start: 0, end: 5, score: 0.99 },
      { entity: "B-PER", start: -1, end: 4, score: 0.99 },
      { entity: "I-PER", start: 0, end: text.length + 10, score: 0.99 },
      { entity: "O", start: 6, end: 11, score: 0.99 }
    ]);

    expect(candidates).toEqual([]);
  });
});

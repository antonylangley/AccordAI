import { describe, expect, test } from "vitest";
import {
  addSourceOffsetsToNerTokens,
  normalizeOffsetNerPersonTokens,
  type NerTokenizer
} from "./ner-offset-normalizer";
import type { NerToken } from "./ner-normalizer";

describe("offset-first NER PERSON candidate normalizer", () => {
  test.each([
    ["Jean-Pierre", ["Jean", "-", "Pierre"]],
    ["jean-pierre", ["jean", "-", "pierre"]],
    ["Mary-Jane Watson", ["Mary", "-", "Jane", "Watson"]],
    ["Fatima al-Zahra", ["Fatima", "al", "-", "Zahra"]],
    ["Søren Nielsen", ["Søren", "Nielsen"]],
    ["李明", ["李", "明"]],
    ["bruce young", ["br", "uce", "young"]],
    ["David O'Connor", ["David", "O", "'", "Connor"]],
    ["João da Silva", ["João", "da", "Silva"]],
    ["María José García", ["María", "José", "García"]],
    ["Alexanderson", ["Alex", "ander", "son"]]
  ])("reconstructs the exact full source span for %s", (name, pieces) => {
    const text = `Notify ${name} today.`;
    const candidates = normalizeOffsetNerPersonTokens(text, personTokens(text, pieces));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: "PERSON",
      originalText: name,
      start: text.indexOf(name),
      end: text.indexOf(name) + name.length,
      detector: "local_ner_model",
      contextSignals: ["ner_person"]
    });
    expect(candidates[0].confidence).toBeCloseTo(0.99);
  });

  test("does not merge PERSON spans across an O token", () => {
    const text = "John from Smith";
    const candidates = normalizeOffsetNerPersonTokens(text, [
      token(text, "John", "B-PERSON"),
      token(text, "from", "O"),
      token(text, "Smith", "B-PERSON")
    ]);

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["John", "Smith"]);
  });

  test("does not expand Morgan across an O-labeled company continuation", () => {
    const text = "Morgan Stanley raised its forecast.";
    const candidates = normalizeOffsetNerPersonTokens(text, [
      token(text, "Morgan", "B-PERSON"),
      token(text, "Stanley", "O")
    ]);

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["Morgan"]);
  });

  test("does not bridge O-labeled punctuation", () => {
    const text = "Jean-Pierre";
    const candidates = normalizeOffsetNerPersonTokens(text, [
      token(text, "Jean", "B-PERSON"),
      token(text, "-", "O"),
      token(text, "Pierre", "I-PERSON")
    ]);

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["Jean"]);
  });

  test("a new B-PERSON closes the previous PERSON span", () => {
    const text = "Alice Bob";
    const candidates = normalizeOffsetNerPersonTokens(text, [
      token(text, "Alice", "B-PERSON"),
      token(text, "Bob", "B-PERSON")
    ]);

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["Alice", "Bob"]);
  });

  test("drops a B-PERSON emitted on a WordPiece continuation boundary", () => {
    const text = "bruce young";
    const tokens = [
      { ...token(text, "br", "B-PERSON"), word: "br" },
      { ...token(text, "uce", "B-PERSON"), word: "##uce" },
      { ...token(text, "young", "I-PERSON"), word: "young" }
    ];
    const candidates = normalizeOffsetNerPersonTokens(text, tokens);

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["br"]);
    expect(
      normalizeOffsetNerPersonTokens(text, tokens, "local_ner_model", {
        leadingIPerson: "start"
      }).map((candidate) => candidate.originalText)
    ).toEqual(["br"]);
  });

  test("drops a malformed leading I-PERSON conservatively", () => {
    const text = "Notify García.";
    const candidates = normalizeOffsetNerPersonTokens(text, [token(text, "García", "I-PERSON")]);

    expect(candidates).toEqual([]);
  });

  test("BIO repair starts an exact PERSON span from contiguous leading I-PERSON tokens", () => {
    const text = "email helena cruz today";
    const candidates = normalizeOffsetNerPersonTokens(
      text,
      [token(text, "helena", "I-PERSON"), token(text, "cruz", "I-PERSON")],
      "local_ner_model",
      { leadingIPerson: "start" }
    );

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["helena cruz"]);
  });

  test("BIO repair never bridges an O token between leading I-PERSON spans", () => {
    const text = "john from smith";
    const candidates = normalizeOffsetNerPersonTokens(
      text,
      [
        token(text, "john", "I-PERSON"),
        token(text, "from", "O"),
        token(text, "smith", "I-PERSON")
      ],
      "local_ner_model",
      { leadingIPerson: "start" }
    );

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["john", "smith"]);
    expect(candidates.some((candidate) => candidate.originalText === "john from smith")).toBe(false);
  });

  test("BIO repair never expands a leading Morgan I-PERSON across O-labeled Stanley", () => {
    const text = "Morgan Stanley raised its forecast.";
    const candidates = normalizeOffsetNerPersonTokens(
      text,
      [token(text, "Morgan", "I-PERSON"), token(text, "Stanley", "O")],
      "local_ner_model",
      { leadingIPerson: "start" }
    );

    expect(candidates.map((candidate) => candidate.originalText)).toEqual(["Morgan"]);
    expect(candidates.some((candidate) => candidate.originalText === "Morgan Stanley")).toBe(false);
  });

  test("BIO repair leaves normal B-PERSON plus I-PERSON behavior unchanged", () => {
    const text = "Helena Cruz";
    const tokens = [token(text, "Helena", "B-PERSON"), token(text, "Cruz", "I-PERSON")];

    expect(
      normalizeOffsetNerPersonTokens(text, tokens).map((candidate) => candidate.originalText)
    ).toEqual(["Helena Cruz"]);
    expect(
      normalizeOffsetNerPersonTokens(text, tokens, "local_ner_model", {
        leadingIPerson: "start"
      }).map((candidate) => candidate.originalText)
    ).toEqual(["Helena Cruz"]);
  });

  test("derives UTF-16 source offsets with a non-BMP character before the entity", () => {
    const text = "🙂 note for Søren Nielsen";
    const tokenizer = fixtureTokenizer({
      [text]: ["[CLS]", "[UNK]", "note", "for", "S", "##ø", "##ren", "Nielsen", "[SEP]"],
      "🙂": ["[UNK]"],
      note: ["note"],
      for: ["for"],
      Søren: ["S", "##ø", "##ren"],
      Nielsen: ["Nielsen"]
    });
    const raw: NerToken[] = [
      { entity: "B-PERSON", index: 4, score: 0.98 },
      { entity: "I-PERSON", index: 5, score: 0.97 },
      { entity: "I-PERSON", index: 6, score: 0.96 },
      { entity: "I-PERSON", index: 7, score: 0.95 }
    ];

    const offsetTokens = addSourceOffsetsToNerTokens(text, raw, tokenizer);
    const candidates = normalizeOffsetNerPersonTokens(text, offsetTokens);

    expect(text.indexOf("Søren")).toBe(12);
    expect(offsetTokens[0]).toMatchObject({ start: 12, end: 13 });
    expect(candidates[0]).toMatchObject({
      originalText: "Søren Nielsen",
      start: 12,
      end: text.length
    });
  });

  test("fails closed when tokenizer and source token streams cannot be proven equivalent", () => {
    const text = "Notify Jean-Pierre";
    const tokenizer = fixtureTokenizer({
      [text]: ["[CLS]", "Notify", "Jean", "-", "WRONG", "[SEP]"],
      Notify: ["Notify"],
      Jean: ["Jean"],
      "-": ["-"],
      Pierre: ["Pierre"]
    });

    expect(addSourceOffsetsToNerTokens(text, [{ entity: "B-PERSON", index: 2 }], tokenizer)).toEqual([]);
  });
});

function personTokens(text: string, pieces: string[]): NerToken[] {
  let cursor = 0;
  return pieces.map((piece, index) => {
    const start = text.indexOf(piece, cursor);
    if (start < 0) throw new Error(`Missing explicit test piece: ${piece}`);
    cursor = start + piece.length;
    return { entity: index === 0 ? "B-PERSON" : "I-PERSON", start, end: cursor, score: 0.99 };
  });
}

function token(text: string, value: string, entity: string): NerToken {
  const start = text.indexOf(value);
  return { entity, start, end: start + value.length, score: 0.99 };
}

function fixtureTokenizer(fixtures: Record<string, string[]>): NerTokenizer {
  return {
    tokenize(text, options) {
      const tokens = fixtures[text];
      if (!tokens) throw new Error(`Missing tokenizer fixture for: ${text}`);
      if (options?.add_special_tokens === false) return tokens;
      return tokens;
    }
  };
}

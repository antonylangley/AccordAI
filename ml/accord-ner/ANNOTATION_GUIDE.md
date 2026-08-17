# Accord NER v1 Annotation Guide

## Goal

Accord NER v1 detects **human person names** in text before the text leaves the user's device.

The model should favor **precision over recall**. A false positive changes a user's prompt and damages trust, so ambiguous spans should not be labeled unless the surrounding text provides evidence that the span refers to a human.

## Label set

- `PERSON`

The training pipeline will later convert human-authored PERSON spans to BIO labels:

- `O`
- `B-PERSON`
- `I-PERSON`

## Label as PERSON

Examples:

- John Smith
- Sarah Chen
- Michael Rodriguez
- José de la Cruz
- Jean-Pierre Dupont
- Saoirse O'Connor
- Aisha Rahman

### Titles

Label the person's name, not the title.

`Dr. Sarah Chen reviewed the chart.`

Label: `Sarah Chen`

`CEO Michael Rodriguez approved it.`

Label: `Michael Rodriguez`

### Multiple people

Each person gets a separate span.

`Sarah Chen and Michael Rodriguez reviewed the report.`

Labels:

- `Sarah Chen`
- `Michael Rodriguez`

## Do NOT label as PERSON

Do not label organizations, products, locations, dates, technical identifiers, or ordinary phrases.

Examples:

- OpenAI
- ChatGPT
- Apple
- New York
- John Deere
- Morgan Stanley
- Johnson & Johnson
- Smith machine
- May 2026
- `john-smith`
- `JohnSmithFactory`
- customer support
- account manager
- email address
- address back
- me exactly

## Context-sensitive examples

`Ask Jordan to approve the report.`

`Jordan` = PERSON

`Jordan is a country in the Middle East.`

No PERSON.

---

`May approved the report.`

`May` = PERSON if the context clearly describes a human.

`May is next month.`

No PERSON.

---

`Rose reviewed the document.`

`Rose` = PERSON.

`Rose is my favorite flower.`

No PERSON.

---

`Will sent me the report.`

`Will` = PERSON.

`Will this deployment work?`

No PERSON.

## Code and technical text

Do not label a name-like token when it is clearly a code or technical identifier.

Examples that should contain no PERSON entity:

- `const John = new User();`
- `class JohnSmithFactory {}`
- `git checkout john-smith`
- `michael_service failed`
- `SarahChenController`

## Organizations containing names

Do not label a span as PERSON when the full context clearly refers to an organization or brand.

Examples:

- John Deere
- Johnson & Johnson
- Morgan Stanley
- Goldman Sachs

## International names

Include realistic name structures and diacritics. English enterprise prompts frequently contain international names.

Examples:

- José de la Cruz
- João Pereira
- Jean-Pierre Dupont
- Saoirse O'Connor
- Nguyễn Minh Anh
- Mohammed Al-Farsi
- Aisha Rahman
- Mary-Kate Olsen
- Ludwig van Beethoven
- Li Wei

## Ambiguity rule

When there is not enough evidence that a token refers to a human, prefer **not** labeling it.

Accord NER v1 is optimized for high precision.

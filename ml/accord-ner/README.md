# Accord NER v1

A local PERSON named-entity-recognition project for Accord.

## Goal

Build and evaluate a high-precision PERSON detector that can eventually run entirely on-device in the Accord browser extension. Structured identifiers such as email addresses, phone numbers, SSNs, payment cards, secrets, IP addresses, and account IDs remain the responsibility of Accord's deterministic recognizers.

The first baseline model is:

`dslim/distilbert-NER`

The eventual Accord-specific model will be fine-tuned for the narrower label set:

- `O`
- `B-PERSON`
- `I-PERSON`

## Privacy architecture

Training and experimentation may download model weights on a development machine. Production detection must eventually run locally in the extension before sanitized text is sent to an AI provider. Raw prompt text must not be sent to a remote NER service.

## Project layout

```text
accord-ner/
├── data/
│   ├── raw/
│   ├── train/
│   ├── validation/
│   └── test/
├── scripts/
│   ├── dataset_utils.py
│   ├── validate_dataset.py
│   ├── split_dataset.py
│   └── evaluate_baseline.py
├── models/
├── results/
├── ANNOTATION_GUIDE.md
├── README.md
└── requirements.txt
```

## 1. Create a Python environment

Transformers currently supports Python 3.10+.

### Windows PowerShell

```powershell
cd ml/accord-ner
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### macOS / Linux

```bash
cd ml/accord-ner
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 2. Validate the gold dataset

```bash
python scripts/validate_dataset.py data/raw/accord_person_v1.jsonl
```

This checks JSON structure, PERSON labels, missing entity strings, ambiguous repeated matches, and overlapping entity spans.

To write a normalized copy containing character offsets:

```bash
python scripts/validate_dataset.py data/raw/accord_person_v1.jsonl --output results/accord_person_v1.normalized.jsonl
```

## 3. Grow the dataset

The included file is only a starter seed. Do not train a final model on 50 examples.

Recommended progression:

1. Hand-review the included examples.
2. Grow to at least ~100 examples before creating a permanent test split.
3. Aim for roughly 500 high-quality gold examples for the first meaningful fine-tuning experiment.
4. Continue expanding based on measured error categories rather than random volume.

Hard negatives and context-sensitive contrast pairs are especially important.

## 4. Create train / validation / test splits

Once the dataset is large enough:

```bash
python scripts/split_dataset.py data/raw/accord_person_v1.jsonl --seed 1337
```

This writes deterministic splits to `data/train`, `data/validation`, and `data/test`.

**Important:** once the test set becomes the official held-out benchmark, do not move its examples into training because the model failed on them. Add new training examples that represent the same failure class instead.

## 5. Evaluate the untouched baseline

After creating a test split:

```bash
python scripts/evaluate_baseline.py data/test/accord_person_v1.test.jsonl
```

The script runs `dslim/distilbert-NER`, keeps only `PER` predictions, and reports exact-span entity-level precision, recall, and F1. It also saves detailed false positives and false negatives under `results/`.

The baseline downloads the model from Hugging Face on the development machine. This is only for model development; it is not the production privacy architecture.

## What comes next

Do not integrate NER into `governance-core` yet.

After the dataset and baseline are trustworthy, the next milestones are:

1. Analyze baseline errors.
2. Expand the dataset specifically around failure modes.
3. Convert character spans to tokenizer-aligned BIO labels.
4. Fine-tune a DistilBERT token-classification model.
5. Evaluate precision / recall / F1 and clean-prompt false positives.
6. Tune confidence thresholds using validation data only.
7. Export the best checkpoint to ONNX.
8. Quantize and benchmark browser latency / memory.
9. Integrate local PERSON candidates with Accord's deterministic recognizers.
10. Add offline and zero-network-request privacy tests.

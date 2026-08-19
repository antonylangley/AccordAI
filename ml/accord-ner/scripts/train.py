from __future__ import annotations

import argparse
import gc
import inspect
import json
import math
import shutil
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from seqeval.metrics import f1_score, precision_score, recall_score
from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    DataCollatorForTokenClassification,
    Trainer,
    TrainingArguments,
    set_seed,
)

from dataset_utils import load_jsonl, normalize_row


MODEL_NAME = "dslim/distilbert-NER"

LABELS = ["O", "B-PERSON", "I-PERSON"]
LABEL2ID = {label: index for index, label in enumerate(LABELS)}
ID2LABEL = {index: label for label, index in LABEL2ID.items()}

# The source checkpoint calls these B-PER / I-PER.
SOURCE_LABEL = {
    "O": "O",
    "B-PERSON": "B-PER",
    "I-PERSON": "I-PER",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune Accord PERSON NER v0.1."
    )
    parser.add_argument(
        "--train",
        default="data/train/accord_person_v2.train.jsonl",
        help="Training JSONL path.",
    )
    parser.add_argument(
        "--validation",
        default="data/validation/accord_person_v2.validation.jsonl",
        help="Validation JSONL path.",
    )
    parser.add_argument(
        "--output-dir",
        default="models/accord-ner-v0.1",
        help="Directory for checkpoints and the saved best model.",
    )
    parser.add_argument("--epochs", type=float, default=5.0)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Delete an existing output directory before training.",
    )
    return parser.parse_args()


def preferred_device() -> str:
    if torch.cuda.is_available():
        return "cuda (NVIDIA GPU)"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps (Apple GPU)"
    return "cpu"


def load_dataset(path: str | Path) -> Dataset:
    rows = load_jsonl(path)
    normalized = [normalize_row(row) for row in rows]
    return Dataset.from_list(normalized)


def tokenize_and_align_labels(
    example: dict,
    tokenizer,
    max_length: int,
) -> dict:
    """
    Convert Accord character-span annotations into token-level BIO labels.

    Example:
        "Send this to Sarah Chen."

        Send   -> O
        this   -> O
        to     -> O
        Sarah  -> B-PERSON
        Chen   -> I-PERSON
        .      -> O

    Special/padding tokens use -100 so PyTorch ignores them in the loss.
    """
    encoded = tokenizer(
        example["text"],
        truncation=True,
        max_length=max_length,
        return_offsets_mapping=True,
    )

    offsets = encoded["offset_mapping"]
    entities = sorted(
        example["entities"],
        key=lambda entity: (entity["start"], entity["end"]),
    )

    labels: list[int] = []
    previous_entity_index: int | None = None

    for token_start, token_end in offsets:
        if token_start == token_end:
            labels.append(-100)
            previous_entity_index = None
            continue

        matching_entity_index = None

        for entity_index, entity in enumerate(entities):
            if token_start < entity["end"] and token_end > entity["start"]:
                matching_entity_index = entity_index
                break

        if matching_entity_index is None:
            labels.append(LABEL2ID["O"])
            previous_entity_index = None
            continue

        if matching_entity_index != previous_entity_index:
            labels.append(LABEL2ID["B-PERSON"])
        else:
            labels.append(LABEL2ID["I-PERSON"])

        previous_entity_index = matching_entity_index

    encoded.pop("offset_mapping")
    encoded["labels"] = labels
    return encoded


def count_expected_entities(dataset: Dataset) -> int:
    return sum(len(example["entities"]) for example in dataset)


def count_aligned_entities(tokenized_dataset: Dataset) -> int:
    return sum(
        sum(label == LABEL2ID["B-PERSON"] for label in example["labels"])
        for example in tokenized_dataset
    )


def show_alignment_example(
    raw_dataset: Dataset,
    tokenized_dataset: Dataset,
    tokenizer,
) -> None:
    positive_index = next(
        index
        for index, example in enumerate(raw_dataset)
        if len(example["entities"]) > 0
    )

    raw = raw_dataset[positive_index]
    encoded = tokenized_dataset[positive_index]

    print("\nAlignment sanity check")
    print("----------------------")
    print("Text:", raw["text"])
    print()

    tokens = tokenizer.convert_ids_to_tokens(encoded["input_ids"])
    for token, label_id in zip(tokens, encoded["labels"]):
        if label_id == -100:
            continue
        print(f"{token:<18} {ID2LABEL[label_id]}")
    print()


def build_model() -> torch.nn.Module:
    """
    Build Accord's 3-label model while preserving the source checkpoint's
    pretrained O / B-PER / I-PER classifier weights.
    """
    print(f"Loading pretrained model: {MODEL_NAME}")

    source_model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME)

    model = AutoModelForTokenClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )

    if not hasattr(source_model, "classifier") or not hasattr(model, "classifier"):
        raise RuntimeError(
            "Expected a token-classification model with a .classifier layer."
        )

    with torch.no_grad():
        for target_label, target_id in LABEL2ID.items():
            source_label = SOURCE_LABEL[target_label]
            source_id = source_model.config.label2id[source_label]

            model.classifier.weight[target_id].copy_(
                source_model.classifier.weight[source_id]
            )
            model.classifier.bias[target_id].copy_(
                source_model.classifier.bias[source_id]
            )

    del source_model
    gc.collect()

    print("Initialized Accord's 3-label head from pretrained PERSON weights.")
    return model


def compute_metrics(eval_prediction) -> dict[str, float]:
    logits, labels = eval_prediction
    predictions = np.argmax(logits, axis=-1)

    true_predictions: list[list[str]] = []
    true_labels: list[list[str]] = []

    for prediction_row, label_row in zip(predictions, labels):
        prediction_labels: list[str] = []
        gold_labels: list[str] = []

        for prediction_id, label_id in zip(prediction_row, label_row):
            if label_id == -100:
                continue
            prediction_labels.append(ID2LABEL[int(prediction_id)])
            gold_labels.append(ID2LABEL[int(label_id)])

        true_predictions.append(prediction_labels)
        true_labels.append(gold_labels)

    return {
        "precision": precision_score(true_labels, true_predictions),
        "recall": recall_score(true_labels, true_predictions),
        "f1": f1_score(true_labels, true_predictions),
    }


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    train_path = Path(args.train)
    validation_path = Path(args.validation)
    output_dir = Path(args.output_dir)

    if not train_path.exists():
        raise FileNotFoundError(f"Training file not found: {train_path}")
    if not validation_path.exists():
        raise FileNotFoundError(f"Validation file not found: {validation_path}")

    if output_dir.exists() and any(output_dir.iterdir()):
        if not args.overwrite:
            raise RuntimeError(
                f"{output_dir} already contains files. "
                "Use --overwrite if you intentionally want to replace that run."
            )
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    print("Accord PERSON NER v0.1")
    print("======================")
    print("PyTorch:", torch.__version__)
    print("Preferred hardware:", preferred_device())
    print("Seed:", args.seed)
    print("Labels:", LABEL2ID)
    print()

    print("Loading datasets...")
    train_raw = load_dataset(train_path)
    validation_raw = load_dataset(validation_path)

    print(f"Train examples:      {len(train_raw)}")
    print(f"Validation examples: {len(validation_raw)}")

    print("\nLoading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=True)

    train_tokenized = train_raw.map(
        lambda example: tokenize_and_align_labels(
            example, tokenizer, args.max_length
        ),
        remove_columns=train_raw.column_names,
        desc="Tokenizing training data",
    )

    validation_tokenized = validation_raw.map(
        lambda example: tokenize_and_align_labels(
            example, tokenizer, args.max_length
        ),
        remove_columns=validation_raw.column_names,
        desc="Tokenizing validation data",
    )

    train_expected = count_expected_entities(train_raw)
    train_aligned = count_aligned_entities(train_tokenized)
    val_expected = count_expected_entities(validation_raw)
    val_aligned = count_aligned_entities(validation_tokenized)

    print("\nAlignment check")
    print("---------------")
    print(f"Train entities:      expected={train_expected}, aligned={train_aligned}")
    print(f"Validation entities: expected={val_expected}, aligned={val_aligned}")

    if train_expected != train_aligned or val_expected != val_aligned:
        raise RuntimeError(
            "BIO alignment lost one or more annotated entities. "
            "Do not train until this is fixed."
        )

    show_alignment_example(train_raw, train_tokenized, tokenizer)

    model = build_model()
    data_collator = DataCollatorForTokenClassification(tokenizer=tokenizer)

    # Keep this script compatible across recent Transformers versions.
    # With 140 rows, batch size 8, and 5 epochs this is ~90 optimizer steps,
    # so 10% warmup is ~9 steps.
    steps_per_epoch = math.ceil(len(train_tokenized) / args.batch_size)
    total_training_steps = max(1, math.ceil(steps_per_epoch * args.epochs))
    warmup_steps = max(1, round(total_training_steps * 0.10))

    training_kwargs = dict(
        output_dir=str(output_dir),
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        warmup_steps=warmup_steps,
        max_grad_norm=1.0,
        optim="adamw_torch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=5,
        logging_first_step=True,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=args.seed,
        data_seed=args.seed,
        dataloader_pin_memory=False,
    )

    training_arg_names = inspect.signature(TrainingArguments.__init__).parameters
    if "eval_strategy" in training_arg_names:
        training_kwargs["eval_strategy"] = "epoch"
    elif "evaluation_strategy" in training_arg_names:
        training_kwargs["evaluation_strategy"] = "epoch"
    else:
        raise RuntimeError(
            "This Transformers version exposes neither eval_strategy nor "
            "evaluation_strategy in TrainingArguments."
        )

    training_args = TrainingArguments(**training_kwargs)

    trainer_kwargs = dict(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=validation_tokenized,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    trainer_arg_names = inspect.signature(Trainer.__init__).parameters
    if "processing_class" in trainer_arg_names:
        trainer_kwargs["processing_class"] = tokenizer
    elif "tokenizer" in trainer_arg_names:
        trainer_kwargs["tokenizer"] = tokenizer

    trainer = Trainer(**trainer_kwargs)

    print(f"Warmup steps: {warmup_steps} / ~{total_training_steps} total")

    print("\nTrainer selected device:", trainer.args.device)
    print("\nStarting fine-tuning...")
    print("-----------------------")

    train_result = trainer.train()

    print("\nEvaluating best checkpoint on validation...")
    validation_metrics = trainer.evaluate()

    best_dir = output_dir / "best"
    trainer.save_model(str(best_dir))
    tokenizer.save_pretrained(str(best_dir))

    summary = {
        "base_model": MODEL_NAME,
        "labels": LABELS,
        "seed": args.seed,
        "train_examples": len(train_raw),
        "validation_examples": len(validation_raw),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "best_checkpoint": trainer.state.best_model_checkpoint,
        "train_metrics": train_result.metrics,
        "validation_metrics": validation_metrics,
    }

    with (output_dir / "training_summary.json").open(
        "w", encoding="utf-8"
    ) as handle:
        json.dump(summary, handle, indent=2)

    print("\nTraining complete")
    print("=================")
    print("Best checkpoint:", trainer.state.best_model_checkpoint)
    print(f"Validation precision: {validation_metrics.get('eval_precision', 0.0):.4f}")
    print(f"Validation recall:    {validation_metrics.get('eval_recall', 0.0):.4f}")
    print(f"Validation F1:        {validation_metrics.get('eval_f1', 0.0):.4f}")
    print("Saved best model to:", best_dir)
    print("Saved run summary to:", output_dir / "training_summary.json")


if __name__ == "__main__":
    main()
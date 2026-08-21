from __future__ import annotations

import argparse
import json
import random
import re
from collections import Counter
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row


SEED = 1337


def entity(text: str, name: str) -> dict:
    start = text.index(name)
    return {"text": name, "label": "PERSON", "start": start, "end": start + len(name)}


def positive(text: str, names: list[str], category: str, group: str) -> dict:
    entities = [entity(text, name) for name in names]
    entities.sort(key=lambda item: item["start"])
    return {"text": text, "entities": entities, "category": category, "group": group}


def negative(text: str, category: str, group: str) -> dict:
    return {"text": text, "entities": [], "category": category, "group": group}


def name_pairs(first: list[str], last: list[str], count: int) -> list[str]:
    return [
        f"{first[index % len(first)]} "
        f"{last[(index * 7 + index // len(first) + 3) % len(last)]}"
        for index in range(count)
    ]


def two_context_rows(names: list[str], category: str, templates: list[str]) -> list[dict]:
    rows: list[dict] = []
    for index, name in enumerate(names):
        for variant in range(2):
            template = templates[(index * 2 + variant) % len(templates)]
            text = template.format(name=name)
            rows.append(positive(text, [name], category, f"v4:{category}:{index:03d}"))
    return rows


def build_additions() -> list[dict]:
    ordinary = name_pairs(
        ["Elena", "Caleb", "Priya", "Noah", "Camila", "Julian", "Maya", "Ethan", "Leila", "Owen",
         "Nadia", "Isaac", "Chloe", "Adrian", "Sofia", "Miles", "Talia", "Gavin", "Rina", "Derek",
         "Alicia", "Jonah", "Mei", "Theo", "Zara"],
        ["Bennett", "Navarro", "Shah", "Foster", "Kim", "Dalton", "Ramos", "Patel", "Brooks", "Nguyen",
         "Holland", "Reed", "Santos", "Coleman", "Park", "Murray", "Ortiz", "Bell", "Ibrahim", "Stewart",
         "Chung", "Walsh", "Diaz", "Clarke", "Nolan"],
        50,
    )
    boundary_templates = [
        "{name} approved the revised launch plan.",
        "Please route the final memo to {name}.",
        "The owner, {name}, signed the release checklist.",
        "After review, {name} requested one clarification.",
        "We recorded {name}'s approval in the audit log.",
        "The escalation belongs to {name}; notify operations.",
        "Participants included {name}, the regional lead.",
        "Before noon, ask {name} to confirm the figures.",
        "The note from {name}: deployment is authorized.",
        "Can {name} join the compliance review?",
    ]

    lowercase = [name.lower() for name in name_pairs(
        ["Ariana", "Brandon", "Celeste", "Damon", "Evelyn", "Felix", "Greta", "Hector", "Imani", "Jasper",
         "Keira", "Landon", "Mina", "Nolan", "Opal", "Paxton", "Quinn", "Rafael", "Selena", "Tristan",
         "Uma", "Vance", "Willa", "Xavier", "Yasmin"],
        ["Archer", "Bishop", "Cortez", "Dunham", "Ellis", "Farrell", "Gibson", "Hayes", "Irwin", "Jordan",
         "Keller", "Lawson", "Mercer", "Owens", "Pierce", "Quintero", "Russo", "Sawyer", "Tate", "Underwood",
         "Vega", "Webster", "Xu", "York", "Zamora"],
        50,
    )]
    lowercase_templates = [
        "email {name} about the supplier change.",
        "ask {name} to review the incident summary.",
        "{name} approved the access request.",
        "my manager {name} called after the meeting.",
        "send this revised schedule to {name}.",
        "please invite {name} to the risk workshop.",
        "the decision from {name} arrived this morning.",
        "follow up with {name} before the handoff.",
        "add {name} as the document reviewer.",
        "we are waiting for {name} to respond.",
    ]

    complex_names = [
        "Jean-Luc Bernard", "Anne-Marie Dubois", "Mary-Kate Sullivan", "Jo-Anne Mercer", "Luis-Miguel Santos",
        "Aisha-Rose Khan", "Marco-Antonio Ruiz", "Sarah-Jane O'Neill", "D'Arcy McKenna", "Niamh O'Brien",
        "Connor O'Donnell", "Shaun O'Rourke", "Tariq al-Hassan", "Fatima al-Nouri", "Layla al-Masri",
        "Omar bin Khalid", "Amina bint Rashid", "Nora van Dijk", "Pieter van den Berg", "Lotte van der Meer",
        "Hans von Braun", "Greta von der Leyen", "Lucia de la Cruz", "Mateo de Souza", "Isabel del Rio",
        "Rui da Costa", "Ana da Silva", "Joao dos Santos", "Marta di Lorenzo", "Carlo De Luca",
        "Noor El-Sayed", "Samir Al-Fayed", "Maya Ben-Ari", "David Ben-Gurion", "Lea Bat-El",
        "Chloe Saint-Pierre", "Luc Moreau-Lefevre", "Marie-Claire D'Amico", "Jean-Baptiste Le Roux", "Amir ibn Salim",
        "Zara bint al-Rashid", "Miguel Angel de la Vega", "Ana Maria del Toro", "Luis Felipe da Rocha", "Sofia van der Laan",
        "Iris von Hohenberg", "Mara O'Connor-Smith", "Lina al-Zahra", "Paulo de Almeida", "Ines d'Avila",
    ]
    complex_templates = [
        "Please ask {name} to approve the vendor exception.",
        "{name} owns the follow-up for this account.",
        "The compliance memo was signed by {name}.",
        "Add {name} to tomorrow's incident call.",
        "We need {name}'s response before releasing funds.",
        "Forward the customer summary to {name}.",
        "At the review, {name} challenged the estimate.",
        "The final decision rests with {name}.",
        "Notify {name}; the control test has completed.",
        "Our new regional contact is {name}.",
    ]

    unicode_names = [
        "Soren Andersen", "Søren Mikkelsen", "Åsa Lindström", "Björn Östberg", "Frédéric Lemaître",
        "Élodie Gagné", "Zoë Vermeulen", "Maëlle Noël", "Łukasz Kowalski", "Agnieszka Żukowska",
        "Michał Wiśniewski", "Zofia Wójcik", "İpek Demirtaş", "Çağla Şahin", "Gökçe Yıldız",
        "Ömer Çelik", "João Gonçalves", "Inês Conceição", "Márcio Araújo", "Lúcia Mendonça",
        "Márton Székely", "Ágnes Tóth", "Jiří Dvořák", "Šárka Novotná", "Tomaž Kovačič",
        "Živa Potočnik", "Ștefan Ionescu", "Ioana Munteanu", "Дмитрий Кузнецов", "Елена Смирнова",
        "Алексей Волков", "Наталья Орлова", "Олена Шевченко", "Андрій Бондаренко", "Марія Ковальчук",
        "Иван Петров", "李明", "王芳", "张伟", "陈静",
        "刘洋", "赵磊", "黄敏", "周杰", "吴婷",
        "佐藤 美咲", "鈴木 健太", "高橋 葵", "田中 翔太", "伊藤 結衣",
        "김민준", "이서연", "박지훈", "최유진", "정현우",
        "Nguyễn Minh Anh", "Trần Quốc Bảo", "Phạm Thu Hà", "Đặng Hoàng Nam", "Lê Ngọc Mai",
        "José Ángel Núñez", "María José Muñoz", "Óscar Ibáñez", "Renée Çetin", "Błażej Erdoğan",
        "Anaïs Björk", "Dvořák Yılmaz", "Sławomir Ødegård", "Mélanie Šimůnek", "İlhan Živković",
        "Кирилл Åström", "Оксана Nowak", "李小龙", "山田 太郎", "한지민",
    ]
    unicode_templates = [
        "Please send the audit packet to {name}.",
        "{name} confirmed the revised delivery date.",
        "The project owner is {name}.",
        "Ask {name} to join the customer call.",
        "We received {name}'s written approval.",
        "The escalation was assigned to {name}.",
        "Add {name} as a reviewer on the proposal.",
        "Before launch, notify {name} about the change.",
        "Our finance contact, {name}, replied today.",
        "The status update from {name} is complete.",
    ]

    rows = []
    rows.extend(two_context_rows(ordinary, "full_name_boundary", boundary_templates))
    rows.extend(two_context_rows(lowercase, "lowercase_workplace", lowercase_templates))
    rows.extend(two_context_rows(complex_names, "hyphen_particle", complex_templates))
    rows.extend(two_context_rows(unicode_names, "unicode_multilingual", unicode_templates))

    negative_subjects = [
        "The Jordan office", "The Madison project", "The Austin branch", "The May report", "The August forecast",
        "Monday Planning", "Johnson Electric", "Brooks Automation", "Parker Hannifin", "Taylor Devices",
        "Cooper Standard", "Martin Marietta", "Lincoln Electric", "Franklin Resources", "Henry Schein",
        "Ralph Lauren", "Morgan Advanced Materials", "Goldman Sachs", "General Dynamics", "Charles River Labs",
        "Customer Success", "People Operations", "Human Resources", "Platform Engineering", "Revenue Operations",
        "Project Atlas", "Project Phoenix", "Operation Sunrise", "Team Orion", "North Star Program",
        "React State", "Java Spring", "Python Requests", "Rust Ownership", "Docker Compose",
        "Amazon Bedrock", "Google Gemini", "Microsoft Azure", "Apple Intelligence", "Claude Desktop",
        "Sydney office", "Paris region", "Victoria station", "Charlotte market", "Jackson district",
        "April release", "June sprint", "Friday deployment", "Summer campaign", "Autumn roadmap",
    ]
    negative_templates = [
        "{subject} submitted its quarterly update.",
        "We reviewed {subject} during the governance meeting.",
    ]
    for index, subject in enumerate(negative_subjects):
        for variant, template in enumerate(negative_templates):
            rows.append(negative(template.format(subject=subject), "hard_negative", f"v4:hard_negative:{index:03d}:{variant}"))

    if len(rows) != 550:
        raise RuntimeError(f"Expected 550 additions, got {len(rows)}")
    return rows


def clean(row: dict) -> dict:
    result = dict(row)
    result.pop("__line__", None)
    return result


def normalized_sentence(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().casefold())


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build targeted Accord PERSON v4 additions and master dataset.")
    parser.add_argument("--base", type=Path, default=Path("data/raw/accord_person_v3.jsonl"))
    parser.add_argument("--benchmark", type=Path, default=Path("data/challenge/accord_person_browser_benchmark_v1.jsonl"))
    parser.add_argument("--additions", type=Path, default=Path("data/raw/accord_person_v4_additions.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("data/raw/accord_person_v4.jsonl"))
    args = parser.parse_args()

    random.seed(SEED)
    additions = build_additions()
    for row in additions:
        normalized = normalize_row(dict(row))
        if normalized["entities"] != row["entities"]:
            raise RuntimeError(f"Offset normalization changed row: {row['text']!r}")

    sentences = [normalized_sentence(row["text"]) for row in additions]
    duplicates = len(sentences) - len(set(sentences))
    if duplicates:
        raise RuntimeError(f"Generated {duplicates} duplicate addition sentences")

    base = [clean(row) for row in load_jsonl(args.base)]
    benchmark = [clean(row) for row in load_jsonl(args.benchmark)]
    base_sentences = {normalized_sentence(row["text"]) for row in base}
    benchmark_sentences = {normalized_sentence(row["text"]) for row in benchmark}
    base_overlap = sum(sentence in base_sentences for sentence in sentences)
    benchmark_overlap = sum(sentence in benchmark_sentences for sentence in sentences)
    if benchmark_overlap:
        raise RuntimeError("Browser benchmark exact sentence overlap must be zero")

    master = base + additions
    master_sentences = [normalized_sentence(row["text"]) for row in master]
    master_duplicates = len(master_sentences) - len(set(master_sentences))
    if master_duplicates:
        raise RuntimeError(f"v4 master contains {master_duplicates} duplicate sentences")

    write_jsonl(args.additions, additions)
    write_jsonl(args.output, master)

    category_counts = Counter(row["category"] for row in additions)
    positive_rows = sum(bool(row["entities"]) for row in additions)
    span_count = sum(len(row["entities"]) for row in additions)
    print("Accord PERSON v4 dataset built")
    print("==============================")
    print(f"Seed: {SEED}")
    print(f"Addition rows: {len(additions)}")
    print(f"Positive rows: {positive_rows}")
    print(f"Negative rows: {len(additions) - positive_rows}")
    print(f"PERSON spans: {span_count}")
    print(f"Categories: {dict(sorted(category_counts.items()))}")
    print(f"Duplicate addition sentences: {duplicates}")
    print(f"Exact sentence overlap with v3: {base_overlap}")
    print(f"Exact sentence overlap with browser benchmark: {benchmark_overlap}")
    print(f"Master rows: {len(master)}")
    print(f"Master duplicate sentences: {master_duplicates}")
    print(f"Additions: {args.additions}")
    print(f"Master: {args.output}")


if __name__ == "__main__":
    main()

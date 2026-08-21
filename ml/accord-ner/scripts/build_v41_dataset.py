from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from dataset_utils import load_jsonl, normalize_row


SEED = 1337
FORBIDDEN_IDENTITIES = {
    "Avery Morgan",
    "trevor mills",
    "kiara james",
    "bruce young",
    "Søren Nielsen",
    "Дмитрий Иванов",
    "Олена Коваль",
    "김민준",
    "佐藤 美咲",
}


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


def entity(text: str, name: str) -> dict:
    if text.count(name) != 1:
        raise RuntimeError(f"Expected one occurrence of {name!r} in {text!r}")
    start = text.index(name)
    return {
        "text": name,
        "label": "PERSON",
        "start": start,
        "end": start + len(name),
    }


def positive(text: str, name: str, category: str, group: str) -> dict:
    return {
        "text": text,
        "entities": [entity(text, name)],
        "category": category,
        "group": group,
    }


def negative(text: str, category: str, group: str) -> dict:
    return {"text": text, "entities": [], "category": category, "group": group}


def paired_rows(
    names: list[str],
    category: str,
    templates: list[str],
    prefix: str,
) -> list[dict]:
    rows: list[dict] = []
    for index, name in enumerate(names):
        group = f"v41:{prefix}:{index:03d}"
        for variant in range(2):
            template = templates[(index * 2 + variant) % len(templates)]
            rows.append(positive(template.format(name=name), name, category, group))
    return rows


def build_lowercase_rows() -> list[dict]:
    names = [
        "alec winterbourne",
        "marisol hendricks",
        "theodore blackwell",
        "nia fitzpatrick",
        "leonard ashcroft",
        "zoe pemberton",
        "darius whitcombe",
        "elena ravenscroft",
        "lucas featherstone",
        "liam carrington",
        "genevieve hollingsworth",
        "maximilian webb",
        "ava christopherson",
        "sebastian knox",
        "mia worthington",
        "benjamin cross",
        "ivy montgomery",
        "christopher vale",
        "ada kensington",
        "dominic rowe",
        "isabella thornfield",
        "eli barrington",
        "alexandra voss",
        "ian chadwick",
        "cassandra penrose",
        "leo fairchild",
        "valentina stroud",
        "samuel weatherford",
        "eve callaghan",
        "nathaniel price",
        "lila mackenzie",
        "gabriel shackleford",
        "amy hollister",
        "jeremiah crane",
        "noa wainwright",
    ]
    templates = [
        "email {name} the approved deployment schedule.",
        "ask {name} to close the compliance ticket.",
        "{name} finalized the quarterly access review.",
        "please notify {name} before the release begins.",
        "the response from {name} arrived this morning.",
        "review {name}'s notes before approving the exception.",
        "our assigned reviewer, {name}, requested another test.",
        "send the revised control summary to {name}.",
        "when {name} replies, archive the approval record.",
        "the owner is {name}; operations should follow up.",
        "add {name} as the final document approver.",
        "before noon, remind {name} about the handoff.",
    ]
    rows = paired_rows(
        names,
        "lowercase_surname_continuation",
        templates,
        "lowercase",
    )
    if len(rows) != 70:
        raise RuntimeError(f"Expected 70 lowercase rows, got {len(rows)}")
    return rows


def build_cyrillic_rows() -> list[dict]:
    names = [
        "Александр Соколов",
        "Ирина Морозова",
        "Сергей Лебедев",
        "Татьяна Новикова",
        "Николай Фёдоров",
        "Анна Белова",
        "Павел Тарасов",
        "Марина Громова",
        "Виктория Власова",
        "Роман Киселёв",
        "Александр Петрович Егоров",
        "Ирина Сергеевна Павлова",
        "Ірина Мельник",
        "Андрій Ткаченко",
        "Катерина Савченко",
        "Микола Романюк",
        "Юлія Лисенко",
        "Олексій Кравченко",
        "Наталія Поліщук",
        "Богдан Марченко",
        "Оксана Вікторівна Руденко",
        "Аляксей Каваленка",
        "Вольга Жураўлёва",
        "Георги Димитров",
        "Екатерина Николова",
    ]
    english_templates = [
        "{name} approved the revised control plan.",
        "Please send the audit evidence to {name}.",
        "The reviewer, {name}, closed the access finding.",
        "After the meeting, {name} confirmed the deadline.",
        "We recorded {name}'s decision in the register.",
        "The exception was assigned to {name}; notify compliance.",
    ]
    native_templates = [
        "{name} підтвердив отримання звіту.",
        "{name} завершила перевірку доступу.",
        "Будь ласка, надішліть документ для {name}.",
        "{name} утвердил итоговый план проверки.",
        "После встречи {name} подтвердил срок.",
        "Отчёт для {name} был отправлен сегодня.",
    ]
    rows: list[dict] = []
    for index, name in enumerate(names):
        group = f"v41:cyrillic:{index:03d}"
        english = english_templates[index % len(english_templates)]
        native = native_templates[(index * 3 + 1) % len(native_templates)]
        rows.append(
            positive(
                english.format(name=name),
                name,
                "cyrillic_exact_termination",
                group,
            )
        )
        rows.append(
            positive(
                native.format(name=name),
                name,
                "cyrillic_exact_termination",
                group,
            )
        )
    if len(rows) != 50:
        raise RuntimeError(f"Expected 50 Cyrillic rows, got {len(rows)}")
    return rows


def build_korean_rows() -> list[dict]:
    names = [
        "박서준",
        "이지우",
        "최민서",
        "정서윤",
        "강도윤",
        "윤하은",
        "장예준",
        "임수아",
        "한시우",
        "오지호",
        "서예린",
        "신준호",
        "권채원",
        "황서진",
        "안유나",
        "송현준",
        "전다은",
        "홍민재",
        "고서현",
        "문준영",
    ]
    templates = [
        "{name} approved the supplier exception.",
        "Please route the security report to {name}.",
        "The assigned reviewer is {name}.",
        "Before launch, ask {name} to confirm the controls.",
        "We received written approval from {name}.",
        "Add {name} to the incident response meeting.",
        "The final update from {name} arrived today.",
        "Compliance recorded {name}'s decision.",
    ]
    rows = paired_rows(names, "korean_person", templates, "korean")
    if len(rows) != 40:
        raise RuntimeError(f"Expected 40 Korean rows, got {len(rows)}")
    return rows


def build_japanese_rows() -> list[dict]:
    names = [
        "中村 颯太",
        "小林 陽菜",
        "加藤 大輝",
        "吉田 七海",
        "山本 蓮",
        "松本 美月",
        "井上 悠真",
        "木村 彩花",
        "林 拓海",
        "清水 結菜",
        "斎藤 大和",
        "山口 莉子",
        "森 健吾",
        "池田 愛",
        "橋本 直樹",
        "阿部 香織",
        "石川 翼",
        "前田 凛",
    ]
    templates = [
        "{name} approved the revised privacy review.",
        "Please send the release checklist to {name}.",
        "The project reviewer, {name}, requested one change.",
        "Before the handoff, notify {name} about the result.",
        "We documented {name}'s approval in the audit record.",
        "The control owner is {name}.",
    ]
    rows: list[dict] = []
    for index, spaced_name in enumerate(names):
        group = f"v41:japanese:{index:03d}"
        unspaced_name = spaced_name.replace(" ", "")
        rows.append(
            positive(
                templates[(index * 2) % len(templates)].format(name=spaced_name),
                spaced_name,
                "japanese_person",
                group,
            )
        )
        if index < 17:
            rows.append(
                positive(
                    templates[(index * 2 + 1) % len(templates)].format(
                        name=unspaced_name
                    ),
                    unspaced_name,
                    "japanese_person",
                    group,
                )
            )
    if len(rows) != 35:
        raise RuntimeError(f"Expected 35 Japanese rows, got {len(rows)}")
    return rows


def build_unicode_latin_rows() -> list[dict]:
    names = [
        "Morten Østergaard",
        "Łucja Jabłońska",
        "İlker Işık",
        "Rıza Kılıç",
        "Åsmund Håkonsson",
        "Þóra Björnsdóttir",
        "João Pêgo",
        "Małgorzata Brzęczyszczykiewicz",
        "Çiğdem Öztürk",
        "Øyvind Løkke",
        "François L'Écuyer",
        "Luís Gonçalves",
        "José Araújo",
    ]
    templates = [
        "{name} completed the regional risk assessment.",
        "Please share the evidence package with {name}.",
        "The approval from {name} was recorded today.",
        "Ask {name} to review the revised access matrix.",
        "Our compliance contact, {name}, confirmed the change.",
        "The document signed by {name} is now archived.",
    ]
    rows: list[dict] = []
    for index, name in enumerate(names):
        group = f"v41:unicode-latin:{index:03d}"
        variants = 1 if index == len(names) - 1 else 2
        for variant in range(variants):
            template = templates[(index * 2 + variant) % len(templates)]
            rows.append(
                positive(
                    template.format(name=name),
                    name,
                    "unicode_latin_continuity",
                    group,
                )
            )
    if len(rows) != 25:
        raise RuntimeError(f"Expected 25 Unicode Latin rows, got {len(rows)}")
    return rows


def build_multilingual_negative_rows() -> list[dict]:
    texts = [
        "Московский офис завершил внутренний аудит.",
        "Компания Северный Вектор обновила политику доступа.",
        "Київський регіон опублікував план відновлення.",
        "Проєкт Дніпро перейшов до наступного етапу.",
        "Софийският офис приключи проверката.",
        "서울 지사가 보안 검토를 완료했습니다.",
        "네이버 클라우드 정책이 오늘 변경되었습니다.",
        "부산 지역은 새 운영 계획을 발표했습니다.",
        "한강 프로젝트가 다음 단계로 이동했습니다.",
        "삼성 리서치 플랫폼은 내부 도구입니다.",
        "東京支社は監査計画を更新しました。",
        "京都地域の運用レビューが完了しました。",
        "ソニーグループは新しい方針を公開しました。",
        "トヨタ研究所の報告書を確認しました。",
        "富士プロジェクトは来月開始します。",
        "The Łódź office completed its controls review.",
        "The İstanbul branch published a revised schedule.",
        "The Øresund region updated its operating plan.",
        "São Paulo Operations owns the quarterly report.",
        "Møller Mobility released its annual statement.",
    ]
    rows = [
        negative(
            text,
            "multilingual_hard_negative",
            f"v41:multilingual-negative:{index:03d}",
        )
        for index, text in enumerate(texts)
    ]
    if len(rows) != 20:
        raise RuntimeError(f"Expected 20 multilingual negatives, got {len(rows)}")
    return rows


def build_additions() -> list[dict]:
    rows = [
        *build_lowercase_rows(),
        *build_cyrillic_rows(),
        *build_korean_rows(),
        *build_japanese_rows(),
        *build_unicode_latin_rows(),
        *build_multilingual_negative_rows(),
    ]
    if len(rows) != 240:
        raise RuntimeError(f"Expected 240 additions, got {len(rows)}")
    return rows


def clean(row: dict) -> dict:
    result = dict(row)
    result.pop("__line__", None)
    return result


def read_reference_rows(paths: list[Path]) -> list[dict]:
    rows: list[dict] = []
    for path in paths:
        if path.exists():
            rows.extend(clean(row) for row in load_jsonl(path))
    return rows


def person_identities(rows: list[dict]) -> set[str]:
    return {
        norm(entity["text"])
        for row in rows
        for entity in row.get("entities", [])
    }


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build targeted Accord PERSON v4.1 additions and master dataset."
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=Path("data/raw/accord_person_v4.jsonl"),
    )
    parser.add_argument(
        "--additions",
        type=Path,
        default=Path("data/raw/accord_person_v41_additions.jsonl"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/accord_person_v41.jsonl"),
    )
    parser.add_argument(
        "--challenge-dir",
        type=Path,
        default=Path("data/challenge"),
    )
    parser.add_argument(
        "--test-dir",
        type=Path,
        default=Path("data/test"),
    )
    args = parser.parse_args()

    additions = build_additions()
    for row in additions:
        normalized = normalize_row(dict(row))
        if normalized["entities"] != row["entities"]:
            raise RuntimeError(f"Offset normalization changed row: {row['text']!r}")

    addition_sentences = [norm(row["text"]) for row in additions]
    duplicate_additions = len(addition_sentences) - len(set(addition_sentences))
    if duplicate_additions:
        raise RuntimeError(f"Generated {duplicate_additions} duplicate sentences")

    base = [clean(row) for row in load_jsonl(args.base)]
    # Exclude the generated v4.1 test split so this builder remains rerunnable
    # after split creation. All pre-existing frozen/challenge sets stay in the
    # overlap audit.
    reference_paths = sorted(args.challenge_dir.glob("*.jsonl")) + [
        path
        for path in sorted(args.test_dir.glob("*.jsonl"))
        if not path.name.startswith("accord_person_v41.")
    ]
    references = read_reference_rows(reference_paths)

    base_sentences = {norm(row["text"]) for row in base}
    reference_sentences = {norm(row["text"]) for row in references}
    base_overlap = sum(sentence in base_sentences for sentence in addition_sentences)
    reference_overlap = sum(
        sentence in reference_sentences for sentence in addition_sentences
    )
    if base_overlap or reference_overlap:
        raise RuntimeError(
            "v4.1 additions must not overlap existing v4 or test/challenge sentences"
        )

    forbidden = {norm(name) for name in FORBIDDEN_IDENTITIES}
    addition_identities = person_identities(additions)
    forbidden_overlap = sorted(addition_identities & forbidden)
    if forbidden_overlap:
        raise RuntimeError(f"Forbidden frozen identities found: {forbidden_overlap}")

    base_identities = person_identities(base)
    reference_identities = person_identities(references)
    identity_overlap = addition_identities & base_identities
    reference_identity_overlap = addition_identities & reference_identities

    master = base + additions
    master_sentences = [norm(row["text"]) for row in master]
    duplicate_master = len(master_sentences) - len(set(master_sentences))
    if duplicate_master:
        raise RuntimeError(f"v4.1 master has {duplicate_master} duplicate sentences")

    write_jsonl(args.additions, additions)
    write_jsonl(args.output, master)

    categories = Counter(row["category"] for row in additions)
    positive_rows = sum(bool(row["entities"]) for row in additions)
    span_count = sum(len(row["entities"]) for row in additions)

    print("Accord PERSON v4.1 dataset built")
    print("================================")
    print(f"Seed: {SEED}")
    print(f"Addition rows: {len(additions)}")
    print(f"Positive rows: {positive_rows}")
    print(f"Negative rows: {len(additions) - positive_rows}")
    print(f"PERSON spans: {span_count}")
    print(f"Categories: {dict(sorted(categories.items()))}")
    print(f"Duplicate addition sentences: {duplicate_additions}")
    print(f"Exact sentence overlap with v4: {base_overlap}")
    print(f"Exact sentence overlap with test/challenge files: {reference_overlap}")
    print(f"Forbidden frozen identity overlap: {len(forbidden_overlap)}")
    print(
        "Normalized PERSON identity overlap with v4: "
        f"{len(identity_overlap)}/{len(addition_identities)}"
    )
    print(
        "Normalized PERSON identity overlap with pre-existing test/challenge files: "
        f"{len(reference_identity_overlap)}/{len(addition_identities)}"
    )
    print(f"Master rows: {len(master)}")
    print(f"Master positive rows: {sum(bool(row['entities']) for row in master)}")
    print(f"Master negative rows: {sum(not row['entities'] for row in master)}")
    print(f"Master PERSON spans: {sum(len(row['entities']) for row in master)}")
    print(f"Master duplicate sentences: {duplicate_master}")
    print(f"Additions: {args.additions}")
    print(f"Master: {args.output}")


if __name__ == "__main__":
    main()

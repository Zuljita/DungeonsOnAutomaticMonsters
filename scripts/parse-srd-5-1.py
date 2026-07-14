# SPDX-License-Identifier: MIT

import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("parse-srd-5-1.py requires pdfplumber. Install it or run with the Codex bundled Python runtime.", file=sys.stderr)
    raise


ROOT = Path.cwd()
MANIFEST_PATH = ROOT / "sources" / "srd-5-1" / "manifest.json"
PDF_PATH = ROOT / "data" / "srd-5-1" / "raw" / "SRD_CC_v5.1.pdf"
OUTPUT_PATH = ROOT / "data" / "srd-5-1" / "parsed" / "monsters.json"
FIRST_MONSTER_PAGE = 261

SIZE_TYPE_RE = re.compile(
    r"^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+),\s+(.+)$"
)
ABILITY_HEADER_RE = re.compile(r"^STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA$")
ABILITY_VALUES_RE = re.compile(
    r"^(\d+)\s+\(([+-]?\d+)\)\s+"
    r"(\d+)\s+\(([+-]?\d+)\)\s+"
    r"(\d+)\s+\(([+-]?\d+)\)\s+"
    r"(\d+)\s+\(([+-]?\d+)\)\s+"
    r"(\d+)\s+\(([+-]?\d+)\)\s+"
    r"(\d+)\s+\(([+-]?\d+)\)$"
)
FIELD_RE = re.compile(
    r"^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Vulnerabilities|"
    r"Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|"
    r"Challenge|Proficiency Bonus)\s+(.+)$"
)

SECTION_HEADINGS = {
    "Actions",
    "Reactions",
    "Legendary Actions",
    "Lair Actions",
    "Regional Effects",
    "Bonus Actions",
}
STOP_PREFIXES = (
    "Appendix PH-",
    "Appendix MM-",
    "Chapter ",
    "Legal Information",
)


def slugify(value):
    value = value.lower().replace("'", "")
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def normalize_text(value):
    return (
        value.replace("\u2212", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\uf0b3", "")
        .replace("\uf0a7", "")
    )


def page_column_lines(page):
    words = page.extract_words(
        x_tolerance=1,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    if not words:
        return []

    gutter = page.width / 2
    columns = [
        [word for word in words if word["x0"] < gutter],
        [word for word in words if word["x0"] >= gutter],
    ]

    output = []
    for column in columns:
        column = [
            word
            for word in column
            if word["top"] > 35
            and word["bottom"] < page.height - 30
            and word["text"] != "System"
        ]
        column.sort(key=lambda word: (round(word["top"] / 3) * 3, word["x0"]))

        grouped = []
        for word in column:
            top_bucket = round(word["top"] / 3) * 3
            if not grouped or grouped[-1]["top"] != top_bucket:
                grouped.append({"top": top_bucket, "words": [word]})
            else:
                grouped[-1]["words"].append(word)

        for line in grouped:
            line["words"].sort(key=lambda word: word["x0"])
            text = normalize_text(" ".join(word["text"] for word in line["words"])).strip()
            if text and text != "Reference Document 5.1":
                output.append(text)

    return output


def page_lines(pdf):
    for page_index, page in enumerate(pdf.pages):
        yield page_index + 1, page_column_lines(page)


def is_statblock_start(lines, index):
    if index == 0:
        return False
    if not SIZE_TYPE_RE.match(lines[index]):
        return False

    previous = lines[index - 1]
    if len(previous) < 2 or previous.startswith("System Reference Document"):
        return False

    lookahead = lines[index + 1 : index + 8]
    return any(line.startswith("Armor Class ") for line in lookahead) and any(
        line.startswith("Hit Points ") for line in lookahead
    )


def collect_blocks(pdf):
    starts = []
    pages = list(page_lines(pdf))

    flat = []
    for page_number, lines in pages:
        for line in lines:
            flat.append({"page": page_number, "text": line})

    for index in range(1, len(flat)):
        local_lines = [entry["text"] for entry in flat[max(0, index - 1) : min(len(flat), index + 8)]]
        if len(local_lines) >= 2 and is_statblock_start(local_lines, 1):
            starts.append(index - 1)

    blocks = []
    for start_number, start in enumerate(starts):
        end = starts[start_number + 1] if start_number + 1 < len(starts) else len(flat)
        block_entries = flat[start:end]
        for offset, entry in enumerate(block_entries[2:], start=2):
            if entry["text"].startswith(STOP_PREFIXES):
                block_entries = block_entries[:offset]
                break
        blocks.append(
            {
                "page": block_entries[0]["page"],
                "lines": [entry["text"] for entry in block_entries],
            }
        )

    return blocks


def parse_ability_scores(lines):
    for index, line in enumerate(lines):
        if ABILITY_HEADER_RE.match(line) and index + 1 < len(lines):
            values = ABILITY_VALUES_RE.match(lines[index + 1])
            if not values:
                return None

            parts = values.groups()
            names = ["str", "dex", "con", "int", "wis", "cha"]
            return {
                name: {"score": int(parts[offset * 2]), "modifier": int(parts[offset * 2 + 1])}
                for offset, name in enumerate(names)
            }

    return None


def parse_sections(lines):
    sections = []
    current = {"heading": "Traits", "text": []}

    for line in lines:
        if line in SECTION_HEADINGS:
            if current["text"]:
                sections.append({"heading": current["heading"], "text": "\n".join(current["text"]).strip()})
            current = {"heading": line, "text": []}
            continue

        current["text"].append(line)

    if current["text"]:
        sections.append({"heading": current["heading"], "text": "\n".join(current["text"]).strip()})

    return sections


def parse_block(block):
    lines = block["lines"]
    name = lines[0]
    size_match = SIZE_TYPE_RE.match(lines[1])
    size, creature_type, alignment = size_match.groups()

    fields = {}
    for line in lines[2:]:
        match = FIELD_RE.match(line)
        if match:
            key = match.group(1)
            value = match.group(2)
            fields[key] = value

    ability_scores = parse_ability_scores(lines)
    first_section_index = next(
        (
            index
            for index, line in enumerate(lines)
            if line in SECTION_HEADINGS
        ),
        None,
    )
    section_source = lines[first_section_index:] if first_section_index is not None else []

    return {
        "id": f"srd_5_1_{slugify(name)}",
        "name": name,
        "sourcePage": block["page"],
        "sourceSection": source_section(block["page"]),
        "size": size,
        "type": creature_type,
        "alignment": alignment,
        "armorClass": fields.get("Armor Class"),
        "hitPoints": fields.get("Hit Points"),
        "speed": fields.get("Speed"),
        "abilityScores": ability_scores,
        "savingThrows": fields.get("Saving Throws"),
        "skills": fields.get("Skills"),
        "damageVulnerabilities": fields.get("Damage Vulnerabilities"),
        "damageResistances": fields.get("Damage Resistances"),
        "damageImmunities": fields.get("Damage Immunities"),
        "conditionImmunities": fields.get("Condition Immunities"),
        "senses": fields.get("Senses"),
        "languages": fields.get("Languages"),
        "challenge": fields.get("Challenge"),
        "proficiencyBonus": fields.get("Proficiency Bonus"),
        "sections": parse_sections(section_source),
        "rawText": "\n".join(lines).strip(),
    }


def source_section(page):
    if 395 <= page:
        return "nonplayer_characters"
    if 366 <= page:
        return "miscellaneous_creatures"
    return "monsters"


def dedupe_ids(monsters):
    counts = {}
    deduped = []
    for monster in monsters:
        monster_id = monster["id"]
        count = counts.get(monster_id, 0)
        counts[monster_id] = count + 1
        if count:
            monster = {**monster, "id": f"{monster_id}_{count + 1}"}
        deduped.append(monster)
    return deduped


def main():
    if not PDF_PATH.exists():
        print(f"Missing {PDF_PATH}. Run npm run fetch:srds first.", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    with pdfplumber.open(str(PDF_PATH)) as pdf:
        blocks = collect_blocks(pdf)
    monsters = dedupe_ids([
        parse_block(block)
        for block in blocks
        if block["page"] >= FIRST_MONSTER_PAGE
    ])

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(
            {
                "source": {
                    "id": manifest["id"],
                    "name": manifest["name"],
                    "sourceSystem": manifest["sourceSystem"],
                    "sourceLicense": manifest["sourceLicense"],
                    "contentLicense": manifest["contentLicense"],
                    "contentLicenseUrl": manifest["contentLicenseUrl"],
                    "sourceUrl": manifest["sourceUrl"],
                    "sourceCopyrightNotice": manifest["sourceCopyrightNotice"],
                },
                "parsedAt": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "parserVersion": "0.1.0",
                "sourceFile": str(PDF_PATH.relative_to(ROOT)).replace("\\", "/"),
                "monsterCount": len(monsters),
                "monsters": monsters,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Parsed {len(monsters)} SRD 5.1 monster records")
    print(str(OUTPUT_PATH.relative_to(ROOT)))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build GCS ancestry drafts, a DOA review package, and a conversion checklist."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

from build_gct import build
from gcs_library_match import (
    LibraryIndex,
    parse_library_argument,
    rebuild_skills,
    rebuild_traits,
)
from validate_gct import validate_file


SOURCE_ID = "enraged_eggplant_author_permission"
SOURCE_SYSTEM = "gurps_4e_fan_conversion"
SOURCE_LICENSE = "author_permission"
SOURCE_BOOK = "enraged_eggplant_monsters_2024_05_11"
SOURCE_URL = "https://github.com/Zuljita/DungeonsOnAutomaticMonsters/blob/main/licenses/ENRAGED-EGGPLANT-PERMISSION.md"
COPYRIGHT_NOTICE = (
    "Enraged Eggplant GURPS monster conversions; used, adapted, and republished "
    "with unrestricted permission from the author."
)
AUTHORIZATION = (
    "Enraged Eggplant granted unrestricted permission to use, adapt, convert, and publish these statistics."
)
CREDIT_LINE = (
    "Original GURPS conversion by Enraged Eggplant, from Monsters (May 11, 2024); "
    "adapted and republished with permission."
)


def originator_credit() -> dict[str, Any]:
    return {
        "name": "Enraged Eggplant",
        "role": "originator",
        "scope": ["gurps_conversion", "monster_mechanics"],
        "sourceTitle": "Monsters",
        "sourceVersion": "2024-05-11",
        "creditLine": CREDIT_LINE,
        "url": SOURCE_URL,
    }

HEADER_RE = re.compile(r"^## (.+?)\s*$", re.MULTILINE)
POINTS_RE = re.compile(
    r"^\*?([-+]?\d[\d,]*)(?:\s*[-–]\s*([-+]?\d[\d,]*))?\s+points?\*?\s*$",
    re.MULTILINE | re.IGNORECASE,
)
CATEGORY_RE = re.compile(r"^\*\*(.+?):\*\*\s*(.*)$")
PLAIN_CATEGORY_RE = re.compile(
    r"^(Attribute Modifiers|Secondary Characteristic(?:s)?(?: Modifiers)?|Advantages?|Disadvantages?|Perks?|Quirks?|Features?):\s*(.*)$",
    re.IGNORECASE,
)
ATTRIBUTE_RE = re.compile(
    r"^(ST|DX|IQ|HT|HP|FP|Will|Per|Basic Speed|Basic Move|SM)\s*([+-])\s*(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
NATIVE_ILLUMINATION_RE = re.compile(
    r"Night Vision\s+(\d+)\s+\(-\s*(\d+)\s+is the native illumination level\)",
    re.IGNORECASE,
)
ATTRIBUTE_IDS = {
    "st": "st",
    "dx": "dx",
    "iq": "iq",
    "ht": "ht",
    "hp": "hp",
    "fp": "fp",
    "will": "will",
    "per": "per",
    "basic speed": "basic_speed",
    "basic move": "basic_move",
    "sm": "sm",
}
DR_LOCATIONS = [
    "skull", "face", "neck", "torso", "vitals", "groin", "arm", "hand",
    "leg", "foot", "tail", "wing", "fin", "brain",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def selected_record_names(coverage: dict[str, Any], selection: str) -> set[str] | None:
    """Return normalized coverage names for the requested conversion set."""
    if selection == "all":
        return None
    key = "missing" if selection == "missing" else "covered"
    return {
        normalized_name(str(item["name"]))
        for item in coverage.get(key, [])
        if item.get("name")
    }


def normalized_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(re.findall(r"[a-z0-9]+", asciiish.lower()))


def slugify(value: str) -> str:
    return normalized_name(value).replace(" ", "-")


def heading_name(value: str) -> str:
    return re.sub(r"\s+\[[^\]]*\]\s*$", "", value).strip()


def split_sections(markdown: str) -> list[dict[str, str]]:
    matches = list(HEADER_RE.finditer(markdown))
    sections: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        sections.append(
            {
                "heading": match.group(1).strip(),
                "name": heading_name(match.group(1)),
                "text": markdown[match.end() : end].strip(),
            }
        )
    return sections


def find_section(record: dict[str, Any], sections: list[dict[str, str]]) -> dict[str, str] | None:
    heading = str(record.get("heading", "")).strip()
    exact = [section for section in sections if section["heading"] == heading]
    if len(exact) == 1:
        return exact[0]
    norm = normalized_name(str(record.get("doc_name") or record.get("name") or ""))
    by_name = [section for section in sections if normalized_name(section["name"]) == norm]
    return by_name[0] if len(by_name) == 1 else None


def split_top_level(value: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    for index, char in enumerate(value):
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1
        elif char == ";" and depth == 0:
            part = value[start:index].strip()
            if part:
                parts.append(part)
            start = index + 1
    final = value[start:].strip()
    if final:
        parts.append(final)
    return parts


def parse_cost_token(token: str) -> int | float | None:
    value = token.strip().replace(",", "")
    if "=" in value:
        value = value.rsplit("=", 1)[1].strip()
    if re.fullmatch(r"[-+]?\d+(?:\.\d+)?", value):
        number = float(value)
        return int(number) if number.is_integer() else number
    fraction = re.fullmatch(r"([-+]?\d+(?:\.\d+)?)/([1-9]\d*)", value)
    if fraction:
        number = float(fraction.group(1)) / float(fraction.group(2))
        rounded = math.floor(number + 0.5)
        return int(rounded)
    return None


def final_cost(value: str) -> tuple[int | float | None, str]:
    match = re.search(r"\[([^\]]+)\]\.?\s*$", value)
    if not match:
        return None, value.strip().rstrip(".")
    cost = parse_cost_token(match.group(1))
    cleaned = (value[: match.start()] + value[match.end() :]).strip().rstrip(".")
    return cost, cleaned


def trait_tags(category: str) -> list[str]:
    lower = category.lower()
    if "attribute" in lower or "characteristic" in lower:
        return ["Attribute", "Review Required"]
    if "disadvantage" in lower:
        return ["Disadvantage", "Review Required"]
    if "perk" in lower:
        return ["Perk", "Review Required"]
    if "quirk" in lower:
        return ["Quirk", "Review Required"]
    if "skill" in lower:
        return ["Skill", "Review Required"]
    if "feature" in lower:
        return ["Feature", "Review Required"]
    return ["Advantage", "Review Required"]


def display_name(source_text: str, category: str) -> str:
    match = ATTRIBUTE_RE.match(source_text)
    if match:
        amount = ("+" if match.group(2) == "+" else "-") + match.group(3)
        return f"{match.group(1)} {amount}"
    text = source_text.strip().lstrip("- ")
    text = re.sub(r"\s*\([^()]*(?:[+-]\d+%|Size Modifier|No Fine Manipulators)[^()]*\)\s*$", "", text)
    if len(text) > 110:
        text = text[:107].rstrip() + "..."
    return text or category


def make_trait(source_text: str, category: str, cost: int | float) -> dict[str, Any]:
    trait: dict[str, Any] = {
        "name": display_name(source_text, category),
        "points": cost,
        "tags": trait_tags(category),
        "source_text": source_text,
    }
    attribute = ATTRIBUTE_RE.match(source_text)
    features: list[dict[str, Any]] = []
    if attribute:
        amount = float(attribute.group(3)) * (1 if attribute.group(2) == "+" else -1)
        amount = int(amount) if amount.is_integer() else amount
        features.append(
            {
                "type": "attribute_bonus",
                "attribute": ATTRIBUTE_IDS[attribute.group(1).lower()],
                "amount": amount,
            }
        )
    dr_match = re.match(r"^DR\s+(\d+)", source_text, re.IGNORECASE)
    if dr_match:
        features.append(
            {
                "type": "dr_bonus",
                "locations": DR_LOCATIONS,
                "amount": int(dr_match.group(1)),
            }
        )
    if features:
        trait["features"] = features
    return trait


def ability_from_paragraph(paragraph: str) -> tuple[str, int | float] | None:
    text = " ".join(line.strip() for line in paragraph.splitlines()).strip()
    leading = re.match(r"^-?\s*(.+?)\s*\[([^\]]+)\]\s*:\s*", text)
    if leading:
        cost = parse_cost_token(leading.group(2))
        if cost is not None:
            return leading.group(1).strip(), cost
    cost, _ = final_cost(text)
    if cost is not None and ":" in text:
        return text.split(":", 1)[0].strip().lstrip("- "), cost
    return None


def parse_template(
    section_text: str,
    add_reconciliation: bool = True,
) -> tuple[int | float | None, list[dict[str, Any]], int | float, str]:
    points_match = POINTS_RE.search(section_text)
    expected: int | float | None = None
    if points_match:
        expected = int(points_match.group(1).replace(",", ""))
    template_text = re.split(r"^### Typical Stats.*$", section_text, maxsplit=1, flags=re.MULTILINE)[0].strip()
    native_illumination_levels = {
        int(level)
        for level, native_level in NATIVE_ILLUMINATION_RE.findall(section_text)
        if level == native_level
    }
    traits: list[dict[str, Any]] = []
    skip_alternative_children = False

    for paragraph in re.split(r"\n\s*\n", template_text):
        paragraph = paragraph.strip()
        if not paragraph or paragraph.startswith("*") and POINTS_RE.fullmatch(paragraph):
            continue
        if paragraph.startswith(">") or paragraph.startswith("#"):
            continue
        category_match = CATEGORY_RE.match(paragraph) or PLAIN_CATEGORY_RE.match(paragraph)
        if category_match:
            skip_alternative_children = False
            category = category_match.group(1).strip()
            if category.lower() in {"notes", "creature type"}:
                continue
            content = category_match.group(2).strip()
            for entry in split_top_level(content):
                cost, cleaned = final_cost(entry)
                if cost is None:
                    cost = 0
                if cleaned:
                    trait = make_trait(cleaned, category, cost)
                    night_vision = re.fullmatch(r"Night Vision\s+(\d+)", cleaned, re.IGNORECASE)
                    if (
                        cost == 0
                        and "feature" in category.lower()
                        and night_vision
                        and int(night_vision.group(1)) in native_illumination_levels
                    ):
                        level = int(night_vision.group(1))
                        trait.update(
                            {
                                "name": f"Feature: Night Adapted Vision (-{level})",
                                "reference": "DF3:16",
                                "tags": ["Feature", "Physical", "Review Required"],
                                "source_text": f"Feature: Night Adapted Vision (-{level})",
                                "notes": (
                                    f"Fan source wording: Night Vision {level} [0]. Typical Stats states "
                                    f"that -{level} is the native illumination level. Modeled as the "
                                    "zero-point shifted visual baseline from Dungeon Fantasy 3, not the "
                                    "priced Basic Set Night Vision advantage."
                                ),
                            }
                        )
                    traits.append(trait)
            continue

        ability = ability_from_paragraph(paragraph)
        if ability and not skip_alternative_children:
            name, cost = ability
            traits.append(make_trait(paragraph, "Ability", cost))
            traits[-1]["name"] = name[:110]
            if "alternative abilities" in name.lower() and paragraph.rstrip().endswith(":"):
                skip_alternative_children = True

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, int | float, str]] = set()
    for trait in traits:
        key = (trait["name"], trait["points"], trait.get("source_text", ""))
        if key not in seen:
            seen.add(key)
            deduped.append(trait)

    parsed_total = sum(trait["points"] for trait in deduped)
    reconciliation: int | float = 0
    if expected is not None:
        reconciliation = expected - parsed_total
        if reconciliation != 0 and add_reconciliation:
            deduped.append(
                {
                    "name": "Point reconciliation (unparsed source construction)",
                    "points": reconciliation,
                    "tags": ["Review Required", "Source Reconciliation"],
                    "source_text": (
                        f"Automated children total {parsed_total}; source template total {expected}. "
                        "Replace this adjustment after resolving grouped abilities, replacements, and unusual cost notation."
                    ),
                }
            )
    return expected, deduped, reconciliation, template_text


def first_number(value: str) -> int | float | None:
    if not value or re.search(r"\bN/?A\b", value, re.IGNORECASE):
        return None
    match = re.search(r"[-+]?\d+(?:\.\d+)?", value)
    if not match:
        return None
    number = float(match.group(0))
    return int(number) if number.is_integer() else number


def typical_block(section_text: str) -> str:
    match = re.search(r"^### Typical Stats(?:\s*[-–].*)?\s*$", section_text, re.MULTILINE)
    if not match:
        return ""
    remainder = section_text[match.end() :]
    next_subheading = re.search(r"^### ", remainder, re.MULTILINE)
    return remainder[: next_subheading.start()].strip() if next_subheading else remainder.strip()


def parse_labeled_list(block: str, label_pattern: str) -> list[str]:
    match = re.search(rf"^\*\*(?:{label_pattern}):\*\*\s*(.+)$", block, re.MULTILINE | re.IGNORECASE)
    if not match:
        return []
    return [part.strip().rstrip(".") for part in split_top_level(match.group(1)) if part.strip()]


def parse_typical_stats(section_text: str) -> dict[str, Any]:
    block = typical_block(section_text)
    fields: dict[str, str] = {}
    for line in block.splitlines():
        if not line.strip().startswith("|") or re.match(r"^\|?\s*[-:]+", line.strip()):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        for index in range(0, len(cells) - 1, 2):
            key = cells[index].rstrip(":").strip()
            value = cells[index + 1].strip()
            if key and key.lower() != "field":
                fields[key.lower()] = value

    attr_map = {
        "st": "st", "dx": "dx", "iq": "iq", "ht": "ht", "hp": "hp",
        "will": "will", "per": "per", "fp": "fp", "speed": "speed",
        "move": "move", "dodge": "dodge", "dr": "dr",
    }
    attributes = {target: first_number(fields.get(source, "")) for source, target in attr_map.items()}

    attacks: list[dict[str, Any]] = []
    for paragraph in re.split(r"\n\s*\n", block):
        text = " ".join(line.strip() for line in paragraph.splitlines()).strip()
        match = re.match(r"^(.+?)\s+\((\d+)\):\s*(.+)$", text)
        if not match:
            continue
        remainder = match.group(3)
        reach_match = re.search(r"\bReach\s+([^.;]+)", remainder, re.IGNORECASE)
        damage = re.split(r"[,.]\s*Reach\b", remainder, maxsplit=1, flags=re.IGNORECASE)[0].strip().rstrip(".")
        attacks.append(
            {
                "name": match.group(1).strip(),
                "skill": int(match.group(2)),
                "damage": damage or None,
                "reach": reach_match.group(1).strip() if reach_match else None,
                "notes": text,
            }
        )

    traits = parse_labeled_list(block, r"Traits")
    skills: list[dict[str, Any]] = []
    for label in (r"Skills", r"Psionic Skills", r"Racial Skills"):
        for entry in parse_labeled_list(block, label):
            match = re.match(r"^(.+?)-(\d+)$", entry)
            if match:
                skills.append({"name": match.group(1).strip(), "level": int(match.group(2))})

    return {
        "block": block,
        "fields": fields,
        "attributes": attributes,
        "attacks": attacks,
        "traits": traits,
        "skills": skills,
    }


def damage_profile(value: str | None) -> tuple[int | None, int, float]:
    if not value:
        return None, 0, 1.0
    match = re.search(r"(\d+)\s*d\s*([+-]\s*\d+)?", value, re.IGNORECASE)
    dice = int(match.group(1)) if match else None
    modifier = int(match.group(2).replace(" ", "")) if match and match.group(2) else 0
    lower = value.lower()
    multiplier = 2.0 if re.search(r"\bimp|impaling|huge piercing|corrosion|fatigue", lower) else 1.5 if re.search(r"cutting|large piercing", lower) else 0.5 if re.search(r"small piercing", lower) else 1.0
    return dice, modifier, multiplier


def compute_effectiveness(stats: dict[str, Any]) -> dict[str, Any]:
    attrs = stats["attributes"]
    best_attack: dict[str, Any] | None = None
    best_score = -math.inf
    for attack in stats["attacks"]:
        dice, modifier, multiplier = damage_profile(attack["damage"])
        damage_score = math.ceil((math.ceil(dice * 3.5) + modifier) * multiplier) if dice is not None else 0
        score = (attack["skill"] or 0) + damage_score
        if score > best_score:
            best_score = score
            best_attack = attack

    attack_skill = (best_attack["skill"] - 10) if best_attack else 0
    dice, modifier, multiplier = damage_profile(best_attack["damage"] if best_attack else None)
    damage = math.ceil((math.ceil(dice * 3.5) + modifier) * multiplier) if dice is not None else 0
    fp = (attrs["fp"] - 10) if isinstance(attrs["fp"], (int, float)) else 0
    move = (attrs["move"] - 6) if isinstance(attrs["move"], (int, float)) else 0
    offense = int(attack_skill + damage + fp + move)

    trait_text = " | ".join(stats["traits"]).lower()
    dr = attrs["dr"] if isinstance(attrs["dr"], (int, float)) else 0
    defense = 2 * (attrs["dodge"] - 8) if isinstance(attrs["dodge"], (int, float)) else 0
    health = (attrs["ht"] - 10) if isinstance(attrs["ht"], (int, float)) else 0
    health += 2 if "high pain threshold" in trait_text else 0
    health += 2 if re.search(r"\brecovery\b", trait_text) else 0
    hp = (attrs["hp"] - 10) if isinstance(attrs["hp"], (int, float)) else 0
    will = (attrs["will"] - 10) if isinstance(attrs["will"], (int, float)) else 0
    will += 1 if "combat reflexes" in trait_text else 0
    will += 8 if "unfazeable" in trait_text else 0
    protection = int(dr + defense + health + hp + will)
    cer = max(1, round(offense + protection))
    tier = "severe" if cer >= 100 else "major" if cer >= 60 else "standard" if cer >= 25 else "minor"
    return {
        "offenseRating": offense,
        "protectionRating": protection,
        "combatEffectivenessRating": cer,
        "treasureAdjustedCombatEffectiveness": None,
        "wanderingCombatEffectiveness": None,
        "threatTier": tier,
    }


def creature_type(section_text: str) -> str | None:
    match = re.search(r"^\*\*Creature Type:\*\*\s*(.+)$", section_text, re.MULTILINE | re.IGNORECASE)
    return match.group(1).strip().rstrip(".") if match else None


def make_doa_record(
    record: dict[str, Any],
    section: dict[str, str],
    stats: dict[str, Any],
    expected_points: int | float,
    rebuilt_points: int | float,
    reconciliation: int | float,
    library_adjustment: int | float,
    gct_relative_path: str,
) -> dict[str, Any]:
    name = str(record.get("doc_name") or record.get("name"))
    slug = slugify(name)
    monster_class = creature_type(section["text"])
    class_tags = [slugify(part) for part in re.split(r"[,()]", monster_class or "") if part.strip()]
    editions = sorted({str(item.get("edition")) for item in record.get("matches", []) if item.get("edition")})
    sm_value = first_number(stats["fields"].get("sm", ""))
    notes_match = re.search(r"^\*\*Notes:\*\*\s*(.+)$", stats["block"], re.MULTILINE | re.IGNORECASE)
    source_notes = notes_match.group(1).strip() if notes_match else ""
    hex_match = re.search(r"Size\s+([^;.]+?\s+hex(?:es)?)", source_notes, re.IGNORECASE)
    review_notes = [
        f"GCS ancestry draft: {gct_relative_path}",
        f"Source template total: {expected_points} points.",
        f"Library-rebuilt template total: {rebuilt_points} points.",
        "CER was computed from parsed Typical Stats using the Dungeons On Automatic baseline CER path.",
        "Review attacks, special abilities, encounter frequency, treasure, grappling, and GCS modifiers before approval.",
    ]
    if library_adjustment:
        review_notes.append(
            f"Exact GCS library matches change the template by {library_adjustment:+g} point(s)."
        )
    if reconciliation:
        review_notes.append(f"GCS template includes a {reconciliation:+g}-point reconciliation child requiring decomposition.")
    if source_notes:
        review_notes.append(source_notes)

    attributes = stats["attributes"]
    effectiveness = compute_effectiveness(stats)
    return {
        "id": f"enraged_eggplant_{slug.replace('-', '_')}",
        "name": name,
        "pageRef": section["heading"],
        "class": monster_class,
        "classTags": class_tags,
        "tags": list(dict.fromkeys(["fan-authorized", "enraged-eggplant", *editions, *class_tags])),
        "iq": attributes["iq"],
        "appearance": "1",
        "lair": None,
        "treasure": {
            "money": None, "items": None, "strategy": None, "change": None,
            "estimatedMoneyAverage": None, "estimatedItemAverage": None,
            "estimatedMoneyPerAppearance": None,
        },
        "size": {
            "modifier": stats["fields"].get("sm"),
            "heightSizeModifier": sm_value,
            "hexes": hex_match.group(1) if hex_match else None,
            "heightHexes": None, "lengthHexes": None, "widthHexes": None,
        },
        "grappling": {"skill": None, "damage": None, "controlMaximum": None},
        "effectiveness": effectiveness,
        "encounter": {
            "averageNumberAppearing": 1,
            "treasureMultiplier": None,
            "wanderingWeight": 1,
            "lightSensitive": None,
        },
        "stats": {
            "attributes": attributes,
            "attacks": stats["attacks"],
            "traits": stats["traits"],
            "skills": stats["skills"],
            "notes": review_notes,
        },
        "provenance": {
            "kind": "fan_authorized",
            "sourceSystem": SOURCE_SYSTEM,
            "sourceLicense": SOURCE_LICENSE,
            "sourceMonsterId": slug,
            "sourceName": section["heading"],
            "sourceUrl": SOURCE_URL,
            "sourceCopyrightNotice": COPYRIGHT_NOTICE,
            "conversionVersion": "0.2.0-library-rebuild-draft",
            "conversionNotes": review_notes[:4],
            "manualReviewStatus": "review_required",
            "packageSourceId": SOURCE_ID,
            "license": "Unrestricted author permission; attribution retained.",
            "url": SOURCE_URL,
            "originalId": slug,
            "publicStats": True,
            "notes": "Authorized for publication by Enraged Eggplant; mechanical review remains required.",
            "credits": [originator_credit()],
        },
        "sourceBook": SOURCE_BOOK,
        "sourceBooks": [SOURCE_BOOK],
        "source": {
            "workbook": "Monsters (May 11, 2024)",
            "sheet": "Enraged Eggplant fan conversion",
            "row": int(record.get("paragraph", 0)) + 1,
        },
    }


def checklist_text(rows: list[dict[str, Any]], failures: list[dict[str, str]]) -> str:
    reconciled = sum(bool(row["reconciliation"]) for row in rows)
    with_stats = sum(row["stats_fields"] >= 8 for row in rows)
    with_attacks = sum(row["attacks"] > 0 for row in rows)
    library_matches = sum(row.get("library_matches", 0) for row in rows)
    library_cost_flags = sum(row.get("library_cost_mismatches", 0) for row in rows)
    library_enabled = any("library_matches" in row for row in rows)
    lines = [
        "# Enraged Eggplant SRD-Overlap Conversion Checklist",
        "",
        CREDIT_LINE,
        "",
        "## Plan",
        "",
        "1. Generate one authorized-public GCS v5 ancestry draft and one DOA candidate record per missing SRD-overlap monster.",
        "2. Reconcile every ancestry point total; replace reconciliation children with native GCS traits, modifiers, skills, and attacks.",
        "3. Open each `.gct` in GCS and verify attribute effects, modifiers, displayed point total, and ancestry application.",
        "4. Review each DOA Typical Stats parse, attacks, CER, threat tier, encounter frequency, treasure, size, and grappling fields.",
        "5. Change `manualReviewStatus` to `approved` only after both GCS and DOA reviews pass; then include the record in the consumable public package.",
        "",
        "## Batch Summary",
        "",
        f"- Missing conversions requested: {len(rows) + len(failures)}",
        f"- GCS drafts generated and structurally validated: {len(rows)}",
        f"- DOA candidates with at least eight parsed stat fields: {with_stats}",
        f"- DOA candidates with at least one parsed attack: {with_attacks}",
        f"- GCS drafts with reconciliation children: {reconciled}",
        f"- Extraction failures: {len(failures)}",
    ]
    if library_enabled:
        lines.extend(
            [
                f"- Native GCS library trait matches: {library_matches}",
                f"- Exact-identity library cost discrepancies: {library_cost_flags}",
                "- Detailed arithmetic review: `LIBRARY-AUDIT.md`",
            ]
        )
    lines.extend(["", "## Per-Monster Review", ""])
    if library_enabled:
        lines.extend(
            [
                "| Approved | Monster | SRD | Source | Rebuilt | Native | Cost flags | GCS | Stats | Attacks | Reconciliation | Status |",
                "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |",
            ]
        )
    else:
        lines.extend(
            [
                "| Approved | Monster | SRD | Points | GCS | Stats | Attacks | Reconciliation | Status |",
                "| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |",
            ]
        )
    for row in rows:
        editions = ", ".join(row["editions"])
        if library_enabled:
            lines.append(
                f"| [ ] | {row['name']} | {editions} | {row['points']} | {row['rebuilt_points']} | "
                f"{row['library_matches']} | {row['library_cost_mismatches']} | `{row['gct']}` | "
                f"{row['stats_fields']}/12 | {row['attacks']} | {row['reconciliation']:+g} | review_required |"
            )
        else:
            lines.append(
                f"| [ ] | {row['name']} | {editions} | {row['points']} | `{row['gct']}` | "
                f"{row['stats_fields']}/12 | {row['attacks']} | {row['reconciliation']:+g} | review_required |"
            )
    if failures:
        lines.extend(["", "## Extraction Failures", ""])
        for failure in failures:
            lines.append(f"- [ ] {failure['name']}: {failure['reason']}")
    lines.append("")
    return "\n".join(lines)


def library_audit_markdown(audit: dict[str, Any]) -> str:
    summary = audit["summary"]
    lines = [
        "# Enraged Eggplant Full GCS Library Audit",
        "",
        CREDIT_LINE,
        "",
        "Only exact, conservative trait constructions were replaced with native GCS library records. "
        "A cost flag means the trait identity, level, self-control number, and every stated modifier matched, "
        "but the library calculation differs from the fan document.",
        "",
        "## Summary",
        "",
        f"- Source trait constructions reviewed: {summary['source_traits']}",
        f"- Source skill constructions reviewed: {summary['source_skills']}",
        f"- Trait libraries scanned: {summary['trait_libraries_scanned']}",
        f"- Modifier libraries scanned: {summary['modifier_libraries_scanned']}",
        f"- Skill libraries scanned: {summary['skill_libraries_scanned']}",
        f"- Native library matches: {summary['library_matches']}",
        f"- Native skill matches: {summary['native_skill_matches']}",
        f"- Source-built skill rows: {summary['source_skill_rows']}",
        f"- Unparsed skill constructions left as review-required traits: {summary['unparsed_skills']}",
        "- Trait matches by library: "
        + ", ".join(f"{name} {count}" for name, count in summary["trait_matches_by_library"].items()),
        "- Skill matches by library: "
        + ", ".join(f"{name} {count}" for name, count in summary["skill_matches_by_library"].items()),
        "- Exact modifier matches by library: "
        + ", ".join(f"{name} {count}" for name, count in summary["modifier_matches_by_library"].items()),
        f"- Exact modifiers applied: {summary['exact_modifier_matches']} "
        f"({summary['trait_specific_modifier_matches']} trait-specific; {summary['global_modifier_matches']} global)",
        f"- Modifier forms: {summary['exact_named_modifier_matches']} exact named; "
        f"{summary['parameterized_modifier_matches']} parameterized; "
        f"{summary['flat_mode_modifier_matches']} flat modes",
        f"- Native matches with the same cost: {summary['same_cost_matches']}",
        f"- Exact-identity cost discrepancies: {summary['cost_mismatches']}",
        f"- Likely cost-math errors: {summary['likely_cost_math_errors']}",
        f"- Zero-point feature vs. priced-library differences: {summary['feature_pricing_differences']}",
        f"- Constructions left as source-native flat records: {summary['unmatched']}",
        "- Flat-record reasons: "
        + ", ".join(
            f"{name.replace('_', ' ')} {count}"
            for name, count in summary["unmatched_by_reason"].items()
        ),
        f"- Monsters with at least one cost discrepancy: {summary['monsters_with_cost_mismatches']}",
        f"- Monsters still carrying a source-reconciliation child: {summary['monsters_with_reconciliation']}",
        f"- Published-total differences fully explained by library corrections: {summary['reconciliations_explained_by_library']}",
        "",
        "## Likely Cost-Math Errors",
        "",
        "These exact constructions have a nonzero stated cost that disagrees with the native library calculation. "
        "They are the strongest candidates for an author-facing correction note.",
        "",
        "| Monster | Source construction | Source | Library | Difference | Record | Ref |",
        "| --- | --- | ---: | ---: | ---: | --- | --- |",
    ]
    for monster in audit["monsters"]:
        for trait in monster["cost_mismatches"]:
            if trait.get("classification") != "likely_cost_math_error":
                continue
            source_text = str(trait["source_text"]).replace("|", "\\|")
            lines.append(
                f"| {monster['name']} | {source_text} | {trait['source_points']} | "
                f"{trait['library_points']} | {trait['difference']:+g} | "
                f"{trait['library']}: {trait['library_name']} | {trait.get('reference') or ''} |"
            )
    if not summary["likely_cost_math_errors"]:
        lines.append("| — | No discrepancies found | — | — | — | — | — |")

    lines.extend(
        [
            "",
            "## Feature-Pricing Differences",
            "",
            "The fan document explicitly lists these as zero-point features while a core GCS library prices the "
            "same named trait. They may be a deliberate conversion convention rather than arithmetic mistakes.",
            "",
            "| Monster | Source construction | Source | Library | Difference | Record | Ref |",
            "| --- | --- | ---: | ---: | ---: | --- | --- |",
        ]
    )
    for monster in audit["monsters"]:
        for trait in monster["cost_mismatches"]:
            if trait.get("classification") != "feature_pricing_difference":
                continue
            source_text = str(trait["source_text"]).replace("|", "\\|")
            lines.append(
                f"| {monster['name']} | {source_text} | {trait['source_points']} | "
                f"{trait['library_points']} | {trait['difference']:+g} | "
                f"{trait['library']}: {trait['library_name']} | {trait.get('reference') or ''} |"
            )
    if not summary["feature_pricing_differences"]:
        lines.append("| — | No discrepancies found | — | — | — | — | — |")

    lines.extend(
        [
            "",
            "## Source-Total Reconciliation Queue",
            "",
            "These differences predate library correction. They can be author arithmetic errors, grouped abilities, "
            "or constructions the prose parser has not decomposed; review them before contacting the author.",
            "",
            "| Monster | Published total | Parsed source children | Difference |",
            "| --- | ---: | ---: | ---: |",
        ]
    )
    for monster in audit["monsters"]:
        if monster["applied_reconciliation"]:
            lines.append(
                f"| {monster['name']} | {monster['source_points']} | {monster['source_parsed_points']} | "
                f"{monster['applied_reconciliation']:+g} |"
            )
    if not summary["monsters_with_reconciliation"]:
        lines.append("| — | — | — | 0 |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overlap", type=Path, required=True)
    parser.add_argument("--coverage", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--selection",
        choices=("missing", "covered", "all"),
        default="missing",
        help=(
            "Coverage set to rebuild: missing drafts only, existing covered identities only, "
            "or every SRD-overlap record (default: missing)"
        ),
    )
    parser.add_argument(
        "--trait-library",
        action="append",
        default=[],
        metavar="LABEL=PATH",
        help="GCS .adq trait library used for conservative native matches (repeatable)",
    )
    parser.add_argument(
        "--modifier-library",
        action="append",
        default=[],
        metavar="LABEL=PATH",
        help="GCS .adm modifier library used for exact modifier matches (repeatable)",
    )
    parser.add_argument(
        "--library-root",
        action="append",
        default=[],
        type=Path,
        help="Recursively discover every .adq trait, .adm modifier, and .skl skill library under this root",
    )
    args = parser.parse_args()

    library_index: LibraryIndex | None = None
    library_sources: dict[str, list[dict[str, str]]] = {
        "traits": [],
        "modifiers": [],
        "skills": [],
    }
    if args.trait_library or args.library_root:
        library_index = LibraryIndex()
        seen_trait_paths: set[Path] = set()
        seen_modifier_paths: set[Path] = set()
        seen_skill_paths: set[Path] = set()
        for raw_root in args.library_root:
            root = raw_root.resolve()
            for path in sorted(root.rglob("*.adq"), key=lambda item: str(item).casefold()):
                resolved = path.resolve()
                if resolved in seen_trait_paths:
                    continue
                seen_trait_paths.add(resolved)
                label = path.relative_to(root).with_suffix("").as_posix()
                library_index.add_trait_library(label, path)
                library_sources["traits"].append({"label": label, "path": str(path)})
            for path in sorted(root.rglob("*.adm"), key=lambda item: str(item).casefold()):
                resolved = path.resolve()
                if resolved in seen_modifier_paths:
                    continue
                seen_modifier_paths.add(resolved)
                label = path.relative_to(root).with_suffix("").as_posix()
                library_index.add_modifier_library(label, path)
                library_sources["modifiers"].append({"label": label, "path": str(path)})
            for path in sorted(root.rglob("*.skl"), key=lambda item: str(item).casefold()):
                resolved = path.resolve()
                if resolved in seen_skill_paths:
                    continue
                seen_skill_paths.add(resolved)
                label = path.relative_to(root).with_suffix("").as_posix()
                library_index.add_skill_library(label, path)
                library_sources["skills"].append({"label": label, "path": str(path)})
        for value in args.trait_library:
            label, path = parse_library_argument(value)
            resolved = path.resolve()
            if resolved in seen_trait_paths:
                continue
            seen_trait_paths.add(resolved)
            library_index.add_trait_library(label, path)
            library_sources["traits"].append({"label": label, "path": str(path)})
        for value in args.modifier_library:
            label, path = parse_library_argument(value)
            resolved = path.resolve()
            if resolved in seen_modifier_paths:
                continue
            seen_modifier_paths.add(resolved)
            library_index.add_modifier_library(label, path)
            library_sources["modifiers"].append({"label": label, "path": str(path)})

    overlap = load_json(args.overlap)
    coverage = load_json(args.coverage)
    selected_names = selected_record_names(coverage, args.selection)
    records = [
        record for record in overlap.get("matches", [])
        if selected_names is None
        or normalized_name(str(record.get("doc_name") or record.get("name") or ""))
        in selected_names
    ]
    sections = split_sections(args.markdown.read_text(encoding="utf-8-sig"))
    output_dir = args.output_dir.resolve()
    gcs_dir = output_dir / "gcs"
    gcs_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    monsters: list[dict[str, Any]] = []
    library_monsters: list[dict[str, Any]] = []
    slugs: set[str] = set()

    for record in records:
        name = str(record.get("doc_name") or record.get("name"))
        section = find_section(record, sections)
        if not section:
            failures.append({"name": name, "reason": "source section not found uniquely"})
            continue
        expected, source_traits, reconciliation, _ = parse_template(
            section["text"],
            add_reconciliation=library_index is None,
        )
        if expected is None:
            failures.append({"name": name, "reason": "source template point total not found"})
            continue
        slug = slugify(name)
        if slug in slugs:
            failures.append({"name": name, "reason": f"duplicate output slug {slug}"})
            continue
        slugs.add(slug)

        source_parsed_points = sum(trait["points"] for trait in source_traits)
        source_skill_traits = [
            trait for trait in source_traits if "Skill" in trait.get("tags", [])
        ]
        source_ancestry_traits = [
            trait for trait in source_traits if "Skill" not in trait.get("tags", [])
        ]
        traits = source_traits if library_index is None else source_ancestry_traits
        skills: list[dict[str, Any]] = []
        trait_audit: list[dict[str, Any]] = []
        skill_audit: list[dict[str, Any]] = []
        library_adjustment: int | float = 0
        applied_reconciliation = reconciliation
        if library_index is not None:
            traits, trait_audit = rebuild_traits(source_ancestry_traits, library_index)
            skills, skill_audit, unparsed_skill_traits = rebuild_skills(
                source_skill_traits,
                library_index,
            )
            traits.extend(unparsed_skill_traits)
            library_adjustment = sum(
                item["difference"] or 0
                for item in trait_audit
                if item["status"] == "native_cost_mismatch"
            )
            if reconciliation and reconciliation == library_adjustment:
                applied_reconciliation = 0
            if applied_reconciliation:
                traits.append(
                    {
                        "name": "Point reconciliation (unparsed source construction)",
                        "points": applied_reconciliation,
                        "tags": ["Review Required", "Source Reconciliation"],
                        "source_text": (
                            f"Automated source children total {source_parsed_points}; "
                            f"published source template total {expected}. Replace this adjustment after "
                            "resolving grouped abilities, replacements, unusual cost notation, or a source arithmetic error."
                        ),
                    }
                )
        rebuilt_points = sum(trait["points"] for trait in traits) + sum(
            skill["points"] for skill in skills
        )

        spec = {
            "name": name,
            "reference": f"Enraged Eggplant, Monsters (May 11, 2024): {section['heading']}",
            "source_heading": section["heading"],
            "expected_points": rebuilt_points,
            "publication_status": "authorized_public",
            "authorization": AUTHORIZATION,
            "credit_line": CREDIT_LINE,
            "traits": traits,
            "skills": skills,
        }
        if library_index is not None:
            spec["notes"] = (
                f"Fan document published {expected:g} points; exact GCS library substitutions "
                f"produce {rebuilt_points:g} points. Library adjustment: {library_adjustment:+g}."
            )
        payload = build(spec)
        gct_path = gcs_dir / f"{slug}.gct"
        gct_path.write_text(json.dumps(payload, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
        validate_file(gct_path)

        parsed_stats = parse_typical_stats(section["text"])
        gct_relative = gct_path.relative_to(output_dir).as_posix()
        monsters.append(
            make_doa_record(
                record,
                section,
                parsed_stats,
                expected,
                rebuilt_points,
                applied_reconciliation,
                library_adjustment,
                gct_relative,
            )
        )
        row = {
                "name": name,
                "editions": sorted({str(match.get("edition")) for match in record.get("matches", []) if match.get("edition")}),
                "points": expected,
                "rebuilt_points": rebuilt_points,
                "gct": gct_relative,
                "stats_fields": sum(value is not None for value in parsed_stats["attributes"].values()),
                "attacks": len(parsed_stats["attacks"]),
                "reconciliation": applied_reconciliation,
            }
        if library_index is not None:
            matches = [item for item in trait_audit if item["status"].startswith("native_")]
            cost_mismatches = [item for item in trait_audit if item["status"] == "native_cost_mismatch"]
            row.update(
                {
                    "library_matches": len(matches),
                    "library_exact_cost_matches": len(matches) - len(cost_mismatches),
                    "library_cost_mismatches": len(cost_mismatches),
                    "library_adjustment": library_adjustment,
                    "unmatched_traits": len(trait_audit) - len(matches),
                    "skills": len(skills),
                    "native_skill_matches": sum(
                        item["status"] == "native_skill" for item in skill_audit
                    ),
                }
            )
            library_monsters.append(
                {
                    "name": name,
                    "source_points": expected,
                    "source_parsed_points": source_parsed_points,
                    "source_reconciliation": reconciliation,
                    "applied_reconciliation": applied_reconciliation,
                    "rebuilt_points": rebuilt_points,
                    "library_adjustment": library_adjustment,
                    "matches": matches,
                    "cost_mismatches": cost_mismatches,
                    "unmatched": [item for item in trait_audit if item["status"] == "unmatched"],
                    "skill_matches": [
                        item for item in skill_audit if item["status"] == "native_skill"
                    ],
                    "source_skills": [
                        item for item in skill_audit if item["status"] == "source_skill"
                    ],
                    "unparsed_skills": [
                        item for item in skill_audit if item["status"] == "unparsed_skill_source"
                    ],
                }
            )
        rows.append(row)

    package = {
        "manifest": {
            "id": "enraged-eggplant-monsters-review-required",
            "name": "Enraged Eggplant Monster Conversions (Review Required)",
            "version": "0.2.0-library-rebuild-draft",
            "sourceBook": {
                "id": SOURCE_BOOK,
                "name": "Enraged Eggplant Monsters",
                "required": False,
                "derived": True,
            },
            "licenseSummary": "Fan-authored GURPS monster statistics published and adapted with unrestricted author permission; mechanical review required.",
            "packageUrl": None,
            "dataUrl": None,
            "credits": [originator_credit()],
            "sources": [
                {
                    "id": SOURCE_ID,
                    "name": "Enraged Eggplant GURPS Monster Conversions",
                    "sourceSystem": SOURCE_SYSTEM,
                    "sourceLicense": SOURCE_LICENSE,
                    "sourceUrl": SOURCE_URL,
                    "sourceCopyrightNotice": COPYRIGHT_NOTICE,
                    "credits": [originator_credit()],
                }
            ],
        },
        "monsters": monsters,
    }
    (output_dir / "doa-monsters.review-required.json").write_text(
        json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_dir / "CHECKLIST.md").write_text(checklist_text(rows, failures), encoding="utf-8")
    (output_dir / "conversion-manifest.json").write_text(
        json.dumps(
            {
                "sourceId": SOURCE_ID,
                "credits": [originator_credit()],
                "records": rows,
                "failures": failures,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    library_audit: dict[str, Any] | None = None
    if library_index is not None:
        all_matches = [item for monster in library_monsters for item in monster["matches"]]
        all_cost_mismatches = [
            item for monster in library_monsters for item in monster["cost_mismatches"]
        ]
        all_unmatched = [item for monster in library_monsters for item in monster["unmatched"]]
        all_skill_matches = [
            item for monster in library_monsters for item in monster["skill_matches"]
        ]
        all_source_skills = [
            item for monster in library_monsters for item in monster["source_skills"]
        ]
        all_unparsed_skills = [
            item for monster in library_monsters for item in monster["unparsed_skills"]
        ]
        source_trait_count = sum(
            len(monster["matches"]) + len(monster["unmatched"])
            for monster in library_monsters
        )
        trait_matches_by_library: dict[str, int] = {}
        for source in library_sources["traits"]:
            count = sum(item["library"] == source["label"] for item in all_matches)
            if count:
                trait_matches_by_library[source["label"]] = count
        skill_matches_by_library: dict[str, int] = {}
        for source in library_sources["skills"]:
            count = sum(item["library"] == source["label"] for item in all_skill_matches)
            if count:
                skill_matches_by_library[source["label"]] = count
        modifier_matches_by_library: dict[str, int] = {}
        for item in all_matches:
            for label in item.get("modifier_libraries", []):
                modifier_matches_by_library[label] = modifier_matches_by_library.get(label, 0) + 1
        unmatched_by_reason: dict[str, int] = {}
        for item in all_unmatched:
            reason = item.get("reason_code") or "unknown"
            unmatched_by_reason[reason] = unmatched_by_reason.get(reason, 0) + 1
        library_audit = {
            "libraries": library_sources,
            "summary": {
                "source_traits": source_trait_count,
                "source_skills": len(all_skill_matches) + len(all_source_skills) + len(all_unparsed_skills),
                "trait_libraries_scanned": len(library_sources["traits"]),
                "modifier_libraries_scanned": len(library_sources["modifiers"]),
                "skill_libraries_scanned": len(library_sources["skills"]),
                "library_matches": len(all_matches),
                "native_skill_matches": len(all_skill_matches),
                "source_skill_rows": len(all_source_skills),
                "unparsed_skills": len(all_unparsed_skills),
                "trait_matches_by_library": trait_matches_by_library,
                "skill_matches_by_library": skill_matches_by_library,
                "modifier_matches_by_library": modifier_matches_by_library,
                "exact_modifier_matches": sum(
                    len(item.get("modifiers", [])) for item in all_matches
                ),
                "trait_specific_modifier_matches": sum(
                    item.get("modifier_kinds", []).count("trait_specific")
                    for item in all_matches
                ),
                "global_modifier_matches": sum(
                    item.get("modifier_kinds", []).count("global")
                    for item in all_matches
                ),
                "exact_named_modifier_matches": sum(
                    item.get("modifier_forms", []).count("exact_named")
                    for item in all_matches
                ),
                "parameterized_modifier_matches": sum(
                    item.get("modifier_forms", []).count("parameterized")
                    for item in all_matches
                ),
                "flat_mode_modifier_matches": sum(
                    item.get("modifier_forms", []).count("flat_mode")
                    for item in all_matches
                ),
                "same_cost_matches": len(all_matches) - len(all_cost_mismatches),
                "cost_mismatches": len(all_cost_mismatches),
                "likely_cost_math_errors": sum(
                    item.get("classification") == "likely_cost_math_error"
                    for item in all_cost_mismatches
                ),
                "feature_pricing_differences": sum(
                    item.get("classification") == "feature_pricing_difference"
                    for item in all_cost_mismatches
                ),
                "unmatched": source_trait_count - len(all_matches),
                "unmatched_by_reason": dict(sorted(unmatched_by_reason.items())),
                "monsters_with_cost_mismatches": sum(
                    bool(monster["cost_mismatches"]) for monster in library_monsters
                ),
                "monsters_with_reconciliation": sum(
                    bool(monster["applied_reconciliation"]) for monster in library_monsters
                ),
                "reconciliations_explained_by_library": sum(
                    bool(monster["source_reconciliation"])
                    and not bool(monster["applied_reconciliation"])
                    for monster in library_monsters
                ),
            },
            "monsters": library_monsters,
        }
        (output_dir / "library-audit.json").write_text(
            json.dumps(library_audit, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (output_dir / "LIBRARY-AUDIT.md").write_text(
            library_audit_markdown(library_audit),
            encoding="utf-8",
        )
    print(
        json.dumps(
            {
                "requested": len(records),
                "selection": args.selection,
                "converted": len(rows),
                "failures": len(failures),
                "reconciled": sum(bool(row["reconciliation"]) for row in rows),
                "library_matches": (
                    library_audit["summary"]["library_matches"] if library_audit else 0
                ),
                "native_skill_matches": (
                    library_audit["summary"]["native_skill_matches"] if library_audit else 0
                ),
                "library_cost_mismatches": (
                    library_audit["summary"]["cost_mismatches"] if library_audit else 0
                ),
                "output": str(output_dir),
            },
            indent=2,
        )
    )
    return 0 if not failures else 2


if __name__ == "__main__":
    sys.exit(main())

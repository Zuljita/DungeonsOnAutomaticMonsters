#!/usr/bin/env python3
"""Conservatively replace flat fan-source traits with native GCS library records."""

from __future__ import annotations

import copy
import json
import math
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ATTRIBUTE_RE = re.compile(
    r"^(ST|DX|IQ|HT|HP|FP|Will|Per|Basic Speed|Basic Move|SM)\s*([+-])\s*(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
ATTRIBUTE_LIBRARY_NAMES = {
    ("st", "+"): "Increased Strength",
    ("st", "-"): "Decreased Strength",
    ("dx", "+"): "Increased Dexterity",
    ("dx", "-"): "Decreased Dexterity",
    ("iq", "+"): "Increased Intelligence",
    ("iq", "-"): "Decreased Intelligence",
    ("ht", "+"): "Increased Health",
    ("ht", "-"): "Decreased Health",
    ("hp", "+"): "Extra Hit Points",
    ("hp", "-"): "Fewer Hit Points",
    ("fp", "+"): "Extra Fatigue Points",
    ("fp", "-"): "Fewer Fatigue Points",
    ("will", "+"): "Increased Will",
    ("will", "-"): "Decreased Will",
    ("per", "+"): "Increased Perception",
    ("per", "-"): "Decreased Perception",
    ("basic speed", "+"): "Increased Basic Speed",
    ("basic speed", "-"): "Decreased Basic Speed",
    ("basic move", "+"): "Increased Basic Move",
    ("basic move", "-"): "Decreased Basic Move",
    ("sm", "+"): "Increased Size Modifier",
    ("sm", "-"): "Decreased Size Modifier",
}
ATTRIBUTE_LEVEL_SIZES = {
    "basic speed": 0.25,
}
TRAIT_ALIASES = {
    "Damage Resistance": ("DR",),
    "Telecommunication": ("Telesend",),
}
FLAT_MODE_TRAIT_ALIASES = {
    ("telecommunication", "telesend"),
}
MODIFIER_NAME_ALIASES = {
    "affect machines": "affects machines",
    "cannpt hover": "cannot hover",
    "no fine maipulators": "no fine manipulators",
    "no fine manupulators": "no fine manipulators",
    "no manipulators": "no fine manipulators",
    "panoptic i": "panoptic 1",
    "size modifier": "size",
}
PERCENT_RE = re.compile(r"^(.*?)(?:,\s*|\s+)([-+]\d+(?:\.\d+)?)%\s*$")
LEVEL_SUFFIX_RE = re.compile(r"^(.*?)(?:\s+)(\d+(?:\.\d+)?)$")
SELF_CONTROL_RE = re.compile(r"^(6|9|12|15)$")
SKILL_NOTATION_RE = re.compile(
    r"^(?P<name>.+?)\s+\((?P<difficulty>VH|E|A|H)\)\s+"
    r"(?P<attribute>ST|DX|IQ|HT|Will|Per)(?P<relative>[+-]\d+)?$",
    re.IGNORECASE,
)


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(re.findall(r"[a-z0-9]+", asciiish.lower()))


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def iter_named_leaves(values: Iterable[Any]) -> Iterable[dict[str, Any]]:
    for value in values:
        if not isinstance(value, dict):
            continue
        children = value.get("children")
        if isinstance(children, list) and children:
            yield from iter_named_leaves(children)
            continue
        if value.get("name"):
            yield value


def iter_modifier_leaves(values: Iterable[Any]) -> Iterable[dict[str, Any]]:
    for value in values:
        if not isinstance(value, dict):
            continue
        children = value.get("children")
        if isinstance(children, list) and children:
            yield from iter_modifier_leaves(children)
        elif value.get("name") and value.get("cost_adj") is not None:
            yield value


def has_active_modifier(row: dict[str, Any]) -> bool:
    return any(not modifier.get("disabled", False) for modifier in iter_modifier_leaves(row.get("modifiers", [])))


def library_priority(label: str) -> int:
    root = re.split(r"[/\\]", label, maxsplit=1)[0].casefold()
    if root == "basic set":
        return 20
    if root == "powers":
        return 19
    if root == "power ups":
        return 10
    return 0


@dataclass(frozen=True)
class LibraryTrait:
    row: dict[str, Any]
    library: str
    path: str


@dataclass(frozen=True)
class LibraryModifier:
    row: dict[str, Any]
    library: str
    path: str
    trait_specific: bool = False


@dataclass(frozen=True)
class LibrarySkill:
    row: dict[str, Any]
    library: str
    path: str


@dataclass
class MatchResult:
    trait: dict[str, Any]
    matched: bool
    status: str
    source_points: int | float
    library_points: int | float | None = None
    library: str | None = None
    library_path: str | None = None
    library_name: str | None = None
    reference: str | None = None
    modifiers: list[str] | None = None
    modifier_libraries: list[str] | None = None
    modifier_kinds: list[str] | None = None
    modifier_forms: list[str] | None = None
    classification: str | None = None
    reason_code: str | None = None
    reason: str | None = None

    def audit(self, source_text: str) -> dict[str, Any]:
        return {
            "source_text": source_text,
            "source_points": self.source_points,
            "status": self.status,
            "library_points": self.library_points,
            "difference": (
                self.library_points - self.source_points
                if self.library_points is not None
                else None
            ),
            "library": self.library,
            "library_path": self.library_path,
            "library_name": self.library_name,
            "reference": self.reference,
            "modifiers": self.modifiers or [],
            "modifier_libraries": self.modifier_libraries or [],
            "modifier_kinds": self.modifier_kinds or [],
            "modifier_forms": self.modifier_forms or [],
            "classification": self.classification,
            "reason_code": self.reason_code,
            "reason": self.reason,
        }


class LibraryIndex:
    def __init__(self) -> None:
        self.traits: dict[str, list[LibraryTrait]] = {}
        self.prefixes: dict[str, list[tuple[LibraryTrait, str]]] = {}
        self.global_modifiers: dict[str, list[LibraryModifier]] = {}
        self.skills: dict[str, list[LibrarySkill]] = {}

    def add_trait_library(self, label: str, path: Path) -> None:
        payload = load_json(path)
        for row in iter_named_leaves(payload.get("rows", [])):
            if not ({"base_points", "points_per_level", "calc"} & set(row)):
                continue
            if (
                "@" in str(row.get("name", ""))
                or has_active_modifier(row)
                or "Condition" in row.get("tags", [])
            ):
                continue
            item = LibraryTrait(copy.deepcopy(row), label, str(path))
            self.traits.setdefault(normalize(str(row["name"])), []).append(item)
            names = (str(row["name"]), *TRAIT_ALIASES.get(str(row["name"]), ()))
            for candidate_name in names:
                key = candidate_name[:1].casefold()
                if key:
                    self.prefixes.setdefault(key, []).append((item, candidate_name))

    def add_modifier_library(self, label: str, path: Path) -> None:
        payload = load_json(path)
        for row in iter_modifier_leaves(payload.get("rows", [])):
            item = LibraryModifier(copy.deepcopy(row), label, str(path))
            self.global_modifiers.setdefault(normalize(str(row["name"])), []).append(item)

    def add_skill_library(self, label: str, path: Path) -> None:
        payload = load_json(path)
        for row in iter_named_leaves(payload.get("rows", [])):
            difficulty = str(row.get("difficulty", "")).casefold()
            if (
                "/" not in difficulty
                or not isinstance(row.get("points"), (int, float))
                or "@" in str(row.get("name", ""))
            ):
                continue
            item = LibrarySkill(copy.deepcopy(row), label, str(path))
            self.skills.setdefault(normalize(str(row["name"])), []).append(item)

    def named_traits(self, name: str) -> list[LibraryTrait]:
        return list(self.traits.get(normalize(name), []))

    def named_skills(self, name: str) -> list[LibrarySkill]:
        def skill_priority(item: LibrarySkill) -> tuple[int, int, str]:
            root = re.split(r"[/\\]", item.library, maxsplit=1)[0].casefold()
            dedicated = 20 if root == "psionics" else 0
            return dedicated, library_priority(item.library), item.library.casefold()

        return sorted(self.skills.get(normalize(name), []), key=skill_priority, reverse=True)

    def candidate_prefixes(self, source_text: str) -> list[tuple[LibraryTrait, str]]:
        candidates: list[tuple[LibraryTrait, str]] = []
        lowered = source_text.casefold()
        for entry, candidate_name in self.prefixes.get(lowered[:1], []):
            prefix = candidate_name.casefold()
            if not lowered.startswith(prefix):
                continue
            if len(source_text) > len(candidate_name) and source_text[len(candidate_name)] not in " (":
                continue
            candidates.append((entry, candidate_name))
        candidates.sort(
            key=lambda item: (
                len(item[1]),
                library_priority(item[0].library),
                item[0].library.casefold(),
            ),
            reverse=True,
        )
        return candidates

    def modifier_options(self, trait: LibraryTrait) -> list[LibraryModifier]:
        specific = [
            LibraryModifier(copy.deepcopy(row), trait.library, trait.path, True)
            for row in iter_modifier_leaves(trait.row.get("modifiers", []))
        ]
        global_options = [item for values in self.global_modifiers.values() for item in values]
        return specific + global_options


def parse_library_argument(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise ValueError(f"library argument must be LABEL=PATH: {value}")
    label, raw_path = value.split("=", 1)
    if not label.strip() or not raw_path.strip():
        raise ValueError(f"library argument must be LABEL=PATH: {value}")
    return label.strip(), Path(raw_path.strip())


def outer_groups(value: str) -> list[str] | None:
    groups: list[str] = []
    index = 0
    while index < len(value):
        while index < len(value) and value[index].isspace():
            index += 1
        if index >= len(value):
            break
        if value[index] != "(":
            return None
        depth = 0
        start = index + 1
        while index < len(value):
            char = value[index]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    groups.append(value[start:index].strip())
                    index += 1
                    break
            index += 1
        if depth != 0:
            return None
    return groups


def split_semicolon(value: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    for index, char in enumerate(value):
        if char == "(":
            depth += 1
        elif char == ")" and depth:
            depth -= 1
        elif char == ";" and depth == 0:
            parts.append(value[start:index].strip())
            start = index + 1
    parts.append(value[start:].strip())
    return [part for part in parts if part]


def split_modifier_pieces(value: str) -> list[str]:
    """Split modifier lists without breaking commas that belong to a label.

    Eggplant usually separates modifiers with semicolons, but some attribute
    constructions use ``..., -40%, Size Modifier, -20%``.  A comma following
    a completed percentage is an unambiguous modifier boundary; commas before
    the percentage remain part of labels such as ``Melee Attack, Reach C``.
    """
    pieces: list[str] = []
    for semicolon_piece in split_semicolon(value):
        pieces.extend(
            part.strip()
            for part in re.split(r"(?<=%)\s*,\s*(?=[A-Z0-9])", semicolon_piece)
            if part.strip()
        )
    return pieces


def numeric(value: Any) -> int | float:
    number = float(value)
    return int(number) if number.is_integer() else number


def percent_value(value: Any) -> float | None:
    match = re.fullmatch(r"\s*([-+]?\d+(?:\.\d+)?)%\s*", str(value))
    return float(match.group(1)) if match else None


def qualifier_matches(row: dict[str, Any], qualifier: str) -> bool:
    qualifier_norm = normalize(qualifier)
    context = normalize(f"{row.get('name', '')} {row.get('local_notes', '')}")
    if qualifier_norm and qualifier_norm in context:
        return True
    qualifier_numbers = re.findall(r"\d+", qualifier_norm)
    return bool(qualifier_numbers) and all(number in context.split() for number in qualifier_numbers)


def modifier_template_name(value: str) -> str:
    return re.sub(r"\s*\([^()]*@[^()]*\)\s*$", "", value).strip()


def modifier_match_quality(label: str, option: LibraryModifier) -> int:
    label_norm = MODIFIER_NAME_ALIASES.get(normalize(label), normalize(label))
    option_name = str(option.row.get("name", ""))
    option_norm = normalize(option_name)
    if label_norm == option_norm:
        return 100

    template_name = modifier_template_name(option_name)
    template_norm = normalize(template_name)
    if not template_norm or not label_norm.startswith(f"{template_norm} "):
        return 0

    local_notes = str(option.row.get("local_notes", ""))
    note_norm = normalize(local_notes)
    if note_norm and note_norm in label_norm:
        return 90
    if "@" in option_name or "@" in local_notes:
        return 75
    return 0


def find_modifier(
    label: str,
    stated_percent: float,
    options: list[LibraryModifier],
) -> tuple[LibraryModifier, int | float] | None:
    label_norm = normalize(label)
    parsed_level: int | float = 1
    base_label = label
    suffix = LEVEL_SUFFIX_RE.match(label.strip())
    if suffix:
        base_label = suffix.group(1).strip()
        parsed_level = numeric(suffix.group(2))
    fp_suffix = re.match(r"^(.*?),\s*(\d+(?:\.\d+)?)\s*FP$", label.strip(), re.IGNORECASE)
    if fp_suffix and normalize(fp_suffix.group(1)) == "costs fatigue":
        base_label = fp_suffix.group(1).strip()
        parsed_level = numeric(fp_suffix.group(2))
    base_norm = normalize(base_label)
    label_norm = MODIFIER_NAME_ALIASES.get(label_norm, label_norm)
    base_norm = MODIFIER_NAME_ALIASES.get(base_norm, base_norm)

    matches: list[tuple[int, LibraryModifier, int | float]] = []
    for option in options:
        option_name = str(option.row.get("name", ""))
        option_norm = normalize(option_name)
        option_template_norm = normalize(modifier_template_name(option_name))
        quality = modifier_match_quality(label, option)
        base_quality = modifier_match_quality(base_label, option)
        level = parsed_level if base_norm in {option_norm, option_template_norm} else 1
        if not quality and not base_quality:
            continue
        unit = percent_value(option.row.get("cost_adj"))
        if unit is None:
            continue
        scalable_template = (
            "level" in option_name.casefold()
            or "per level" in str(option.row.get("local_notes", "")).casefold()
        )
        if (
            parsed_level == 1
            and (option.row.get("levels") is not None or scalable_template)
            and unit
            and math.isclose(stated_percent / unit, round(stated_percent / unit), abs_tol=1e-9)
            and stated_percent / unit > 0
        ):
            level = numeric(round(stated_percent / unit))
        expected = unit * float(level)
        if not math.isclose(expected, stated_percent, abs_tol=1e-9):
            continue
        score = (
            max(quality, base_quality) * 100
            + (50 if option.trait_specific else 0)
            + library_priority(option.library) * 2
            + len(option_norm)
        )
        matches.append((score, option, level))
    if not matches:
        return None
    matches.sort(key=lambda item: item[0], reverse=True)
    _, option, level = matches[0]
    return option, level


def self_control_multiplier(cr: int | None) -> float:
    return {6: 2.0, 9: 1.5, 12: 1.0, 15: 0.5}.get(cr or 12, 1.0)


def calculated_cost(
    row: dict[str, Any],
    levels: int | float | None,
    cr: int | None,
    modifiers: list[dict[str, Any]],
) -> int | float | None:
    default_levels = row.get("levels")
    effective_levels = levels if levels is not None else default_levels
    default_cr = row.get("cr")
    if not modifiers and effective_levels == default_levels and (cr is None or cr == default_cr):
        default_points = row.get("calc", {}).get("points")
        if isinstance(default_points, (int, float)):
            return default_points

    base_points = row.get("base_points", 0)
    points_per_level = row.get("points_per_level", 0)
    if not isinstance(base_points, (int, float)) or not isinstance(points_per_level, (int, float)):
        return None
    if points_per_level and effective_levels is None:
        effective_levels = 1
    level_cost = points_per_level * float(effective_levels or 0)
    flat_cost = float(base_points)
    total_percent = 0.0
    levels_percent = 0.0
    for modifier in modifiers:
        percent = percent_value(modifier.get("cost_adj"))
        if percent is None:
            try:
                flat_cost += float(modifier.get("cost_adj")) * float(modifier.get("levels", 1))
            except (TypeError, ValueError):
                return None
            continue
        percent *= float(modifier.get("levels", 1))
        if modifier.get("affects") == "levels_only":
            levels_percent += percent
        else:
            total_percent += percent

    def adjusted(value: float, percent: float) -> float:
        if value > 0:
            percent = max(percent, -80.0)
        return value * (1.0 + percent / 100.0)

    raw = adjusted(flat_cost, total_percent) + adjusted(level_cost, total_percent + levels_percent)
    effective_cr = cr if cr is not None else (int(default_cr) if default_cr else None)
    if effective_cr is not None:
        raw *= self_control_multiplier(effective_cr)
    raw = round(raw, 10)
    if row.get("round_down"):
        result = math.floor(raw) if raw >= 0 else math.ceil(raw)
    else:
        result = math.ceil(raw)
    if raw > 0:
        result = max(1, result)
    return numeric(result)


def trait_spec_from_library(
    source_trait: dict[str, Any],
    library_trait: LibraryTrait,
    levels: int | float | None,
    cr: int | None,
    selected_modifiers: list[dict[str, Any]],
    library_points: int | float,
) -> dict[str, Any]:
    row = library_trait.row
    source_points = source_trait["points"]
    output: dict[str, Any] = {
        "name": row["name"],
        "points": library_points,
        "tags": copy.deepcopy(row.get("tags", source_trait.get("tags", []))),
        "reference": row.get("reference", source_trait.get("reference")),
        "source_text": source_trait.get("source_text", source_trait.get("name", "")),
        "notes": (
            f"Native library match: {library_trait.library} ({Path(library_trait.path).name}). "
            f"Fan source stated {source_points:g} point(s); library calculation is {library_points:g}."
        ),
    }
    for field in ("base_points", "points_per_level", "can_level", "features", "prereqs", "weapons", "round_down"):
        if field in row:
            output[field] = copy.deepcopy(row[field])
    if row.get("points_per_level") is not None:
        output["levels"] = levels if levels is not None else row.get("levels", 1)
    if cr is not None or row.get("cr") is not None:
        output["cr"] = cr if cr is not None else row.get("cr")
    if selected_modifiers:
        output["modifiers"] = copy.deepcopy(selected_modifiers)
        if any(percent_value(modifier.get("cost_adj")) is None for modifier in selected_modifiers):
            output["base_points"] = row.get("base_points", 0)
    if row.get("local_notes"):
        output["notes"] += f" Library note: {row['local_notes']}"
    return output


def match_trait(source_trait: dict[str, Any], index: LibraryIndex) -> MatchResult:
    source_text = str(source_trait.get("source_text") or source_trait.get("name") or "").strip()
    source_points = source_trait["points"]
    candidates: list[tuple[LibraryTrait, str, int | float | None, str]] = []

    attribute = ATTRIBUTE_RE.match(source_text)
    if attribute:
        library_name = ATTRIBUTE_LIBRARY_NAMES[(attribute.group(1).lower(), attribute.group(2))]
        attribute_name = attribute.group(1).lower()
        amount = float(attribute.group(3)) / ATTRIBUTE_LEVEL_SIZES.get(attribute_name, 1.0)
        amount = numeric(amount)
        for entry in index.named_traits(library_name):
            remainder = source_text[attribute.end() :].strip()
            candidates.append((entry, library_name, amount, remainder))
    else:
        for entry, prefix in index.candidate_prefixes(source_text):
            remainder = source_text[len(prefix) :].strip()
            levels: int | float | None = None
            if entry.row.get("points_per_level") is not None:
                level_match = re.match(r"^(\d+(?:\.\d+)?)(?=\s|\(|$)", remainder)
                if level_match:
                    levels = numeric(level_match.group(1))
                    remainder = remainder[level_match.end() :].strip()
            candidates.append((entry, prefix, levels, remainder))

    evaluated: list[tuple[int, MatchResult]] = []
    rejection_reasons: set[str] = set()
    for entry, prefix, levels, remainder in candidates:
        groups = outer_groups(remainder)
        if groups is None:
            rejection_reasons.add("unparsed_suffix")
            continue
        cr: int | None = None
        selected_modifiers: list[dict[str, Any]] = []
        modifier_names: list[str] = []
        modifier_libraries: list[str] = []
        modifier_kinds: list[str] = []
        modifier_forms: list[str] = []
        qualifier_score = 0
        valid = True
        if (
            normalize(str(entry.row.get("name", ""))),
            normalize(prefix),
        ) in FLAT_MODE_TRAIT_ALIASES:
            mode = next(
                (
                    option
                    for option in index.modifier_options(entry)
                    if option.trait_specific
                    and normalize(str(option.row.get("name", ""))) == normalize(prefix)
                    and percent_value(option.row.get("cost_adj")) is None
                    and re.fullmatch(r"[-+]?\d+(?:\.\d+)?", str(option.row.get("cost_adj", "")))
                ),
                None,
            )
            if mode is None:
                rejection_reasons.add("qualifier_not_exact")
                continue
            mode_modifier = {
                "name": mode.row["name"],
                "cost_adj": mode.row["cost_adj"],
            }
            for field in ("reference", "local_notes", "affects"):
                if field in mode.row:
                    mode_modifier[field] = mode.row[field]
            selected_modifiers.append(mode_modifier)
            modifier_names.append(f"{prefix} mode")
            modifier_libraries.append(mode.library)
            modifier_kinds.append("trait_specific")
            modifier_forms.append("flat_mode")
        for group in groups:
            if SELF_CONTROL_RE.fullmatch(group):
                cr = int(group)
                continue
            pieces = split_modifier_pieces(group)
            if pieces and all(PERCENT_RE.match(piece) for piece in pieces):
                options = index.modifier_options(entry)
                for piece in pieces:
                    match = PERCENT_RE.match(piece)
                    assert match is not None
                    label = match.group(1).strip()
                    stated_percent = float(match.group(2))
                    found = find_modifier(label, stated_percent, options)
                    if not found:
                        rejection_reasons.add("modifier_not_exact")
                        valid = False
                        break
                    option, modifier_levels = found
                    option_name = str(option.row["name"])
                    modifier = {
                        "name": modifier_template_name(option_name),
                        "cost_adj": option.row["cost_adj"],
                    }
                    for field in ("reference", "local_notes", "affects"):
                        if field in option.row:
                            modifier[field] = option.row[field]
                    if (
                        modifier_match_quality(label, option) < 100
                        and ("@" in option_name or "@" in str(option.row.get("local_notes", "")))
                    ):
                        modifier["local_notes"] = label
                    if modifier_levels != 1 or option.row.get("levels") is not None:
                        modifier["levels"] = modifier_levels
                    selected_modifiers.append(modifier)
                    modifier_names.append(piece)
                    modifier_libraries.append(option.library)
                    modifier_kinds.append("trait_specific" if option.trait_specific else "global")
                    modifier_forms.append(
                        "exact_named"
                        if modifier_match_quality(label, option) == 100
                        else "parameterized"
                    )
                if not valid:
                    break
                continue
            if qualifier_matches(entry.row, group):
                qualifier_score += 5
                continue
            valid = False
            rejection_reasons.add("qualifier_not_exact")
            break
        if not valid:
            continue

        points = calculated_cost(entry.row, levels, cr, selected_modifiers)
        if points is None:
            rejection_reasons.add("cost_not_calculable")
            continue
        if points != source_points and library_priority(entry.library) < 10:
            rejection_reasons.add("noncore_cost_conflict")
            continue
        spec = trait_spec_from_library(source_trait, entry, levels, cr, selected_modifiers, points)
        status = "native_exact" if points == source_points else "native_cost_mismatch"
        classification = None
        if status == "native_cost_mismatch":
            classification = (
                "feature_pricing_difference"
                if source_points == 0 and "Feature" in source_trait.get("tags", [])
                else "likely_cost_math_error"
            )
        result = MatchResult(
            trait=spec,
            matched=True,
            status=status,
            source_points=source_points,
            library_points=points,
            library=entry.library,
            library_path=entry.path,
            library_name=str(entry.row["name"]),
            reference=entry.row.get("reference"),
            modifiers=modifier_names,
            modifier_libraries=modifier_libraries,
            modifier_kinds=modifier_kinds,
            modifier_forms=modifier_forms,
            classification=classification,
        )
        score = (
            len(prefix) * 10
            + qualifier_score
            + len(selected_modifiers) * 10
            + (50 if points == source_points else 0)
            + library_priority(entry.library) * 10
        )
        evaluated.append((score, result))

    if not evaluated:
        reason_code = (
            "no_trait_name_match"
            if not candidates
            else sorted(
                rejection_reasons,
                key=lambda value: (
                    "modifier_not_exact",
                    "qualifier_not_exact",
                    "noncore_cost_conflict",
                    "unparsed_suffix",
                    "cost_not_calculable",
                ).index(value),
            )[0]
        )
        return MatchResult(
            trait=source_trait,
            matched=False,
            status="unmatched",
            source_points=source_points,
            reason_code=reason_code,
            reason=(
                "No exact full-library construction match under conservative rules "
                f"({reason_code.replace('_', ' ')})."
            ),
        )
    evaluated.sort(key=lambda item: item[0], reverse=True)
    return evaluated[0][1]


def rebuild_traits(
    source_traits: list[dict[str, Any]],
    index: LibraryIndex,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rebuilt: list[dict[str, Any]] = []
    audit: list[dict[str, Any]] = []
    for source_trait in source_traits:
        result = match_trait(source_trait, index)
        rebuilt.append(result.trait)
        audit.append(result.audit(str(source_trait.get("source_text") or source_trait.get("name") or "")))
    return rebuilt, audit


def parse_skill_notation(source_text: str) -> tuple[str, str] | None:
    match = SKILL_NOTATION_RE.fullmatch(source_text.strip())
    if not match:
        return None
    difficulty = match.group("difficulty").casefold()
    attribute = match.group("attribute").casefold()
    return match.group("name").strip(), f"{attribute}/{difficulty}"


def rebuild_skills(
    source_skills: list[dict[str, Any]],
    index: LibraryIndex,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Build real GCS skill rows; return skills, audit rows, and unparsed traits."""
    rebuilt: list[dict[str, Any]] = []
    audit: list[dict[str, Any]] = []
    unparsed: list[dict[str, Any]] = []
    for source_skill in source_skills:
        source_text = str(source_skill.get("source_text") or source_skill.get("name") or "").strip()
        source_points = source_skill["points"]
        parsed = parse_skill_notation(source_text)
        if parsed is None:
            unparsed.append(source_skill)
            audit.append(
                {
                    "source_text": source_text,
                    "source_points": source_points,
                    "status": "unparsed_skill_source",
                    "library": None,
                    "library_path": None,
                    "library_name": None,
                    "reference": None,
                    "reason": "Skill notation did not identify both controlling attribute and difficulty.",
                }
            )
            continue

        name, difficulty = parsed
        matches = [
            item
            for item in index.named_skills(name)
            if str(item.row.get("difficulty", "")).casefold() == difficulty
        ]
        if matches:
            match = matches[0]
            rebuilt.append(
                {
                    "name": match.row["name"],
                    "points": source_points,
                    "source_text": source_text,
                    "notes": (
                        f"Native library match: {match.library} ({Path(match.path).name}). "
                        f"Fan source allocates {source_points:g} point(s)."
                    ),
                    "native_record": copy.deepcopy(match.row),
                }
            )
            audit.append(
                {
                    "source_text": source_text,
                    "source_points": source_points,
                    "status": "native_skill",
                    "library": match.library,
                    "library_path": match.path,
                    "library_name": match.row["name"],
                    "reference": match.row.get("reference"),
                    "reason": None,
                }
            )
            continue

        rebuilt.append(
            {
                "name": name,
                "points": source_points,
                "difficulty": difficulty,
                "source_text": source_text,
                "notes": "No exact native skill record matched; built from the fan-source notation.",
            }
        )
        audit.append(
            {
                "source_text": source_text,
                "source_points": source_points,
                "status": "source_skill",
                "library": None,
                "library_path": None,
                "library_name": None,
                "reference": None,
                "reason": "No exact full-library skill matched both name and difficulty.",
            }
        )
    return rebuilt, audit, unparsed

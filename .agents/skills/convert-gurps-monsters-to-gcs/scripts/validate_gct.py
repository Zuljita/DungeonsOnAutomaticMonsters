#!/usr/bin/env python3
"""Validate private GCS v5 ancestry templates and reconcile point totals."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable


ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{16}$")


def iter_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_objects(child)


def validate_file(path: Path) -> dict[str, Any]:
    errors: list[str] = []
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if payload.get("version") != 5:
        errors.append("root version must be 5")
    traits = payload.get("traits")
    if not isinstance(traits, list) or not traits:
        errors.append("root traits must be a non-empty list")
        traits = []
    skills = payload.get("skills", [])
    if not isinstance(skills, list):
        errors.append("root skills must be a list when present")
        skills = []

    ids: dict[str, int] = {}
    for obj in iter_objects(payload):
        if "id" not in obj:
            continue
        object_id = obj["id"]
        if not isinstance(object_id, str) or not ID_PATTERN.fullmatch(object_id):
            errors.append(f"invalid GCS id: {object_id!r}")
        else:
            ids[object_id] = ids.get(object_id, 0) + 1
    duplicates = sorted(object_id for object_id, count in ids.items() if count > 1)
    if duplicates:
        errors.append("duplicate ids: " + ", ".join(duplicates))

    summaries = []
    ancestry_points = 0
    for index, container in enumerate(traits):
        label = container.get("name", f"traits[{index}]")
        if container.get("container_type") != "ancestry":
            errors.append(f"{label}: container_type must be ancestry")
        if not container.get("reference"):
            errors.append(f"{label}: missing private source reference")
        notes = container.get("local_notes", "")
        authorized_public = "authorized for publication" in notes.lower()
        if "draft" not in notes.lower() or ("private" not in notes.lower() and not authorized_public):
            errors.append(
                f"{label}: local_notes must mark the template draft and either private or authorized for publication"
            )
        if authorized_public and "originator credit:" not in notes.lower():
            errors.append(f"{label}: authorized-public local_notes must retain an originator credit")
        children = container.get("children")
        if not isinstance(children, list):
            errors.append(f"{label}: children must be a list")
            continue
        child_points = 0
        for child_index, child in enumerate(children):
            points = child.get("calc", {}).get("points")
            if not isinstance(points, (int, float)):
                errors.append(f"{label}: child {child_index} lacks numeric calc.points")
            else:
                child_points += points
        container_points = container.get("calc", {}).get("points")
        if container_points != child_points:
            errors.append(
                f"{label}: container points {container_points!r} != child total {child_points}"
            )
        ancestry_points += child_points
        summaries.append(
            {"name": label, "points": child_points, "children": len(children)}
        )

    skill_points = 0
    skill_summaries: list[dict[str, Any]] = []
    for index, skill in enumerate(skills):
        if not isinstance(skill, dict):
            errors.append(f"skills[{index}] must be an object")
            continue
        label = skill.get("name", f"skills[{index}]")
        difficulty = skill.get("difficulty")
        if not isinstance(difficulty, str) or "/" not in difficulty:
            errors.append(f"{label}: skill difficulty must identify attribute and difficulty")
        points = skill.get("points")
        if not isinstance(points, (int, float)):
            errors.append(f"{label}: skill points must be numeric")
            points = 0
        skill_points += points
        skill_summaries.append({"name": label, "points": points, "difficulty": difficulty})

    if errors:
        raise ValueError(f"{path}:\n- " + "\n- ".join(errors))
    return {
        "path": str(path.resolve()),
        "ancestries": summaries,
        "skills": skill_summaries,
        "ancestry_points": ancestry_points,
        "skill_points": skill_points,
        "template_points": ancestry_points + skill_points,
        "ids": len(ids),
    }


def expand_paths(paths: list[Path]) -> list[Path]:
    expanded: list[Path] = []
    for path in paths:
        if path.is_dir():
            expanded.extend(sorted(path.rglob("*.gct")))
        else:
            expanded.append(path)
    return expanded


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    results = [validate_file(path) for path in expand_paths(args.paths)]
    print(json.dumps({"validated": len(results), "files": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

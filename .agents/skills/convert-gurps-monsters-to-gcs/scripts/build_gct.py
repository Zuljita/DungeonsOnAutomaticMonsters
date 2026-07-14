#!/usr/bin/env python3
"""Build a deterministic GCS v5 ancestry template from a reviewed JSON spec."""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
from pathlib import Path
from typing import Any


def stable_id(prefix: str, key: str) -> str:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    encoded = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return prefix + encoded[:16]


def require(spec: dict[str, Any], field: str) -> Any:
    if field not in spec:
        raise ValueError(f"missing required field: {field}")
    return spec[field]


def build_modifier(modifier: dict[str, Any], key: str, index: int) -> dict[str, Any]:
    output = {
        "id": stable_id("m", f"{key}:modifier:{index}:{require(modifier, 'name')}"),
        "name": require(modifier, "name"),
    }
    for field in ("reference", "cost_adj", "levels", "disabled", "local_notes", "affects"):
        if field in modifier:
            output[field] = modifier[field]
    return output


def clone_with_stable_ids(value: Any, key: str, path: str = "root") -> Any:
    """Clone nested GCS data while replacing embedded library object IDs."""
    if isinstance(value, list):
        return [clone_with_stable_ids(item, key, f"{path}:{index}") for index, item in enumerate(value)]
    if not isinstance(value, dict):
        return copy.deepcopy(value)
    output: dict[str, Any] = {}
    for field, child in value.items():
        if field == "id":
            original = str(child)
            prefix = original[0] if original and original[0].isalpha() else "x"
            output[field] = stable_id(prefix, f"{key}:{path}:{original}")
        else:
            output[field] = clone_with_stable_ids(child, key, f"{path}:{field}")
    return output


def build_trait(
    trait: dict[str, Any],
    reference: str,
    race_name: str,
    index: int,
) -> dict[str, Any]:
    name = require(trait, "name")
    points = require(trait, "points")
    if not isinstance(points, (int, float)):
        raise ValueError(f"{name}: points must be numeric")
    key = f"{race_name}:trait:{index}:{name}"
    output: dict[str, Any] = {
        "id": stable_id("t", key),
        "name": name,
        "reference": trait.get("reference", reference),
        "tags": require(trait, "tags"),
    }
    if "source_text" in trait:
        output["local_notes"] = f"Source construction: {trait['source_text']}"
    if "notes" in trait:
        separator = "\n" if "local_notes" in output else ""
        output["local_notes"] = output.get("local_notes", "") + separator + trait["notes"]
    for field in ("cr", "round_down"):
        if field in trait:
            output[field] = trait[field]
    if "base_points" in trait:
        output["base_points"] = trait["base_points"]
    if "points_per_level" in trait:
        output["points_per_level"] = trait["points_per_level"]
        output["can_level"] = trait.get("can_level", True)
        output["levels"] = require(trait, "levels")
    elif "base_points" not in trait and points != 0:
        output["base_points"] = points
    if trait.get("modifiers"):
        output["modifiers"] = [
            build_modifier(modifier, key, modifier_index)
            for modifier_index, modifier in enumerate(trait["modifiers"])
        ]
    if trait.get("features"):
        output["features"] = trait["features"]
    for field in ("prereqs", "weapons"):
        if field in trait:
            output[field] = clone_with_stable_ids(trait[field], key, field)
    output["calc"] = {"points": points}
    if "levels" in trait:
        output["calc"]["current_level"] = trait["levels"]
    return output


def build_skill(
    skill: dict[str, Any],
    reference: str,
    race_name: str,
    index: int,
) -> dict[str, Any]:
    name = require(skill, "name")
    points = require(skill, "points")
    if not isinstance(points, (int, float)):
        raise ValueError(f"{name}: skill points must be numeric")
    key = f"{race_name}:skill:{index}:{name}"
    native_record = skill.get("native_record")
    if native_record is not None:
        if not isinstance(native_record, dict):
            raise ValueError(f"{name}: native_record must be an object")
        output = clone_with_stable_ids(native_record, key)
        output["id"] = stable_id("s", key)
        output["name"] = name
        output["points"] = points
    else:
        output = {
            "id": stable_id("s", key),
            "name": name,
            "reference": skill.get("reference", reference),
            "difficulty": require(skill, "difficulty"),
            "points": points,
        }
        if skill.get("tags"):
            output["tags"] = copy.deepcopy(skill["tags"])

    notes: list[str] = []
    if skill.get("source_text"):
        notes.append(f"Source construction: {skill['source_text']}")
    if skill.get("notes"):
        notes.append(str(skill["notes"]))
    if notes:
        existing = str(output.get("local_notes", "")).strip()
        output["local_notes"] = "\n".join(([existing] if existing else []) + notes)
    return output


def build(spec: dict[str, Any]) -> dict[str, Any]:
    name = require(spec, "name")
    reference = require(spec, "reference")
    source_heading = require(spec, "source_heading")
    expected_points = require(spec, "expected_points")
    traits = require(spec, "traits")
    children = [build_trait(trait, reference, name, index) for index, trait in enumerate(traits)]
    ancestry_points = sum(child["calc"]["points"] for child in children)
    skills = [
        build_skill(skill, reference, name, index)
        for index, skill in enumerate(spec.get("skills", []))
    ]
    skill_points = sum(skill["points"] for skill in skills)
    actual_points = ancestry_points + skill_points
    if actual_points != expected_points:
        raise ValueError(
            f"{name}: template points total {actual_points}, expected {expected_points} "
            f"(ancestry {ancestry_points}, skills {skill_points})"
        )

    publication_status = spec.get("publication_status", "private_draft")
    if publication_status == "authorized_public":
        authorization = require(spec, "authorization")
        credit_line = require(spec, "credit_line")
        status_note = (
            f"Fan-derived draft authorized for publication. {authorization} "
            f"Originator credit: {credit_line} "
        )
    else:
        status_note = "Private fan-derived draft. "

    container: dict[str, Any] = {
        "id": stable_id("T", f"{name}:ancestry"),
        "name": name,
        "reference": reference,
        "local_notes": (
            status_note
            +
            f"Source heading: {source_heading}. "
            "SRD name overlap does not make these GURPS mechanics SRD content. "
            "Review status: draft."
        ),
        "container_type": "ancestry",
        "children": children,
        "calc": {"points": ancestry_points},
    }
    if spec.get("notes"):
        container["local_notes"] += f" {spec['notes']}"
    if spec.get("ancestry"):
        container["ancestry"] = spec["ancestry"]
    payload = {
        "version": 5,
        "id": stable_id("B", f"{name}:root"),
        "traits": [container],
    }
    if skills:
        payload["skills"] = skills
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    payload = build(spec)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "name": payload["traits"][0]["name"],
                "ancestry_points": payload["traits"][0]["calc"]["points"],
                "skill_points": sum(skill["points"] for skill in payload.get("skills", [])),
                "points": payload["traits"][0]["calc"]["points"]
                + sum(skill["points"] for skill in payload.get("skills", [])),
                "traits": len(payload["traits"][0]["children"]),
                "skills": len(payload.get("skills", [])),
                "output": str(args.output.resolve()),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

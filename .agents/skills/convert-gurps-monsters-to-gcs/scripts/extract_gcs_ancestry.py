#!/usr/bin/env python3
"""Extract a native ancestry container from a GCS character sheet into a .gct file."""

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


def choose_container(traits: list[dict[str, Any]], requested_name: str | None) -> dict[str, Any]:
    containers = [trait for trait in traits if trait.get("container_type") == "ancestry"]
    if requested_name:
        containers = [trait for trait in containers if trait.get("name") == requested_name]
    if len(containers) != 1:
        names = [trait.get("name", "<unnamed>") for trait in containers]
        raise ValueError(
            f"expected one matching ancestry container, found {len(containers)}: {names}"
        )
    return copy.deepcopy(containers[0])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gcs", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--name")
    parser.add_argument("--container-name")
    parser.add_argument("--reference", required=True)
    parser.add_argument("--source-heading", required=True)
    args = parser.parse_args()

    source = json.loads(args.gcs.read_text(encoding="utf-8-sig"))
    if source.get("version") != 5:
        raise ValueError("source GCS file must be version 5")
    profile_name = source.get("profile", {}).get("name")
    race_name = args.name or profile_name or args.gcs.stem
    container = choose_container(source.get("traits", []), args.container_name)
    child_total = sum(child.get("calc", {}).get("points", 0) for child in container.get("children", []))
    container_total = container.get("calc", {}).get("points")
    if child_total != container_total:
        raise ValueError(
            f"{race_name}: ancestry total {container_total!r} does not equal child total {child_total}"
        )

    original_notes = container.get("local_notes", "").strip()
    provenance = (
        "Private fan-derived draft extracted from "
        f"{args.gcs.name}. Source heading: {args.source_heading}. "
        "SRD name overlap does not make these GURPS mechanics SRD content. "
        "Review status: draft."
    )
    container["name"] = race_name
    container["reference"] = args.reference
    container["local_notes"] = provenance + (f"\n{original_notes}" if original_notes else "")
    payload = {
        "version": 5,
        "id": stable_id("B", f"{race_name}:{args.gcs.resolve()}:ancestry-template"),
        "traits": [container],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "name": race_name,
                "points": container_total,
                "children": len(container.get("children", [])),
                "source": str(args.gcs.resolve()),
                "output": str(args.output.resolve()),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Audit SRD-overlapping fan conversions against an existing GCS monster library."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path
from typing import Any


def normalized_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(re.findall(r"[a-z0-9]+", asciiish.lower()))


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def gcs_identities(gcs_dir: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    identities: list[dict[str, str]] = []
    mismatches: list[dict[str, str]] = []
    for path in sorted(gcs_dir.rglob("*.gcs")):
        payload = load_json(path)
        profile_name = str(payload.get("profile", {}).get("name", "")).strip()
        names = [path.stem]
        if profile_name and profile_name not in names:
            names.append(profile_name)
        if profile_name and normalized_name(profile_name) != normalized_name(path.stem):
            mismatches.append(
                {"file": str(path), "filename": path.stem, "profile_name": profile_name}
            )
        for name in names:
            identities.append(
                {
                    "name": name,
                    "normalized_name": normalized_name(name),
                    "file": str(path),
                }
            )
    return identities, mismatches


def controlled_family_matches(doc_name: str, identities: list[dict[str, str]]) -> list[dict[str, str]]:
    """Return conservative qualified variants of a base creature.

    Parenthesized variants cover cases such as ``Air Elemental (Large)``.
    ``, Average`` covers a typical-stat sheet. Classed or merely similar names do
    not count automatically.
    """

    base = normalized_name(doc_name)
    matches: list[dict[str, str]] = []
    for identity in identities:
        name = identity["name"]
        norm = identity["normalized_name"]
        if not norm.startswith(base + " "):
            continue
        remainder = name[len(doc_name) :].strip() if name.lower().startswith(doc_name.lower()) else ""
        if (remainder.startswith("(") and remainder.endswith(")")) or remainder.lower() == ", average":
            matches.append(identity)
    return matches


def unique_identities(matches: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    result: list[dict[str, str]] = []
    for match in matches:
        key = (match["name"], match["file"])
        if key not in seen:
            seen.add(key)
            result.append(match)
    return result


def audit(overlap_path: Path, gcs_dir: Path) -> dict[str, Any]:
    overlap = load_json(overlap_path)
    records = overlap.get("matches")
    if not isinstance(records, list):
        raise ValueError("Overlap JSON must contain a top-level 'matches' list")

    identities, mismatches = gcs_identities(gcs_dir)
    by_normalized: dict[str, list[dict[str, str]]] = {}
    for identity in identities:
        by_normalized.setdefault(identity["normalized_name"], []).append(identity)

    covered: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    for record in records:
        doc_name = str(record.get("doc_name") or record.get("name") or "").strip()
        editions = sorted(
            {
                str(match.get("edition"))
                for match in record.get("matches", [])
                if match.get("edition")
            }
        )
        direct = unique_identities(by_normalized.get(normalized_name(doc_name), []))
        if direct:
            covered.append(
                {
                    "name": doc_name,
                    "method": "direct-name",
                    "editions": editions,
                    "gcs_matches": direct,
                }
            )
            continue

        family = unique_identities(controlled_family_matches(doc_name, identities))
        if family:
            covered.append(
                {
                    "name": doc_name,
                    "method": "controlled-qualified-family",
                    "editions": editions,
                    "gcs_matches": family,
                }
            )
            continue

        missing.append({"name": doc_name, "editions": editions})

    direct_count = sum(item["method"] == "direct-name" for item in covered)
    family_count = sum(item["method"] == "controlled-qualified-family" for item in covered)
    return {
        "overlap_source": str(overlap_path),
        "gcs_directory": str(gcs_dir),
        "gcs_file_count": len(list(gcs_dir.rglob("*.gcs"))),
        "total_srd_overlapping_conversions": len(records),
        "direct_name_coverage": direct_count,
        "controlled_variant_family_coverage": family_count,
        "covered_total": len(covered),
        "missing_total": len(missing),
        "covered": covered,
        "missing": missing,
        "filename_profile_mismatches": mismatches,
    }


def markdown_report(result: dict[str, Any]) -> str:
    lines = [
        "# GCS Coverage of SRD-Overlapping Fan Conversions",
        "",
        f"- SRD-overlapping conversions: {result['total_srd_overlapping_conversions']}",
        f"- Direct GCS name coverage: {result['direct_name_coverage']}",
        f"- Controlled qualified-family coverage: {result['controlled_variant_family_coverage']}",
        f"- Covered total: {result['covered_total']}",
        f"- Missing from the GCS directory: {result['missing_total']}",
        f"- GCS files inspected: {result['gcs_file_count']}",
        "",
        "A qualified family counts only when the GCS identity is the exact base name followed by a parenthesized qualifier, or by `, Average`. Distinct names are not collapsed (for example, Giant Eagle is not Eagle and Winter Wolf is not Wolf).",
        "",
        "## Controlled Qualified-Family Matches",
        "",
    ]
    family = [item for item in result["covered"] if item["method"] == "controlled-qualified-family"]
    if family:
        for item in family:
            names = sorted({match["name"] for match in item["gcs_matches"]})
            lines.append(f"- {item['name']}: {', '.join(names)}")
    else:
        lines.append("- None")

    lines.extend(["", "## Direct Matches", ""])
    direct = [item for item in result["covered"] if item["method"] == "direct-name"]
    for item in direct:
        files = sorted({Path(match["file"]).name for match in item["gcs_matches"]})
        lines.append(f"- {item['name']}: {', '.join(files)}")

    lines.extend(["", "## Missing", ""])
    for item in result["missing"]:
        editions = ", ".join(item["editions"])
        lines.append(f"- {item['name']} ({editions})")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overlap_json", type=Path)
    parser.add_argument("gcs_directory", type=Path)
    parser.add_argument("--output-json", type=Path)
    parser.add_argument("--output-markdown", type=Path)
    args = parser.parse_args()

    if not args.overlap_json.is_file():
        parser.error(f"Overlap JSON does not exist: {args.overlap_json}")
    if not args.gcs_directory.is_dir():
        parser.error(f"GCS directory does not exist: {args.gcs_directory}")

    result = audit(args.overlap_json.resolve(), args.gcs_directory.resolve())
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.output_markdown:
        args.output_markdown.parent.mkdir(parents=True, exist_ok=True)
        args.output_markdown.write_text(markdown_report(result), encoding="utf-8")

    print(json.dumps({key: result[key] for key in (
        "gcs_file_count",
        "total_srd_overlapping_conversions",
        "direct_name_coverage",
        "controlled_variant_family_coverage",
        "covered_total",
        "missing_total",
    )}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

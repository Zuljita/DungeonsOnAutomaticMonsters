#!/usr/bin/env python3
"""Extract a formatted monster DOCX to Markdown and match headings to SRD JSON."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.table import Table
from docx.text.paragraph import Paragraph


COMMON_LABELS = {
    "attribute modifiers",
    "secondary characteristic modifiers",
    "advantages",
    "disadvantages",
    "perks",
    "quirks",
    "features",
    "racial psionic abilities",
    "racial psionic skills",
    "psionic abilities",
    "psionic skills",
    "traits",
    "skills",
    "spells",
    "creature type",
    "notes",
}
SIZE_QUALIFIERS = {
    "fine",
    "diminutive",
    "tiny",
    "small",
    "medium",
    "large",
    "huge",
    "gargantuan",
    "colossal",
}


def clean_text(text: str) -> str:
    return (
        text.replace("\u00a0", " ")
        .replace("\u00ad", "")
        .replace("\r", "")
        .strip()
    )


def tokens(value: str) -> list[str]:
    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .replace("&", "and")
    )
    return re.findall(r"[a-z0-9]+", ascii_value)


def normalized(value: str) -> str:
    return "".join(tokens(value))


def singularize(word: str) -> str:
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith(("ches", "shes", "xes", "zes", "sses")) and len(word) > 4:
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")) and len(word) > 3:
        return word[:-1]
    return word


def word_key(value: str) -> tuple[str, ...]:
    return tuple(sorted(tokens(value)))


def singular_key(value: str) -> tuple[str, ...]:
    return tuple(sorted(singularize(token) for token in tokens(value)))


def is_monster_heading(paragraph: Paragraph) -> bool:
    visible_runs = [run for run in paragraph.runs if run.text.strip()]
    return bool(
        clean_text(paragraph.text)
        and paragraph.alignment == WD_ALIGN_PARAGRAPH.CENTER
        and visible_runs
        and all(run.underline is True for run in visible_runs)
    )


def monster_name(heading: str) -> str:
    return re.sub(r"\s*\[[^\]]*\]\s*$", "", heading).strip()


def markdown_cell(value: str) -> str:
    return clean_text(value).replace("|", "\\|").replace("\n", "<br>")


def table_to_markdown(table: Table) -> str:
    rows = [[markdown_cell(cell.text) for cell in row.cells] for row in table.rows]
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    if width == 1:
        lines = clean_text(rows[0][0].replace("<br>", "\n")).splitlines()
        return "\n".join(f"> {line}" if line else ">" for line in lines)

    field_value_pairs = width % 2 == 0 and sum(
        1
        for row in rows
        for index in range(0, width, 2)
        if row[index].rstrip().endswith(":")
    ) >= max(1, len(rows) * width // 6)
    if field_value_pairs:
        header = ["Field" if index % 2 == 0 else "Value" for index in range(width)]
    else:
        header = [f"Column {index + 1}" for index in range(width)]
    output = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join("---" for _ in header) + " |",
    ]
    output.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(output)


def paragraph_to_markdown(paragraph: Paragraph, paragraph_number: int) -> str:
    raw = paragraph.text.replace("\r", "")
    text = clean_text(raw)
    if not text:
        return ""
    if is_monster_heading(paragraph):
        return f"## {text}"
    if paragraph_number == 0:
        return f"# {text}"
    if re.match(r"^Typical Stats(?:\s*[–—-].*)?$", text, flags=re.IGNORECASE):
        return f"### {text}"
    if re.fullmatch(r"-?\d[\d,]* points", text, flags=re.IGNORECASE):
        return f"*{text}*"

    label_match = re.match(r"^([^:]{1,60}):\s*(.*)$", text, flags=re.DOTALL)
    if label_match and label_match.group(1).strip().lower() in COMMON_LABELS:
        label, remainder = label_match.groups()
        return f"**{label.strip()}:**" + (f" {remainder}" if remainder else "")
    if raw.startswith("\t"):
        return f"- {text}"
    return text


def parse_srd_argument(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("SRD must be LABEL=PATH")
    label, path = value.split("=", 1)
    if not label.strip() or not path.strip():
        raise argparse.ArgumentTypeError("SRD must be LABEL=PATH")
    return label.strip(), Path(path).resolve()


def parse_alias(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("Alias must be FAN NAME=SRD NAME")
    fan_name, srd_name = value.split("=", 1)
    if not fan_name.strip() or not srd_name.strip():
        raise argparse.ArgumentTypeError("Alias must be FAN NAME=SRD NAME")
    return fan_name.strip(), srd_name.strip()


def load_srd_records(srd_arguments: list[tuple[str, Path]]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for edition, path in srd_arguments:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for monster in payload.get("monsters", []):
            records.append(
                {
                    "edition": edition,
                    "name": monster["name"],
                    "id": monster["id"],
                    "source": str(path),
                }
            )
    return records


def build_match_indexes(records: list[dict[str, str]]) -> dict[str, dict[Any, list[dict[str, str]]]]:
    indexes: dict[str, dict[Any, list[dict[str, str]]]] = {
        "exact": defaultdict(list),
        "word_order": defaultdict(list),
        "singular_plural": defaultdict(list),
    }
    for record in records:
        indexes["exact"][normalized(record["name"])].append(record)
        indexes["word_order"][word_key(record["name"])].append(record)
        indexes["singular_plural"][singular_key(record["name"])].append(record)
    return indexes


def add_matches(
    result: dict[tuple[str, str], dict[str, str]],
    records: list[dict[str, str]],
    method: str,
) -> None:
    for record in records:
        key = (record["edition"], record["id"])
        if key not in result:
            result[key] = {**record, "method": method}


def match_heading(
    name: str,
    indexes: dict[str, dict[Any, list[dict[str, str]]]],
    aliases: dict[str, str],
) -> list[dict[str, str]]:
    found: dict[tuple[str, str], dict[str, str]] = {}
    add_matches(found, indexes["exact"].get(normalized(name), []), "exact")
    add_matches(found, indexes["word_order"].get(word_key(name), []), "word-order")
    add_matches(found, indexes["singular_plural"].get(singular_key(name), []), "singular-plural")

    size_match = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", name)
    if size_match and size_match.group(2).strip().lower() in SIZE_QUALIFIERS:
        add_matches(
            found,
            indexes["exact"].get(normalized(size_match.group(1)), []),
            "size-variant",
        )

    alias_target = aliases.get(normalized(name))
    if alias_target:
        add_matches(found, indexes["exact"].get(normalized(alias_target), []), "explicit-alias")
    return sorted(found.values(), key=lambda item: (item["edition"], item["name"], item["id"]))


def escape_table(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def write_outputs(
    source: Path,
    output_dir: Path,
    author: str,
    blocks: list[dict[str, Any]],
    sections: list[dict[str, Any]],
    matches: list[dict[str, Any]],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    frontmatter = [
        "---",
        f"source: {json.dumps(source.name, ensure_ascii=False)}",
        f"source_author: {json.dumps(author, ensure_ascii=False)}",
        'status: "private-reference-only"',
        f"monster_sections: {len(sections)}",
        "---",
        "",
        "> Private working transcription. Preserve the original source attribution and do not publish without permission.",
        "",
    ]
    full_markdown = "\n\n".join(block["markdown"] for block in blocks if block["markdown"])
    (output_dir / "bestiary.md").write_text(
        "\n".join(frontmatter) + "\n" + full_markdown + "\n", encoding="utf-8"
    )
    (output_dir / "monster-index.json").write_text(
        json.dumps({"source": str(source), "sections": sections}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not matches:
        return

    unique_names = {normalized(match["doc_name"]) for match in matches}
    edition_counts: dict[str, int] = defaultdict(int)
    method_section_counts: Counter[str] = Counter()
    for match in matches:
        for edition in {record["edition"] for record in match["matches"]}:
            edition_counts[edition] += 1
        method_section_counts.update({record["method"] for record in match["matches"]})
    exact_sections = method_section_counts.get("exact", 0)
    controlled_only_sections = len(matches) - exact_sections

    report = [
        "# SRD overlap",
        "",
        f"- Matched conversion sections: {len(matches)}",
        f"- Unique matched fan names: {len(unique_names)}",
        f"- Exact-normalized sections: {exact_sections}",
        f"- Additional controlled-variant sections: {controlled_only_sections}",
    ]
    report.extend(f"- Sections matching {edition}: {count}" for edition, count in sorted(edition_counts.items()))
    report.extend(
        f"- Sections using {method}: {count}"
        for method, count in sorted(method_section_counts.items())
        if method != "exact"
    )
    report.extend(
        [
            "",
            "Matches are deterministic: exact normalization, word-order equivalence, singular/plural equivalence, recognized size variants, or explicit aliases supplied on the command line.",
            "",
            "| Fan monster | SRD match | Method | Source heading |",
            "| --- | --- | --- | --- |",
        ]
    )
    for match in matches:
        srd_text = "; ".join(
            f'{record["edition"]}: {record["name"]} (`{record["id"]}`)'
            for record in match["matches"]
        )
        methods = ", ".join(sorted({record["method"] for record in match["matches"]}))
        report.append(
            "| "
            + " | ".join(
                escape_table(value)
                for value in (match["doc_name"], srd_text, methods, match["heading"])
            )
            + " |"
        )
    (output_dir / "srd-overlap.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    (output_dir / "srd-overlap.json").write_text(
        json.dumps(
            {
                "source": str(source),
                "matched_sections": len(matches),
                "unique_matched_names": len(unique_names),
                "exact_normalized_sections": exact_sections,
                "controlled_variant_only_sections": controlled_only_sections,
                "method_section_counts": dict(sorted(method_section_counts.items())),
                "matches": matches,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    subset = [
        "# SRD-overlapping fan conversions",
        "",
        "> Private working subset derived from the attributed source document. SRD matching applies to monster identity only, not to the GURPS mechanics below.",
        "",
    ]
    for match in matches:
        subset.extend(
            block["markdown"]
            for block in blocks[match["block_start"] : match["block_end"]]
            if block["markdown"]
        )
        subset.append("")
    (output_dir / "srd-overlap-monsters.md").write_text(
        "\n\n".join(subset).rstrip() + "\n", encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("docx", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--author", default="Unknown")
    parser.add_argument("--srd", action="append", type=parse_srd_argument, default=[])
    parser.add_argument("--alias", action="append", type=parse_alias, default=[])
    args = parser.parse_args()

    source = args.docx.resolve()
    document = Document(source)
    blocks: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    paragraph_number = 0

    for item in document.iter_inner_content():
        if isinstance(item, Paragraph):
            heading = clean_text(item.text) if is_monster_heading(item) else None
            markdown = paragraph_to_markdown(item, paragraph_number)
            if heading:
                sections.append(
                    {
                        "name": monster_name(heading),
                        "heading": heading,
                        "paragraph": paragraph_number,
                        "block_start": len(blocks),
                    }
                )
            blocks.append({"markdown": markdown, "heading": heading})
            paragraph_number += 1
        elif isinstance(item, Table):
            blocks.append({"markdown": table_to_markdown(item), "heading": None})

    for index, section in enumerate(sections):
        section["block_end"] = (
            sections[index + 1]["block_start"] if index + 1 < len(sections) else len(blocks)
        )

    records = load_srd_records(args.srd)
    indexes = build_match_indexes(records)
    aliases = {normalized(fan): srd for fan, srd in args.alias}
    matches: list[dict[str, Any]] = []
    for section in sections:
        section_matches = match_heading(section["name"], indexes, aliases)
        if section_matches:
            matches.append({**section, "doc_name": section["name"], "matches": section_matches})

    write_outputs(source, args.output_dir.resolve(), args.author, blocks, sections, matches)
    summary = {
        "source": str(source),
        "paragraphs": paragraph_number,
        "tables": len(document.tables),
        "monster_sections": len(sections),
        "first_heading": sections[0]["heading"] if sections else None,
        "last_heading": sections[-1]["heading"] if sections else None,
        "matched_sections": len(matches),
        "output_dir": str(args.output_dir.resolve()),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

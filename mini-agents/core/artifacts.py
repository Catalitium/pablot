"""Artifact utilities for saving and loading JSON/Markdown artifacts."""

from __future__ import annotations

import json
import os
from typing import Any

from core.logger import logger


def get_next_id(prefix: str, directory: str) -> str:
    """Return next sequential artifact id like E-007."""
    os.makedirs(directory, exist_ok=True)
    max_num = 0
    for name in os.listdir(directory):
        if not name.startswith(prefix + "-"):
            continue
        stem = os.path.splitext(name)[0]
        try:
            num = int(stem.replace(prefix + "-", ""))
            if num > max_num:
                max_num = num
        except ValueError:
            continue
    return f"{prefix}-{max_num + 1:03d}"


def save_artifact(directory: str, file_id: str, data: Any) -> str:
    """Save JSON artifact and return absolute path."""
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"{file_id}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    logger.info("ARTIFACTS", f"Saved artifact {file_id} -> {path}")
    return path


def load_artifact(path: str) -> Any:
    """Load JSON artifact from path."""
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    logger.info("ARTIFACTS", f"Loaded artifact <- {path}")
    return data


def save_qa_markdown(report_id: str, data: dict, directory: str) -> str:
    """Save human-readable QA report markdown and return absolute path."""
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"{report_id}.md")

    lines = [
        f"# QA Report {report_id}",
        "",
        f"- Verdict: **{data.get('verdict', 'UNKNOWN')}**",
        f"- Score: **{data.get('score', 0)}/100**",
        f"- Ready for deployment: **{'Yes' if data.get('ready_for_deployment') else 'No'}**",
        "",
        "## Checklist",
    ]

    for item in data.get("checklist", []):
        lines.append(
            f"- [{item.get('status', 'unknown')}] {item.get('item', 'N/A')}: {item.get('details', '')}"
        )

    lines.extend(["", "## Issues"])
    issues = data.get("issues", [])
    if not issues:
        lines.append("- None")
    else:
        for issue in issues:
            lines.append(
                f"- [{issue.get('severity', 'unknown')}] {issue.get('description', 'N/A')} ({issue.get('location', 'N/A')})"
            )

    feedback = data.get("feedback_for_revision", {})
    lines.extend(
        [
            "",
            "## Feedback",
            f"- Target agent: {feedback.get('target_agent', 'none')}",
            f"- Message: {feedback.get('message', 'none')}",
        ]
    )

    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")

    logger.info("ARTIFACTS", f"Saved QA markdown {report_id} -> {path}")
    return path


"""Pipeline context dataclass for shared state across agents."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class PipelineContext:
    # Config
    config: dict
    target_codebase: str

    # Request
    request: str

    # Memory
    memory: dict

    # GitHub context
    github_context: dict

    # Agent outputs
    plan: Optional[dict] = None
    blueprint: Optional[dict] = None
    build: Optional[dict] = None
    qa_report: Optional[dict] = None

    # Execution tracking
    execution: Optional[dict] = None
    iteration: int = 0
    max_iterations: int = 3

    # Artifact IDs
    artifact_ids: Dict[str, Optional[str]] = field(
        default_factory=lambda: {
            "plan": None,
            "blueprint": None,
            "build": None,
            "qa": None,
        }
    )


"""Base agent interface for standardized lifecycle."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Tuple

from core.context import PipelineContext
from core.logger import logger


class BaseAgent(ABC):
    """Base class for all fleet agents."""

    name = "UNKNOWN"

    def run(self, ctx: PipelineContext) -> dict:
        """Standard lifecycle: section -> start -> execute -> end."""
        logger.section(f"{self.name} Agent Starting")
        logger.info(self.name, f"Beginning execution (iteration {ctx.iteration})")
        try:
            result = self.execute(ctx)
            logger.success(self.name, "Completed successfully")
            return result
        except Exception as exc:
            logger.error(self.name, f"Failed: {exc}")
            return {"status": "error", "error": str(exc), "agent": self.name}

    @abstractmethod
    def execute(self, ctx: PipelineContext) -> dict:
        """Execute agent logic."""
        raise NotImplementedError("execute must be implemented")

    def build_prompt(self, ctx: PipelineContext) -> Tuple[str, str]:
        """Return (system_prompt, user_prompt) for LLM calls."""
        raise NotImplementedError("build_prompt must be implemented")


"""Elena agent: deterministic discovery + planning with LLM refinement."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Dict, List, Tuple

from agents.base import BaseAgent
from agents.llm import chat_completion_json
from core.context import PipelineContext
from core.logger import logger


class ElenaAgent(BaseAgent):
    """Discovery and planning agent."""

    name = "ELENA"

    def build_prompt(self, ctx: PipelineContext) -> Tuple[str, str]:
        system_prompt = (
            "You are Elena, a codebase discovery agent. Analyze repos and return one actionable plan. "
            "Return ONLY valid JSON matching this schema: "
            "{"
            "\"selected_project\":\"folder-name\","
            "\"selected_repo_path\":\"full/path/to/repo\","
            "\"request_summary\":\"what we will do\","
            "\"goals\":[\"goal1\",\"goal2\"],"
            "\"constraints\":[\"constraint1\"],"
            "\"success_criteria\":[\"criterion1\"]"
            "}. "
            "No markdown fences. No explanations."
        )

        user_prompt = (
            f"Request:\n{ctx.request}\n\n"
            f"Deterministic analysis candidate:\n{ctx.plan}\n\n"
            "Refine goals and summary while preserving selected repo."
        )
        return system_prompt, user_prompt

    def execute(self, ctx: PipelineContext) -> dict:
        logger.info(self.name, "Reading operator request")
        repos = ctx.github_context.get("repos", [])
        if not repos:
            raise RuntimeError("No repositories discovered in github_context")

        evaluations = []
        for repo in repos:
            path = str(repo.get("path", "")).strip()
            if not path or not os.path.isdir(path):
                continue
            eval_result = self._evaluate_repo(path, repo)
            evaluations.append(eval_result)
            logger.info(
                self.name,
                f"Evaluated {eval_result['name']}: dirty={eval_result['dirty']}, commits={eval_result['recent_commits']}, tests={eval_result['has_tests']}, ci={eval_result['has_ci']}, readme={eval_result['has_readme']}",
            )

        if not evaluations:
            raise RuntimeError("No valid repositories were evaluated")

        selected = self._select_repo(evaluations)
        logger.info(self.name, f"Selected repo: {selected['name']} ({selected['path']})")

        goals = self._derive_goals(selected)
        constraints = ["Don't break existing functionality", "Keep changes small and reversible"]
        success_criteria = ["Planned files are created/updated", "Tests run successfully"]

        deterministic_plan = {
            "status": "ok",
            "selected_project": selected["name"],
            "selected_repo_path": selected["path"],
            "request_summary": f"Improve {selected['name']} based on request and current repo state",
            "goals": goals,
            "repo_analysis": {
                "files_found": selected["files_found"],
                "has_tests": selected["has_tests"],
                "has_ci": selected["has_ci"],
                "has_readme": selected["has_readme"],
                "recent_commits": selected["recent_commits"],
            },
            "constraints": constraints,
            "success_criteria": success_criteria,
        }

        # Keep deterministic output as source of truth; LLM only refines text fields.
        ctx.plan = deterministic_plan
        system_prompt, user_prompt = self.build_prompt(ctx)
        try:
            refined = chat_completion_json(system_prompt, user_prompt, temperature=0.3)
            if isinstance(refined, dict):
                goals_refined = refined.get("goals")
                if isinstance(goals_refined, list) and goals_refined:
                    deterministic_plan["goals"] = [str(g).strip() for g in goals_refined if str(g).strip()]
                summary = str(refined.get("request_summary", "")).strip()
                if summary:
                    deterministic_plan["request_summary"] = summary
                constraints_refined = refined.get("constraints")
                if isinstance(constraints_refined, list) and constraints_refined:
                    deterministic_plan["constraints"] = [str(c).strip() for c in constraints_refined if str(c).strip()]
                success_refined = refined.get("success_criteria")
                if isinstance(success_refined, list) and success_refined:
                    deterministic_plan["success_criteria"] = [str(c).strip() for c in success_refined if str(c).strip()]
        except Exception as exc:
            logger.error(self.name, f"LLM refinement failed, using deterministic plan: {exc}")

        logger.info(self.name, f"Final goals: {deterministic_plan['goals']}")
        return deterministic_plan

    def _evaluate_repo(self, path: str, repo_meta: dict) -> dict:
        top_files = self._list_files(path)
        has_tests = self._has_tests(path, top_files)
        has_ci = os.path.isdir(os.path.join(path, ".github", "workflows"))
        has_readme = os.path.isfile(os.path.join(path, "README.md"))
        commits = repo_meta.get("recent_commits", [])
        status_sample = repo_meta.get("status_sample", [])

        return {
            "name": os.path.basename(path.rstrip("\\/")),
            "path": path,
            "files_found": top_files,
            "has_tests": has_tests,
            "has_ci": has_ci,
            "has_readme": has_readme,
            "recent_commits": len(commits) if isinstance(commits, list) else 0,
            "dirty": bool(status_sample),
        }

    def _list_files(self, path: str) -> List[str]:
        collected = []
        for root, _, files in os.walk(path):
            rel_root = os.path.relpath(root, path)
            depth = 0 if rel_root == "." else rel_root.count(os.sep) + 1
            if depth > 2:
                continue
            for filename in files:
                rel = os.path.relpath(os.path.join(root, filename), path)
                collected.append(rel)
            if len(collected) >= 120:
                break
        collected.sort()
        return collected[:120]

    def _has_tests(self, path: str, files_found: List[str]) -> bool:
        if os.path.isdir(os.path.join(path, "tests")):
            return True
        for rel in files_found:
            base = os.path.basename(rel).lower()
            if base.startswith("test_") and base.endswith(".py"):
                return True
        return False

    def _select_repo(self, evaluations: List[dict]) -> dict:
        # Priority: dirty repos first, then lowest commit count (most neglected), then fewer files.
        sorted_repos = sorted(
            evaluations,
            key=lambda r: (
                0 if r["dirty"] else 1,
                r["recent_commits"],
                len(r["files_found"]),
                r["name"],
            ),
        )
        return sorted_repos[0]

    def _derive_goals(self, selected: dict) -> List[str]:
        goals = []
        if not selected["has_tests"]:
            goals.append("add tests")
        if not selected["has_ci"]:
            goals.append("add CI workflow")
        if not selected["has_readme"]:
            goals.append("add README")
        if not goals:
            goals.append("improve error handling in main python modules")
        return goals

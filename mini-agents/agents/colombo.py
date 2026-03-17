"""Colombo agent: requirements and architecture with deterministic blueprint fallback."""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

from agents.base import BaseAgent
from agents.llm import chat_completion_json
from core.context import PipelineContext
from core.logger import logger
from integrations import github_api
from integrations.git_ops import run_git


class ColomboAgent(BaseAgent):
    """Requirements and architecture agent."""

    name = "COLOMBO"

    def build_prompt(self, ctx: PipelineContext) -> Tuple[str, str]:
        system_prompt = (
            "You are Colombo, architecture agent. Return ONLY valid JSON: "
            "{"
            "\"target_repo_path\":\"C:\\\\...\\\\repo\","
            "\"suggested_branch_name\":\"fleet/add-tests-repo\","
            "\"file_changes\":[{\"path\":\"tests/test_main.py\",\"action\":\"create\",\"description\":\"...\",\"template\":\"pytest\"}],"
            "\"test_commands\":[\"python -m pytest tests/ -v\"],"
            "\"github_integration\":{\"issues\":[{\"title\":\"...\",\"body\":\"...\",\"labels\":[\"enhancement\"]}],\"actions\":[]},"
            "\"status\":\"ok\""
            "}. "
            "No markdown fences."
        )

        user_prompt = (
            f"Plan:\n{ctx.plan}\n\n"
            "Refine the deterministic blueprint while preserving target repo and actionable file_changes."
        )
        return system_prompt, user_prompt

    def execute(self, ctx: PipelineContext) -> dict:
        plan = ctx.plan or {}
        required = ["selected_project", "selected_repo_path", "goals"]
        missing = [k for k in required if k not in plan]
        if missing:
            raise RuntimeError(f"Missing required plan fields: {missing}")

        repo_path = str(plan["selected_repo_path"]).strip()
        goals = [str(g).lower().strip() for g in plan.get("goals", []) if str(g).strip()]
        if not goals:
            goals = ["add tests"]

        file_changes = self._build_file_changes(repo_path, goals)
        if not file_changes:
            file_changes = [
                {
                    "path": "README.md",
                    "action": "create",
                    "description": "Create README with project overview and usage",
                    "template": "readme",
                }
            ]

        for change in file_changes:
            logger.info(self.name, f"Planned change: {change['action']} {change['path']} ({change['description']})")

        branch = self._branch_name(plan.get("selected_project", "repo"), goals)
        test_commands = self._derive_test_commands(file_changes, repo_path)

        blueprint = {
            "status": "ok",
            "target_repo_path": repo_path,
            "suggested_branch_name": branch,
            "file_changes": file_changes,
            "test_commands": test_commands,
            "github_integration": {
                "issues": self._default_issues(plan, goals),
                "actions": [],
            },
        }

        # LLM refinement is optional. Deterministic blueprint remains valid if refinement fails.
        ctx.blueprint = blueprint
        system_prompt, user_prompt = self.build_prompt(ctx)
        try:
            refined = chat_completion_json(system_prompt, user_prompt, temperature=0.2)
            if isinstance(refined, dict):
                refined_changes = refined.get("file_changes")
                if isinstance(refined_changes, list) and refined_changes:
                    normalized = self._normalize_file_changes(refined_changes)
                    if normalized:
                        blueprint["file_changes"] = normalized
                refined_tests = refined.get("test_commands")
                if isinstance(refined_tests, list) and refined_tests:
                    blueprint["test_commands"] = [str(x).strip() for x in refined_tests if str(x).strip()]
        except Exception as exc:
            logger.error(self.name, f"LLM refinement failed, using deterministic blueprint: {exc}")

        if ctx.config.get("execution", {}).get("create_github_issues", True):
            created = self._create_issues(ctx, blueprint)
            if created:
                logger.info(self.name, f"Created {len(created)} GitHub issue(s)")
                blueprint["issues_created"] = created

        ctx.blueprint = blueprint
        return blueprint

    def _build_file_changes(self, repo_path: str, goals: List[str]) -> List[dict]:
        changes: List[dict] = []
        py_files = self._main_python_files(repo_path)

        for goal in goals:
            if "test" in goal:
                changes.append(
                    {
                        "path": "tests/test_main.py",
                        "action": "create",
                        "description": "Create pytest test file for main module",
                        "template": "pytest",
                    }
                )
            if "ci" in goal or "workflow" in goal:
                changes.append(
                    {
                        "path": ".github/workflows/ci.yml",
                        "action": "create",
                        "description": "Create Python CI workflow with pytest",
                        "template": "ci",
                    }
                )
            if "readme" in goal:
                changes.append(
                    {
                        "path": "README.md",
                        "action": "create",
                        "description": "Create project README with setup and usage",
                        "template": "readme",
                    }
                )
            if "error handling" in goal:
                for py in py_files:
                    changes.append(
                        {
                            "path": py,
                            "action": "modify",
                            "description": "Improve error handling in this module",
                            "template": "error_handling",
                        }
                    )

        unique = {}
        for item in changes:
            key = (item["path"], item["action"])
            if key not in unique:
                unique[key] = item
        return list(unique.values())

    def _main_python_files(self, repo_path: str) -> List[str]:
        if not os.path.isdir(repo_path):
            return []
        candidates = []
        for name in os.listdir(repo_path):
            full = os.path.join(repo_path, name)
            if os.path.isfile(full) and name.endswith(".py") and not name.startswith("test_"):
                candidates.append(name)
        candidates.sort()
        return candidates[:3]

    def _branch_name(self, project: str, goals: List[str]) -> str:
        slug_project = self._slug(project)
        goal = goals[0] if goals else "improvement"
        slug_goal = self._slug(goal)[:24]
        return f"fleet/{slug_goal}-{slug_project}"

    def _slug(self, text: str) -> str:
        cleaned = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in text.lower())
        while "--" in cleaned:
            cleaned = cleaned.replace("--", "-")
        return cleaned.strip("-") or "repo"

    def _derive_test_commands(self, file_changes: List[dict], repo_path: str) -> List[str]:
        has_tests_goal = any(change.get("template") == "pytest" for change in file_changes)
        commands = []
        if has_tests_goal:
            commands.append("python -m pytest tests/ -v")
        else:
            main_py = self._main_python_files(repo_path)
            if main_py:
                commands.append(f"python {main_py[0]}")
        return commands

    def _default_issues(self, plan: dict, goals: List[str]) -> List[dict]:
        title_goal = goals[0] if goals else "improvement"
        return [
            {
                "title": f"Fleet task: {title_goal}",
                "body": f"Automated requirement mapping for request: {plan.get('request_summary', '')}",
                "labels": ["enhancement", "fleet"],
            }
        ]

    def _normalize_file_changes(self, changes: List[dict]) -> List[dict]:
        normalized = []
        for item in changes:
            path = str(item.get("path", "")).strip()
            action = str(item.get("action", "")).strip().lower()
            desc = str(item.get("description", "")).strip()
            template = str(item.get("template", "")).strip() if item.get("template") else ""
            if not path or action not in {"create", "modify"}:
                continue
            row = {"path": path, "action": action, "description": desc or "Planned change"}
            if template:
                row["template"] = template
            normalized.append(row)
        return normalized

    def _create_issues(self, ctx: PipelineContext, blueprint: dict) -> List[dict]:
        repo_path = blueprint.get("target_repo_path", "")
        owner = str(ctx.config.get("github", {}).get("owner", "")).strip() or "JPGBMR"
        repo_name = os.path.basename(str(repo_path).rstrip("\\/"))

        ok, remote = run_git(["remote", "get-url", "origin"], cwd=repo_path)
        if ok and remote:
            parsed_owner, parsed_repo = github_api.parse_owner_repo_from_remote(remote)
            if parsed_owner and parsed_repo:
                owner, repo_name = parsed_owner, parsed_repo

        created = []
        for issue in blueprint.get("github_integration", {}).get("issues", []):
            title = str(issue.get("title", "")).strip()
            if not title:
                continue
            body = str(issue.get("body", "")).strip()
            labels = issue.get("labels", [])
            result = github_api.create_issue(owner, repo_name, title, body, labels)
            if result:
                created.append(result)
        return created

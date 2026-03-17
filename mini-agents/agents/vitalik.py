"""Vitalik agent: write code, run tests, commit/push, and produce execution evidence."""

from __future__ import annotations

import os
import shlex
import subprocess
from datetime import datetime
from typing import Dict, List, Tuple

from agents.base import BaseAgent
from agents.llm import chat_completion
from core.context import PipelineContext
from core.logger import logger
from integrations import github_actions
from integrations import github_api
from integrations import git_ops


class VitalikAgent(BaseAgent):
    """Builder and delivery agent."""

    name = "VITALIK"

    def build_prompt(self, ctx: PipelineContext) -> Tuple[str, str]:
        system_prompt = (
            "You are Vitalik, coding agent. Return ONLY complete file content, no markdown fences, no explanations. "
            "If modifying a file, preserve behavior and apply requested change safely."
        )
        user_prompt = "Generate content"
        return system_prompt, user_prompt

    def execute(self, ctx: PipelineContext) -> dict:
        blueprint = ctx.blueprint or {}
        required = ["target_repo_path", "file_changes", "suggested_branch_name"]
        missing = [k for k in required if k not in blueprint]
        if missing:
            raise RuntimeError(f"Missing required blueprint fields: {missing}")

        repo_path = str(blueprint["target_repo_path"]).strip()
        file_changes = blueprint.get("file_changes", [])
        if not isinstance(file_changes, list) or not file_changes:
            raise RuntimeError("Blueprint has no file_changes to execute")

        build_id = str(ctx.artifact_ids.get("build") or "V-000")
        branch_name = self._deterministic_branch(ctx, blueprint, build_id)

        ensure = git_ops.ensure_repo(repo_path, allow_init=bool(ctx.config.get("execution", {}).get("allow_repo_init", True)))
        if not ensure.get("success"):
            raise RuntimeError(f"Repo setup failed: {ensure.get('message')}")

        branch_result = {"success": True, "branch": branch_name, "message": "branch skipped"}
        if ctx.config.get("execution", {}).get("create_feature_branch", True):
            auto_push = bool(ctx.config.get("execution", {}).get("auto_push", False))
            branch_result = git_ops.create_branch(repo_path, branch_name, auto_pull_main=auto_push)
            if not branch_result.get("success"):
                raise RuntimeError(f"Branch creation failed: {branch_result.get('message')}")

        files_map: Dict[str, str] = {}
        files_written: List[dict] = []

        for file_change in file_changes:
            path = str(file_change.get("path", "")).strip()
            action = str(file_change.get("action", "create")).strip().lower()
            description = str(file_change.get("description", "")).strip()
            template = str(file_change.get("template", "")).strip().lower()

            if not path or action not in {"create", "modify"}:
                files_written.append({"path": path, "bytes": 0, "status": "error", "error": "Invalid path/action"})
                continue

            full_path = self._safe_join(repo_path, path)
            current_content = ""
            if action == "modify" and os.path.isfile(full_path):
                with open(full_path, "r", encoding="utf-8") as handle:
                    current_content = handle.read()

            content = self._generate_file_content_with_llm(path, action, description, current_content)
            if content is None:
                content = self._fallback_file_content(repo_path, path, action, description, template, current_content)

            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as handle:
                handle.write(content)

            files_map[path] = content
            files_written.append({"path": path, "bytes": len(content.encode("utf-8")), "status": "ok"})
            logger.info(self.name, f"WROTE FILE: {full_path} ({len(content.encode('utf-8'))} bytes)")

        logger.info(self.name, "Git status after writes:")
        ok_status, status_out = git_ops.run_git(["status", "--porcelain"], cwd=repo_path)
        logger.info(self.name, status_out if ok_status else "(failed to read git status)")
        if ok_status and not status_out.strip():
            logger.error(self.name, "WARNING: No git changes detected after writing files")

        test_commands = self._resolve_test_commands(blueprint, repo_path)
        test_results = []
        if ctx.config.get("execution", {}).get("run_local_tests", True):
            test_results = self._run_tests(repo_path, test_commands)

        commit = {"success": False, "sha": None, "message": "commit disabled"}
        push = {"success": False, "message": "push disabled"}

        if ctx.config.get("execution", {}).get("auto_commit", True):
            if ok_status and status_out.strip():
                commit_message = self._commit_message(ctx, files_written, build_id)
                commit = git_ops.commit_all(repo_path, commit_message)
            else:
                commit = {"success": False, "sha": None, "message": "No changes to commit"}

        if ctx.config.get("execution", {}).get("auto_push", False) and commit.get("success"):
            push = git_ops.push(repo_path)

        owner, repo = self._resolve_owner_repo(ctx, repo_path)

        gha = {"triggered": False, "workflow": None, "message": "disabled"}
        if ctx.config.get("execution", {}).get("trigger_github_actions", False) and owner and repo:
            workflow_id = self._workflow_id_from_blueprint(blueprint)
            ref = branch_result.get("branch") or branch_name
            result = github_actions.trigger_workflow(owner, repo, workflow_id, ref=ref, inputs=None)
            gha = {
                "triggered": bool(result.get("triggered")),
                "workflow": workflow_id,
                "message": result.get("message", ""),
            }

        issues_created = self._create_test_failure_issues(ctx, owner, repo, test_results)

        execution = {
            "repo_path": repo_path,
            "branch": branch_result.get("branch") or branch_name,
            "owner": owner,
            "repo": repo,
            "files_written": files_written,
            "test_results": test_results,
            "commit": commit,
            "push": push,
            "github_actions": gha,
            "issues_created": issues_created,
        }

        build = {
            "status": "ok",
            "files": files_map,
            "test_commands": test_commands,
            "execution": execution,
        }

        ctx.build = build
        ctx.execution = execution
        return build

    def _slug(self, text: str) -> str:
        cleaned = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in text.lower().strip())
        while "--" in cleaned:
            cleaned = cleaned.replace("--", "-")
        return cleaned.strip("-") or "repo"

    def _deterministic_branch(self, ctx: PipelineContext, blueprint: dict, build_id: str) -> str:
        prefix = str(ctx.config.get("execution", {}).get("branch_prefix", "fleet")).strip() or "fleet"
        project = str((ctx.plan or {}).get("selected_project", "repo")).strip() or "repo"
        suggested = str(blueprint.get("suggested_branch_name", "")).strip()
        if suggested:
            # Keep deterministic contract: {prefix}/{slug}-{build_id}
            return f"{prefix}/{self._slug(project)}-{build_id.lower()}"
        return f"{prefix}/{self._slug(project)}-{build_id.lower()}"

    def _safe_join(self, repo_path: str, rel_path: str) -> str:
        base = os.path.normpath(repo_path)
        full = os.path.normpath(os.path.join(base, rel_path))
        if os.path.commonpath([base, full]) != base:
            raise RuntimeError(f"Invalid path escape: {rel_path}")
        return full

    def _generate_file_content_with_llm(
        self,
        path: str,
        action: str,
        description: str,
        current_content: str,
    ) -> str | None:
        system_prompt, _ = self.build_prompt(None)  # type: ignore[arg-type]
        user_prompt = (
            f"Target file path: {path}\n"
            f"Action: {action}\n"
            f"Description: {description}\n\n"
            "If action is modify, current file content is below:\n"
            "----- CURRENT CONTENT START -----\n"
            f"{current_content}\n"
            "----- CURRENT CONTENT END -----\n\n"
            "Return ONLY the complete file content, no markdown, no explanation."
        )
        try:
            content = chat_completion(system_prompt, user_prompt, temperature=0.2, max_tokens=4096)
            cleaned = content.strip()
            if cleaned.startswith("```"):
                lines = cleaned.splitlines()
                lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                cleaned = "\n".join(lines).strip()
            return cleaned
        except Exception as exc:
            logger.error(self.name, f"LLM file generation failed for {path}, using template fallback: {exc}")
            return None

    def _fallback_file_content(
        self,
        repo_path: str,
        path: str,
        action: str,
        description: str,
        template: str,
        current_content: str,
    ) -> str:
        lower_path = path.lower()
        repo_name = os.path.basename(repo_path.rstrip("\\/"))

        if template == "pytest" or "test" in lower_path:
            module = self._guess_main_module(repo_path)
            return (
                "import importlib\n\n"
                f"def test_module_imports():\n"
                f"    module = importlib.import_module(\"{module}\")\n"
                "    assert module is not None\n\n"
                "def test_smoke():\n"
                "    assert True\n"
            )

        if template == "ci" or lower_path.endswith(".github/workflows/ci.yml") or lower_path.endswith(".github\\workflows\\ci.yml"):
            return (
                "name: CI\n\n"
                "on:\n"
                "  push:\n"
                "    branches: [main]\n"
                "  pull_request:\n"
                "    branches: [main]\n\n"
                "jobs:\n"
                "  test:\n"
                "    runs-on: ubuntu-latest\n"
                "    steps:\n"
                "      - name: Checkout\n"
                "        uses: actions/checkout@v4\n"
                "      - name: Setup Python\n"
                "        uses: actions/setup-python@v5\n"
                "        with:\n"
                "          python-version: '3.10'\n"
                "      - name: Install deps\n"
                "        run: |\n"
                "          python -m pip install --upgrade pip\n"
                "          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi\n"
                "          pip install pytest\n"
                "      - name: Run tests\n"
                "        run: |\n"
                "          if [ -d tests ]; then python -m pytest tests/ -v --tb=short; else echo 'No tests dir yet'; fi\n"
            )

        if template == "readme" or lower_path.endswith("readme.md"):
            return (
                f"# {repo_name}\n\n"
                "## Description\n"
                "This project is maintained by Mini-Agents Fleet v2.\n\n"
                "## Installation\n"
                "```bash\n"
                "python -m pip install -r requirements.txt\n"
                "```\n\n"
                "## Usage\n"
                "```bash\n"
                "python main.py\n"
                "```\n"
            )

        if lower_path.endswith(".py") and action == "modify":
            return self._add_basic_error_handling(current_content)

        if lower_path.endswith(".py"):
            return (
                "def main():\n"
                "    try:\n"
                "        print('Hello from fleet-generated module')\n"
                "    except Exception as exc:\n"
                "        print(f'Runtime error: {exc}')\n\n"
                "if __name__ == '__main__':\n"
                "    main()\n"
            )

        return f"# Generated by Vitalik\n# Description: {description}\n"

    def _add_basic_error_handling(self, current_content: str) -> str:
        if not current_content.strip():
            return (
                "def main():\n"
                "    try:\n"
                "        pass\n"
                "    except Exception as exc:\n"
                "        print(f'Error: {exc}')\n\n"
                "if __name__ == '__main__':\n"
                "    main()\n"
            )

        if "try:" in current_content and "except Exception" in current_content:
            return current_content

        lines = current_content.splitlines()
        indented = ["    " + line if line.strip() else "" for line in lines]
        wrapped = [
            "def _fleet_safe_wrapper():",
            "    try:",
            *["    " + line for line in indented],
            "    except Exception as exc:",
            "        print(f'Error: {exc}')",
            "",
            "if __name__ == '__main__':",
            "    _fleet_safe_wrapper()",
        ]
        return "\n".join(wrapped) + "\n"

    def _guess_main_module(self, repo_path: str) -> str:
        for name in os.listdir(repo_path):
            if name.endswith(".py") and not name.startswith("test_"):
                return os.path.splitext(name)[0]
        return "main"

    def _resolve_test_commands(self, blueprint: dict, repo_path: str) -> List[str]:
        commands = blueprint.get("test_commands", [])
        normalized = [str(c).strip() for c in commands if str(c).strip()]
        if normalized:
            return normalized

        tests_dir = os.path.join(repo_path, "tests")
        if os.path.isdir(tests_dir):
            return ["python -m pytest tests/ -v --tb=short"]
        return []

    def _run_tests(self, repo_path: str, test_commands: List[str]) -> List[dict]:
        results = []
        for cmd in test_commands:
            logger.info(self.name, f"Running test command: {cmd}")
            try:
                args = shlex.split(cmd, posix=False)
                proc = subprocess.run(
                    args,
                    cwd=repo_path,
                    shell=False,
                    capture_output=True,
                    text=True,
                    timeout=240,
                    check=False,
                )
                output = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
                results.append(
                    {
                        "command": cmd,
                        "success": proc.returncode == 0,
                        "output": output[:8000],
                    }
                )
            except Exception as exc:
                results.append({"command": cmd, "success": False, "output": str(exc)})
        return results

    def _commit_message(self, ctx: PipelineContext, files_written: List[dict], build_id: str) -> str:
        goals = (ctx.plan or {}).get("goals", [])
        first_goal = str(goals[0]).strip() if goals else "automated improvement"
        lines = [
            f"feat(fleet): {first_goal}",
            "",
            "Files changed:",
        ]
        for item in files_written:
            if item.get("status") == "ok":
                lines.append(f"- {item.get('path')}")
        lines.append("")
        lines.append(f"Agent: Vitalik v2 | Run: {build_id}")
        return "\n".join(lines)

    def _resolve_owner_repo(self, ctx: PipelineContext, repo_path: str) -> Tuple[str, str]:
        owner = str(ctx.config.get("github", {}).get("owner", "")).strip() or "JPGBMR"
        repo = os.path.basename(repo_path.rstrip("\\/"))
        ok, remote = git_ops.run_git(["remote", "get-url", "origin"], cwd=repo_path)
        if ok and remote:
            parsed_owner, parsed_repo = github_api.parse_owner_repo_from_remote(remote)
            if parsed_owner and parsed_repo:
                return parsed_owner, parsed_repo
        return owner, repo

    def _workflow_id_from_blueprint(self, blueprint: dict) -> str:
        actions = blueprint.get("github_integration", {}).get("actions", [])
        if actions and isinstance(actions[0], dict):
            wf = str(actions[0].get("workflow_id", "")).strip()
            if wf:
                return wf
        return "ci.yml"

    def _create_test_failure_issues(self, ctx: PipelineContext, owner: str, repo: str, test_results: List[dict]) -> List[dict]:
        if not owner or not repo:
            return []
        if not ctx.config.get("execution", {}).get("create_github_issues", True):
            return []

        failures = [res for res in test_results if not res.get("success")]
        if not failures:
            return []

        body_lines = ["One or more local tests failed during Vitalik execution.", ""]
        for res in failures:
            body_lines.append(f"- Command: `{res.get('command')}`")
            body_lines.append(f"  Output:\n{str(res.get('output', ''))[:1000]}")

        issue = github_api.create_issue(
            owner,
            repo,
            "Fleet: local test failures during automated run",
            "\n".join(body_lines),
            ["bug", "fleet"],
        )
        return [issue] if issue else []

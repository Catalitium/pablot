"""Athena agent: deterministic QA and feedback routing."""

from __future__ import annotations

from typing import List

from agents.base import BaseAgent
from core.context import PipelineContext
from core.logger import logger
from integrations import github_actions
from integrations import github_api


class AthenaAgent(BaseAgent):
    """QA and DevOps agent."""

    name = "ATHENA"

    def execute(self, ctx: PipelineContext) -> dict:
        blueprint = ctx.blueprint or {}
        build = ctx.build or {}
        execution = build.get("execution", {}) if isinstance(build, dict) else {}

        required_blueprint = ["target_repo_path", "file_changes", "test_commands"]
        missing_blueprint = [k for k in required_blueprint if k not in blueprint]
        if missing_blueprint:
            raise RuntimeError(f"Missing required blueprint fields: {missing_blueprint}")

        required_build = ["status", "files", "test_commands", "execution"]
        missing_build = [k for k in required_build if k not in build]
        if missing_build:
            raise RuntimeError(f"Missing required build fields: {missing_build}")

        checklist = self._checklist(blueprint, build, execution, ctx)
        for item in checklist:
            logger.info(self.name, f"{item['item']}: {item['status'].upper()} - {item['details']}")

        pass_count = sum(1 for i in checklist if i["status"] == "pass")
        score = int((pass_count / len(checklist)) * 100) if checklist else 0

        failed_items = [i for i in checklist if i["status"] == "fail"]
        if not failed_items:
            verdict = "PASS"
            next_iteration = False
            target_agent = "vitalik"
            message = "All checks passed"
        else:
            verdict = "FAIL"
            next_iteration = True
            target_agent = "vitalik"
            message = "Fix failed QA checks in implementation and execution"

        issues = [
            {
                "severity": "high",
                "description": f"Failed check: {item['item']}",
                "location": "qa.checklist",
                "fix": item["details"],
            }
            for item in failed_items
        ]

        # Trigger CI verification only if local tests passed but CI was not triggered yet.
        ci_trigger_info = {"triggered": False, "message": "not needed"}
        tests_ok = all(r.get("success") for r in execution.get("test_results", [])) if execution.get("test_results") else False
        ci_triggered = bool(execution.get("github_actions", {}).get("triggered"))
        if tests_ok and not ci_triggered and ctx.config.get("execution", {}).get("trigger_github_actions", False):
            owner = execution.get("owner", "")
            repo = execution.get("repo", "")
            branch = execution.get("branch", "main")
            if owner and repo:
                ci_trigger_info = github_actions.trigger_workflow(owner, repo, "ci.yml", ref=branch, inputs=None)

        issues_created = []
        # Do not issue-spam when no work was done. Only create issues for actual code quality problems.
        files_written = execution.get("files_written", [])
        has_real_written_files = any(f.get("status") == "ok" for f in files_written)
        if has_real_written_files and ctx.config.get("execution", {}).get("create_github_issues", True):
            owner = execution.get("owner", "")
            repo = execution.get("repo", "")
            if owner and repo:
                for issue in issues:
                    # only create issue for code-quality style problems, not pipeline/no-work failures
                    desc = issue.get("description", "").lower()
                    if "no work" in desc or "missing required" in desc:
                        continue
                    result = github_api.create_issue(
                        owner,
                        repo,
                        f"Fleet QA: {issue['description']}",
                        f"Fix: {issue['fix']}",
                        ["qa", "fleet"],
                    )
                    if result:
                        issues_created.append(result)

        report = {
            "status": "ok",
            "verdict": verdict,
            "score": score,
            "checklist": checklist,
            "issues": issues,
            "improvements": self._improvements(checklist),
            "feedback_for_revision": {
                "target_agent": target_agent,
                "message": message,
                "priority_fixes": [item["item"] for item in failed_items],
            },
            "ready_for_deployment": verdict == "PASS",
            "next_iteration_needed": next_iteration,
            "ci_verification_trigger": ci_trigger_info,
            "issues_created": issues_created,
        }

        ctx.qa_report = report
        return report

    def _checklist(self, blueprint: dict, build: dict, execution: dict, ctx: PipelineContext) -> List[dict]:
        file_changes = blueprint.get("file_changes", [])
        file_map = build.get("files", {})
        files_written = execution.get("files_written", [])
        tests = execution.get("test_results", [])
        commit = execution.get("commit", {})
        push = execution.get("push", {})
        gha = execution.get("github_actions", {})

        expected_paths = [c.get("path") for c in file_changes if c.get("path")]
        produced_paths = list(file_map.keys()) if isinstance(file_map, dict) else []

        req_match = all(path in produced_paths for path in expected_paths)
        quality_ok = all("TODO" not in str(content) and "..." not in str(content) for content in file_map.values()) if isinstance(file_map, dict) else False
        test_ok = bool(tests) and all(t.get("success") for t in tests)
        branch_ok = bool(execution.get("branch"))
        commit_ok = bool(commit.get("success"))

        push_required = bool(ctx.config.get("execution", {}).get("auto_push", False))
        push_ok = bool(push.get("success")) if push_required else True

        ci_required = bool(ctx.config.get("execution", {}).get("trigger_github_actions", False))
        ci_ok = bool(gha.get("triggered")) if ci_required else True

        deployment_safe = req_match and quality_ok and (test_ok or not tests)

        return [
            {
                "item": "requirements match",
                "status": "pass" if req_match else "fail",
                "details": f"expected={len(expected_paths)}, produced={len(produced_paths)}",
            },
            {
                "item": "code quality",
                "status": "pass" if quality_ok else "fail",
                "details": "No TODO/ellipsis placeholders in generated files",
            },
            {
                "item": "test evidence",
                "status": "pass" if test_ok else "fail",
                "details": f"tests_run={len(tests)}",
            },
            {
                "item": "branch and commit",
                "status": "pass" if branch_ok and commit_ok else "fail",
                "details": f"branch={execution.get('branch','')}, commit={commit.get('message','')}",
            },
            {
                "item": "ci/cd readiness",
                "status": "pass" if push_ok and ci_ok else "fail",
                "details": f"push_ok={push_ok}, ci_ok={ci_ok}",
            },
            {
                "item": "deployment safety",
                "status": "pass" if deployment_safe else "fail",
                "details": "Core checks must pass before deployment",
            },
        ]

    def _improvements(self, checklist: List[dict]) -> List[str]:
        improvements = []
        for item in checklist:
            if item["status"] == "fail":
                improvements.append(f"Improve: {item['item']}")
        if not improvements:
            improvements.append("No blocking improvements required")
        return improvements

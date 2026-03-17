"""Mini-Agents Fleet v2 orchestrator with strict schema handoffs and environment checks."""

from __future__ import annotations

import json
import os
import time
from typing import Dict

from dotenv import load_dotenv

from agents.athena import AthenaAgent
from agents.colombo import ColomboAgent
from agents.elena import ElenaAgent
from agents.vitalik import VitalikAgent
from core.artifacts import get_next_id, save_artifact, save_qa_markdown
from core.context import PipelineContext
from core.logger import logger
from integrations import git_ops

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config", "pipeline.json")

DEFAULT_CONFIG = {
    "target_codebase": r"C:\Users\catal\Desktop\code-base",
    "max_iterations": 3,
    "pipeline_stages": ["elena", "colombo", "vitalik", "athena"],
    "github_context": {"max_repos": 12, "max_status_lines": 10, "max_commits": 3},
    "github": {"owner": "JPGBMR", "default_repo": "", "token_env_var": "GITHUB_TOKEN"},
    "directories": {
        "memory": "memory",
        "incoming": "incoming",
        "artifacts": "artifacts",
        "logs": "logs",
    },
    "artifact_subdirs": {
        "plans": "plans",
        "blueprints": "blueprints",
        "builds": "builds",
        "qa_reports": "qa-reports",
    },
    "execution": {
        "create_feature_branch": True,
        "auto_commit": True,
        "auto_push": False,
        "branch_prefix": "fleet",
        "run_local_tests": True,
        "trigger_github_actions": False,
        "allow_repo_init": True,
        "create_github_issues": True,
        "create_pull_request": False,
    },
    "autonomy": {
        "run_without_request": True,
        "default_request": "Review the selected repository, identify the highest-value improvement based on current git state, and implement it safely.",
    },
    "scheduler": {"continuous": False, "interval_seconds": 900},
}


def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config() -> dict:
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as handle:
            json.dump(DEFAULT_CONFIG, handle, indent=2)
        return DEFAULT_CONFIG

    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        raw = handle.read().strip()
    if not raw:
        return DEFAULT_CONFIG

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("PIPELINE", "Invalid config JSON, using defaults")
        return DEFAULT_CONFIG
    return deep_merge(DEFAULT_CONFIG, parsed)


def ensure_dirs(cfg: dict) -> dict:
    dirs = cfg["directories"]
    subs = cfg["artifact_subdirs"]
    resolved = {
        "memory": os.path.join(BASE_DIR, dirs["memory"]),
        "incoming": os.path.join(BASE_DIR, dirs["incoming"]),
        "artifacts": os.path.join(BASE_DIR, dirs["artifacts"]),
        "logs": os.path.join(BASE_DIR, dirs["logs"]),
    }
    resolved["plans"] = os.path.join(resolved["artifacts"], subs["plans"])
    resolved["blueprints"] = os.path.join(resolved["artifacts"], subs["blueprints"])
    resolved["builds"] = os.path.join(resolved["artifacts"], subs["builds"])
    resolved["qa_reports"] = os.path.join(resolved["artifacts"], subs["qa_reports"])

    for path in resolved.values():
        os.makedirs(path, exist_ok=True)
    return resolved


def read_text(path: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read().strip()


def write_text(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)


def env_check() -> None:
    minimax_key = os.environ.get("MINIMAX_API_KEY", "").strip()
    minimax_url = os.environ.get("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2").strip()
    minimax_model = os.environ.get("MINIMAX_MODEL", "MiniMax-Text-01").strip()
    github_token = os.environ.get("GITHUB_TOKEN", "").strip()

    logger.info("PIPELINE", "Environment check:")
    if minimax_key:
        suffix = minimax_key[-3:] if len(minimax_key) >= 3 else minimax_key
        logger.info("PIPELINE", f"  MINIMAX_API_KEY: ✓ set (ends in ...{suffix})")
    else:
        logger.error("PIPELINE", "  MINIMAX_API_KEY: ✗ NOT SET")
    logger.info("PIPELINE", f"  MINIMAX_API_URL: {minimax_url}")
    logger.info("PIPELINE", f"  MINIMAX_MODEL: {minimax_model}")

    if github_token:
        g_suffix = github_token[-3:] if len(github_token) >= 3 else github_token
        logger.info("PIPELINE", f"  GITHUB_TOKEN: ✓ set (ends in ...{g_suffix})")
    else:
        logger.info("PIPELINE", "  GITHUB_TOKEN: ✗ NOT SET — GitHub API operations will be skipped")

    if not minimax_key:
        raise RuntimeError("FATAL: MINIMAX_API_KEY is required")


def load_request(cfg: dict, dirs: dict) -> str:
    request_path = os.path.join(dirs["incoming"], "latest-request.md")
    req = read_text(request_path)
    if req:
        return req

    if cfg.get("autonomy", {}).get("run_without_request", True):
        req = str(cfg.get("autonomy", {}).get("default_request", "")).strip()
        if req:
            write_text(request_path, req + "\n")
            return req
    return ""


def read_memory(dirs: dict) -> dict:
    return {
        "main": read_text(os.path.join(dirs["memory"], "MEMORY.md")),
        "status": read_text(os.path.join(dirs["memory"], "fleet-status.md")),
    }


def scan_repos(target_codebase: str, cfg: dict) -> dict:
    max_repos = int(cfg.get("github_context", {}).get("max_repos", 12))
    max_status = int(cfg.get("github_context", {}).get("max_status_lines", 10))
    max_commits = int(cfg.get("github_context", {}).get("max_commits", 3))

    repos = []
    if os.path.isdir(target_codebase):
        for name in sorted(os.listdir(target_codebase)):
            path = os.path.join(target_codebase, name)
            if not os.path.isdir(path):
                continue
            if not os.path.isdir(os.path.join(path, ".git")):
                continue

            branch = git_ops.get_current_branch(path) or "unknown"
            status_sample = git_ops.get_status(path).splitlines()[:max_status]
            commits = git_ops.get_recent_commits(path, n=max_commits)
            ok_remote, remote = git_ops.run_git(["remote", "get-url", "origin"], cwd=path)
            repos.append(
                {
                    "name": name,
                    "path": path,
                    "branch": branch,
                    "status_sample": status_sample,
                    "recent_commits": commits,
                    "remote": remote if ok_remote else "",
                }
            )
            if len(repos) >= max_repos:
                break

    return {"target_codebase": target_codebase, "repo_count": len(repos), "repos": repos}


def save_stage(ctx: PipelineContext, dirs: dict, stage: str, payload: dict) -> None:
    if stage == "elena":
        aid = get_next_id("E", dirs["plans"])
        ctx.artifact_ids["plan"] = aid
        save_artifact(dirs["plans"], aid, payload)
        return

    if stage == "colombo":
        aid = get_next_id("C", dirs["blueprints"])
        ctx.artifact_ids["blueprint"] = aid
        save_artifact(dirs["blueprints"], aid, payload)
        return

    if stage == "vitalik":
        aid = ctx.artifact_ids.get("build") or get_next_id("V", dirs["builds"])
        ctx.artifact_ids["build"] = aid
        save_artifact(dirs["builds"], aid, payload)
        return

    aid = get_next_id("A", dirs["qa_reports"])
    ctx.artifact_ids["qa"] = aid
    save_artifact(dirs["qa_reports"], aid, payload)
    save_qa_markdown(aid, payload, dirs["qa_reports"])


def update_fleet_status(ctx: PipelineContext, dirs: dict) -> None:
    verdict = (ctx.qa_report or {}).get("verdict", "UNKNOWN")
    score = (ctx.qa_report or {}).get("score", 0)
    lines = [
        "# Fleet Status",
        "",
        f"- Iterations: {ctx.iteration}",
        f"- Verdict: {verdict}",
        f"- Score: {score}/100",
        f"- Plan: {ctx.artifact_ids.get('plan')}",
        f"- Blueprint: {ctx.artifact_ids.get('blueprint')}",
        f"- Build: {ctx.artifact_ids.get('build')}",
        f"- QA: {ctx.artifact_ids.get('qa')}",
    ]
    write_text(os.path.join(dirs["memory"], "fleet-status.md"), "\n".join(lines) + "\n")


def run_once(cfg: dict, dirs: dict) -> None:
    logger.section("MINI-AGENTS FLEET v2 — Pipeline Run")

    request = load_request(cfg, dirs)
    if not request:
        logger.error("PIPELINE", "No request available")
        return

    memory = read_memory(dirs)
    target_codebase = str(cfg.get("target_codebase", "")).strip()
    github_context = scan_repos(target_codebase, cfg)

    logger.info("PIPELINE", f'Request: "{request[:120]}"')
    logger.info("PIPELINE", f"Target codebase: {target_codebase}")
    logger.info("PIPELINE", f"Scanned {github_context.get('repo_count', 0)} repositories")

    ctx = PipelineContext(
        config=cfg,
        target_codebase=target_codebase,
        request=request,
        memory=memory,
        github_context=github_context,
        max_iterations=int(cfg.get("max_iterations", 3)),
    )

    elena = ElenaAgent()
    colombo = ColomboAgent()
    vitalik = VitalikAgent()
    athena = AthenaAgent()

    start_stage = "elena"
    order = ["elena", "colombo", "vitalik", "athena"]

    while ctx.iteration < ctx.max_iterations:
        ctx.iteration += 1
        logger.info("PIPELINE", f"Iteration {ctx.iteration}/{ctx.max_iterations} starting from {start_stage}")
        start_idx = order.index(start_stage) if start_stage in order else 0

        if start_idx <= 0:
            plan = elena.run(ctx)
            if plan.get("status") != "ok":
                save_stage(ctx, dirs, "elena", plan)
                break
            ctx.plan = plan
            save_stage(ctx, dirs, "elena", plan)

        if start_idx <= 1:
            blueprint = colombo.run(ctx)
            if blueprint.get("status") != "ok":
                save_stage(ctx, dirs, "colombo", blueprint)
                break
            ctx.blueprint = blueprint
            save_stage(ctx, dirs, "colombo", blueprint)

        if start_idx <= 2:
            next_build_id = get_next_id("V", dirs["builds"])
            ctx.artifact_ids["build"] = next_build_id
            build = vitalik.run(ctx)
            if build.get("status") != "ok":
                save_stage(ctx, dirs, "vitalik", build)
                break
            ctx.build = build
            ctx.execution = build.get("execution")
            save_stage(ctx, dirs, "vitalik", build)

        qa_report = athena.run(ctx)
        ctx.qa_report = qa_report
        save_stage(ctx, dirs, "athena", qa_report)

        verdict = str(qa_report.get("verdict", "UNKNOWN")).upper()
        logger.info("PIPELINE", f"Athena verdict: {verdict} ({qa_report.get('score', 0)}/100)")

        if verdict == "PASS" or not qa_report.get("next_iteration_needed", False):
            break

        feedback = qa_report.get("feedback_for_revision", {})
        target = str(feedback.get("target_agent", "vitalik")).lower()
        if target not in {"elena", "colombo", "vitalik"}:
            target = "vitalik"
        logger.info("PIPELINE", f"Feedback loop: reroute to {target} | {feedback.get('message', '')}")
        start_stage = target

    update_fleet_status(ctx, dirs)

    logger.section("PIPELINE COMPLETE")
    logger.info("PIPELINE", f"Verdict: {(ctx.qa_report or {}).get('verdict', 'UNKNOWN')}")
    logger.info("PIPELINE", f"Iterations: {ctx.iteration}")
    logger.info(
        "PIPELINE",
        f"Artifacts: {ctx.artifact_ids.get('plan')}, {ctx.artifact_ids.get('blueprint')}, {ctx.artifact_ids.get('build')}, {ctx.artifact_ids.get('qa')}",
    )
    logger.info("PIPELINE", f"Branch: {(ctx.execution or {}).get('branch', 'N/A')}")
    logger.info("PIPELINE", f"Commit: {(ctx.execution or {}).get('commit', {}).get('sha', 'N/A')}")


def run_pipeline() -> None:
    load_dotenv()
    cfg = load_config()
    dirs = ensure_dirs(cfg)

    try:
        env_check()
    except RuntimeError as exc:
        logger.error("PIPELINE", str(exc))
        return

    continuous = bool(cfg.get("scheduler", {}).get("continuous", False))
    interval = int(cfg.get("scheduler", {}).get("interval_seconds", 900))
    if interval < 30:
        interval = 30

    if not continuous:
        run_once(cfg, dirs)
        return

    logger.info("PIPELINE", f"Scheduler mode enabled (interval={interval}s)")
    while True:
        run_once(cfg, dirs)
        logger.info("PIPELINE", f"Sleeping {interval}s")
        time.sleep(interval)


if __name__ == "__main__":
    run_pipeline()

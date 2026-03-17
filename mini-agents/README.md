# Mini-Agents Fleet v2

Mini-Agents Fleet v2 is a clean, synchronous, waterfall multi-agent pipeline for continuous codebase improvement.

Flow:

`Elena -> Colombo -> Vitalik -> Athena`

Feedback loop:

`Athena -> (elena | colombo | vitalik) -> downstream stages`

## Clean Structure

This repository is now consolidated to the v2 runtime layout only:

```text
mini-agents/
├── main.py
├── config/
│   └── pipeline.json
├── core/
│   ├── __init__.py
│   ├── logger.py
│   ├── context.py
│   └── artifacts.py
├── agents/
│   ├── __init__.py
│   ├── base.py
│   ├── llm.py
│   ├── elena.py
│   ├── colombo.py
│   ├── vitalik.py
│   └── athena.py
├── integrations/
│   ├── __init__.py
│   ├── git_ops.py
│   ├── github_api.py
│   └── github_actions.py
├── incoming/
│   └── latest-request.md
├── memory/
│   ├── MEMORY.md
│   └── fleet-status.md
├── artifacts/
│   ├── plans/
│   ├── blueprints/
│   ├── builds/
│   └── qa-reports/
├── logs/
│   └── run-log.txt
├── .env
├── .env.example
└── requirements.txt
```

Removed during cleanup:

- legacy caches (`__pycache__`)
- legacy helper memory files
- old solution wrapper (`mini-agents.sln`)
- historical artifacts/log content (fresh runtime state)

## Core Principles

- Standard library + `python-dotenv` only.
- All HTTP calls use `urllib.request`.
- All local git operations use `subprocess` (`shell=False`).
- Print-based logging everywhere (`core/logger.py`).
- Shared `PipelineContext` object across all stages.
- Deterministic artifact saving in `artifacts/*`.

## Agent Responsibilities

### Elena
- Understands request and repo context.
- Selects target repo.
- Produces plan JSON.

### Colombo
- Converts plan into technical blueprint.
- Defines file changes, tests, branch strategy.
- Optionally creates GitHub issues through REST API.

### Vitalik
- Generates full file content.
- Applies file changes in target repo.
- Creates/switches branch.
- Runs local tests.
- Commits/pushes according to config.
- Optionally triggers GitHub Actions.

### Athena
- Reviews blueprint + build + execution evidence.
- Produces checklist, score, verdict.
- Reroutes feedback to prior stage when needed.
- Optionally triggers CI verification and creates QA issues.

## Configuration

Edit `config/pipeline.json`.

Key sections:

- `target_codebase`
- `max_iterations`
- `github_context`
- `github`
- `directories`
- `artifact_subdirs`
- `execution`
- `autonomy`
- `scheduler`

## Run

Install dependency:

```powershell
pip install -r requirements.txt
```

Set API key in `.env`:

```env
MINIMAX_API_KEY=your_key_here
```

Run once:

```powershell
python main.py
```

Continuous mode:

1. Set `"scheduler.continuous": true` in `config/pipeline.json`
2. Run `python main.py`

## Runtime Outputs

- Plans: `artifacts/plans/E-###.json`
- Blueprints: `artifacts/blueprints/C-###.json`
- Builds: `artifacts/builds/V-###.json`
- QA reports: `artifacts/qa-reports/A-###.json` and `.md`
- Log stream: `logs/run-log.txt`
- Fleet summary: `memory/fleet-status.md`

## Troubleshooting

### MiniMax connection errors

If you see URL connection errors:

- confirm `MINIMAX_API_KEY` is set
- confirm outbound network access to MiniMax endpoint

Pipeline handles this gracefully with fallback behavior.

### Git permission errors

If branch/commit fails with lock or permission denied:

- check filesystem permissions for target repo `.git` directory
- verify repo is not locked by another process
- rerun after clearing lock contention

### GitHub operations skipped

If issues/workflows/PR are not created:

- set `GITHUB_TOKEN`
- ensure owner/repo can be resolved from remote or config

## Notes

- The pipeline is intentionally synchronous and explicit for reliability and debuggability.
- Cleanup keeps only canonical v2 components and runtime folders.

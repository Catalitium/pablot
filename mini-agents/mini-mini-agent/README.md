# mini-mini-agent

Local Ollama multi-agent runner focused on fast, visible progress.

Mission:
- Randomly select repositories under `C:\Users\catal\Desktop\code-base`
- Run a 4-agent waterfall
- Produce practical deliverables every iteration
- Apply code changes, commit locally, and optionally push/trigger GitHub automation

Flow:
- `🧭 Elena` -> Discovery and scope pick
- `🏗️ Colombo` -> Technical blueprint and file plan
- `🛠️ Vitalik` -> Code-ready file deliverables
- `🧪 Athena` -> QA gate and fix guidance

## What You Get in 5 Iterations

- Clear console timeline with emoji stage markers
- Random repo targeting each iteration
- JSON deliverables per stage
- Iteration summary artifacts
- One run summary artifact

## Folder Layout

```text
mini-mini-agent/
├── main.py
├── config/
│   └── pipeline.json
├── prompts/
│   ├── elena.txt
│   ├── colombo.txt
│   ├── vitalik.txt
│   └── athena.txt
├── outputs/
├── logs/
│   └── run.log
└── README.md
```

## Model Mapping (Default)

- Elena: `qwen2.5-coder:3b`
- Colombo: `qwen2.5-coder:7b`
- Vitalik: `deepseek-coder-v2:16b-lite`
- Athena: `qwen2.5-coder:7b`

## Pull Models

Run one command per model:

```powershell
ollama pull qwen2.5-coder:3b
ollama pull qwen2.5-coder:7b
ollama pull deepseek-coder-v2:16b-lite
```

## Run

1. Start Ollama:

```powershell
ollama serve
```

2. Run the pipeline:

```powershell
cd mini-mini-agent
python main.py
```

## Configuration

Edit `config/pipeline.json`:

- `target_codebase`: root containing many repos
- `iterations`: default `5`
- `request`: mission prompt for all iterations
- `stage_models`: per-agent model routing
- `stages`: execution order
- `execution`: branch/commit/push/tests/GitHub toggles
- `github`: owner, base branch, workflow id, default labels

## GitHub Integration

Set token:

```powershell
$env:GITHUB_TOKEN="ghp_your_token"
```

Supported actions:
- Colombo can propose `github_issues` and the runner creates them with labels.
- Vitalik writes files, creates branch, commits, and can push.
- Optional PR creation after push (`execution.create_pull_request`).
- Optional workflow dispatch (`execution.trigger_github_actions`).
- Athena FAIL can auto-open a QA issue with required fixes.

## Outputs

For each iteration:
- `outputs/iteration-01-elena.json` + `.md`
- `outputs/iteration-01-colombo.json` + `.md`
- `outputs/iteration-01-vitalik.json` + `.md`
- `outputs/iteration-01-athena.json` + `.md`
- `outputs/iteration-01-summary.json`

Run-level:
- `outputs/run-summary.json`
- `logs/run.log`

## Prompt Design

Prompts are intentionally short and strict:
- JSON-only output
- role-specific schema
- practical deliverables, no long explanations

This keeps outputs parseable and useful for automation.

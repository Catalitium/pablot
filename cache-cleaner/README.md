# cache-clean-commander

Tkinter desktop app (with optional CLI-only mode) to preview and purge safe cache/temp folders with size estimates, WhatIf mode, and CSV logs.

## Features
- Preloaded targets: `%TEMP%`, `%LOCALAPPDATA%\Temp`, Chrome/Edge caches; add extra paths via CLI arguments.
- Analyze step walks each target and shows file counts + total size.
- Clean step supports `--whatif`, progress bar, error-safe deletion, and CSV logs in `Documents\CacheCleanCommander\logs`.
- Buttons to open the logs folder or rerun analyze after cleaning. CLI mode prints JSON summaries for automation.

## Usage
```bash
python cache_clean_commander.py          # GUI mode
python cache_clean_commander.py --whatif # GUI but delete step is simulated
python cache_clean_commander.py --cli analyze
python cache_clean_commander.py --cli clean --whatif "C:\Temp" "D:\Scratch"
```

## Safety
- Files in use are skipped; failures are reported per target.
- WhatIf writes identical logs but tags the action so you can review before deleting.
- Every clean run emits `clean-YYYYMMDD-HHMMSS.csv` under `Documents\CacheCleanCommander\logs`.


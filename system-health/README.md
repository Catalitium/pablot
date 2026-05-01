# System Health

Offline developer diagnostics page for quick local machine checks.

## Usage

Open `index.html` in a browser. The page displays copyable Bash, PowerShell, and Python diagnostics in a terminal-style panel. Bash is shown by default, and the copy button copies the currently selected script.

Use **In-depth report** to render the longer PowerShell PC health report before copying it.

On Windows, the single maintained script is:

```powershell
.\main.ps1
```

Use `.\main.ps1 -Json` for structured output.

For Python, run:

```bash
python system-health.py
```

The browser page and scripts run locally. No build step, server, external library, or data collection is required.

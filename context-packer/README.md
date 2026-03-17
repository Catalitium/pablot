# Context Packer

Offline text compaction utility with deterministic transform toggles and before/after metrics.

## Available Transforms
- Whitespace cleanup:
  - Collapses repeated spaces/tabs inside each line.
  - Trims leading/trailing space per line.
- Blank-line collapse:
  - Converts runs of 3+ newlines into a single blank line.
- Duplicate block removal:
  - Removes only exact duplicate paragraph blocks.
  - Near-matches are intentionally preserved.

Transforms run in a fixed order to keep output deterministic.

## Metrics
- Character count
- Word count
- Line count
- Estimated token count (`ceil(chars / 4)`)

Metrics show `before -> after` for each run.

## Copy and Reset Behavior
- Copy output uses `navigator.clipboard` in secure contexts.
- Fallback uses selection + `execCommand("copy")`.
- Reset keeps input untouched, resets toggles to defaults, and restores output from current input.

## Safety Notes
- Aggressive cleanup can alter formatting semantics.
- Output is not reversible from output alone; original input remains the source of truth.

## Local Run
Open `index.html` in a browser. No backend or external dependency is required.

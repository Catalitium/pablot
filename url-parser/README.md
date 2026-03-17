# URL Parser and Validator

Offline URL decomposition tool using the browser `URL` API.

## Features
- Parse a URL into:
  - Scheme
  - Username
  - Password presence flag
  - Host
  - Port
  - Pathname
  - Search string
  - Fragment
- Render query parameters in a key/value table.
- Explicit invalid-input error state.
- Reset action clears input and parsed output.

## Behavior Notes
- Input is trimmed before parse.
- Missing URL parts display explicit placeholders like `(none)`.
- On parse failure, prior parsed values are cleared so stale data is never shown.
- Relies on the browser's native `URL` and `URLSearchParams` behavior.

## Examples
- Valid: `https://example.com:8080/a/b?x=1&x=2#frag`
- Valid: `https://münich.example/%E2%9C%93?q=ok`
- Invalid: `example.com/path` (missing protocol for strict parser entry point)

## Local Run
Open `index.html` in a browser. No server or external dependency is required.

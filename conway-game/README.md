# Conway's Game

Static Conway's Game of Life simulator for Pablobot.

## Usage

Open `index.html` in a browser. The tool works offline and stores saves only in local browser storage.

Controls:

- Start/Pause: run or pause the simulation
- Step: advance one generation while paused
- Reset: reload the selected pattern
- Randomize/Clear: replace the board
- Pattern: choose a classic seed and load it
- Save/Restore: persist state in localStorage
- Export/Import JSON: move a board state between sessions

Click or drag on the board to paint cells.

## Python Helper

Run a dependency-free CLI reference simulation:

```bash
python main.py --pattern glider --steps 5 --json
```

No data is collected or sent anywhere.

# Audio Visualizer

Offline microphone-driven frequency visualizer.

## Features
- Start/stop microphone stream.
- Sensitivity control.
- Canvas frequency bar rendering.

## Permission Behavior
- If microphone permission is denied or no device exists, UI shows fallback status without crashing.
- Browser support requires `getUserMedia` and Web Audio API.

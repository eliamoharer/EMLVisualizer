# EML Canvas Visualization

Interactive visualization of the **EML operator** — the single binary function
`eml(x, y) = exp(x) − ln(y)` which, paired with just the constant **1**,
generates every elementary function in mathematics.

Based on [Odrzywołek (2026), "All elementary functions from a single binary operator"](https://arxiv.org/abs/2603.21852).

## Quick Start (Windows)

1. Open a terminal in this folder (`L:\AI\EML`).
2. Install dependencies:
   ```
   npm install
   ```
3. Start the dev server:
   ```
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.

If port 5173 is busy, Vite prints the actual URL in the terminal.

## Other Commands

| Command             | Purpose                        |
| ------------------- | ------------------------------ |
| `npm run dev`       | Start local dev server         |
| `npm run build`     | Production build to `dist/`    |
| `npm run preview`   | Preview production build       |
| `npm run test`      | Run unit tests                 |
| `npm run lint`      | Lint the codebase              |

## How to Use

| Area                 | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| **Canvas**           | Drag to pan, scroll to zoom. The graph radiates from root **1**.             |
| **Top-right panel**  | Adjust derivation depth (1–8) and toggle family clusters on/off.            |
| **Top-left panel**   | Search any function or constant. Press Enter to trace the path from root 1. |
| **Click a node**     | Opens focus mode with the EML binary tree, notation, and evaluation.        |
| **Focus mode tree**  | Click any sub-expression to isolate it and see its intermediate value.       |

## Troubleshooting

- If `npm` is not recognized, install [Node.js LTS](https://nodejs.org/) and reopen the terminal.
- If nothing loads, confirm the dev server is running and check the terminal for errors.

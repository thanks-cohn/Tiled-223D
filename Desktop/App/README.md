# ÆXIS desktop workspace skeleton

This is an **experimental Qt 6 host**, not a released desktop app or a working Tiled-in-tab integration. It lives outside the standalone browser build. The existing viewer remains the source of map parsing and rendering behavior. No third-party application or model is bundled.

## Run on a development computer

Requirements: Qt 6.8 or newer with Widgets, WebEngineWidgets and WebChannel, a C++20 compiler, CMake and Node.js. On Windows, install a matching Qt desktop kit and ensure CMake can find it (for example via `CMAKE_PREFIX_PATH`).

From the repository root, run `npm install` and `npm run dev` to start the existing viewer at `http://127.0.0.1:5173`. In another terminal:

```sh
cmake -S Desktop/App -B Desktop/App/build -DCMAKE_PREFIX_PATH=/path/to/Qt/6.x/kit
cmake --build Desktop/App/build --config Release
```

Run `aexis-desktop --debug` from the build output directory. You can override the viewer address with `--viewer-url http://127.0.0.1:5173`; only local HTTP addresses are allowed. Select an **ordinary Tiled JSON** map in the Map tab, then open World. The web view is created only on first visit. Saving the selected file starts a debounced reread and reimport, deferred while the World tab is hidden; the hidden renderer pauses its frame work. Invalid/partial files leave the last valid world on screen. The desktop bridge caps ordinary JSON at 8 MB to limit temporary copies. The existing `.sworld.json` Tiled extension output is **not yet** accepted by the browser importer.

## Inspect expected versus actual state

`--debug` adds a dock with JSON-lines events and an **Inspect expected state** button. Each snapshot includes the bundled, machine-readable `integrations/tiled.json` contract and names the capabilities expected of *this skeleton*: one workspace, lazy web view and ordinary Tiled JSON import. It explicitly marks native Tiled hosting and semantic exporter round trip as unavailable. Events show viewer load, bridge connection, project map selection, import result and import latency. **Export diagnostics** writes the displayed lines to a user-selected local file; paths in the log may disclose local project names, so review before sharing. The normal UI does not display or write this log. The integration manifest is a draft contract, not an installer or an accepted third-party app package.

The debug sequence to inspect is `shell ready` → `viewer-start` → `viewer-load ready` → `viewer-import ready` → `project-map`/`import-dispatch` → `viewer-import ok`. A bad map should report `map-read` or `viewer-import error`, without discarding the displayed world. If the bridge never becomes ready, inspect the World tab developer console and Qt WebChannel script loading.

## What comes next

1. Prototype a real Tiled surface inside the Map tab on Windows. Validate focus, dialogs, DPI changes, resize, hide/show, process exit and recovery before claiming success. Keep the adapter separate from viewer parsing.
2. Replace file selection with a versioned project record and a stable Tiled-export contract. Align `.sworld.json` exporter/importer, preserve object IDs and conflicts, and keep image recognition outside the critical browser-render path.
3. Measure installed size, startup, idle/peak RAM, tab switching and save-to-preview latency on the 4 GB Windows target with about 5 GB free. Qt WebEngine and the native editor may exceed the budget; no performance claim has been validated yet.

See [the workspace app proposal](../../Proposals/substrate-workspace-app-format-native-tabs.md) and [the browser handoff](../../docs/CODEX_HANDOFF.md).

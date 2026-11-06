# Framia

Framia is a drawing and animation editor with a timeline, layers, brushes, transform controls, local autosave, `.framia`/`.duo` import, and PNG/GIF/MP4 export.

## Recovered project

This workspace started with only a README and license. The frontend in `src/fr.js` and `src/fr.css` was recovered from Framia's published preview, then formatted for editing. The exact downloaded frontend files are kept under `reference/`. Branding, fonts, and the archived Duo Studio page were also recovered from the published sites. The original authoring source and original Worker were not available in the repository.

## Local development

```sh
bun install --frozen-lockfile
bun run dev -- --host 0.0.0.0 --port 3000
```

The Vite preview runs the editor with browser-local projects. Account storage and remote rooms require the Worker, which uses the existing Framia Sites `DB`, `FILES`, and `REALTIME` bindings.

```sh
bun run build
bunx wrangler dev --local -c freebuff-realtime/wrangler.jsonc --inspector-port 9230
bunx wrangler dev --local -c wrangler.jsonc --inspector-port 9229
```

Start the realtime helper first. The local Worker has a development Freebuff client registered for `http://localhost:8787`; the cloud VM's browser preview cannot complete a login on that loopback origin. The development DB and file bucket are local and isolated from the published site. `deploy.json` bundles the Worker and public build output for Sites. The preview deployment is at https://site-6c03c284779643b28450b656c5d30361.freebuff.page/.

## Accounts on this device

The header (home and editor) shows the signed-in Freebuff account with an expand
arrow, up to three saved account entries, an **Add account** action and sign
out. Switching uses `/auth/freebuff/signin?prompt=select_account`, so Freebuff
picks the account; there is no local password or token storage.

Browser-local data is namespaced per account: the project library uses a
separate IndexedDB database (`framia-project-library-<scope>`) and brushes use
`framia-brushes:<scope>`. The first account to sign in on a browser claims the
legacy unscoped library once (migration), and other accounts never see it.
Signed-out sessions keep their own unscoped store.

## Recent changes

- Account switcher with a three-account cap and per-account local projects/brushes.
- Rooms: new rooms use six-character codes (eight characters still accepted for
  legacy rooms), and the home screen can create a room with the selected canvas
  size and name. Remote cursors are broadcast during editing alongside the
  existing stroke previews, transforms and chat.
- Chat: messages carry a stable sender id and are deduplicated, so a sender no
  longer appears twice ("You" plus their name) and everyone else resolves the
  same name. Presence is published with the account name on join.
- Transform: dragging moves the whole selection; handles and drags are no longer
  clamped to the canvas; click outside, switch tools or press Enter to apply,
  Esc to cancel. Clicking a stroke with the transform tool selects it.
- Brush size accepts values up to 1000 (slider, numeric field and `[`/`]`).
- Line tool stores both endpoints, so it follows the actual drag direction.
- Toggleable grid overlay (project setting, toolbar button, grid divisions) that
  is a DOM overlay and never part of the canvas or exports.
- Layer ordering (up/down) and merge up/down, preserving stacking and
  transparency (blend/opacity cases are flattened to a lossless PNG per frame).
- Project settings: animation loop on/off (saved with the project) and grid.
- `Delete`/`Backspace` remove the current selection or clip, `Ctrl+D`
  duplicates the selection.
- Zoom percentage is displayed rounded; internal zoom precision is unchanged.
- Mobile layout: horizontal tool rail, compact top bar, slide-over inspector,
  full-width chat, touch-sized controls and responsive home grid.
- `.framia` export is now a `FRAMIA2` container: a gzipped JSON header plus raw
  media bytes. It no longer embeds the 96 KB logo and no longer base64-encodes
  media, so the same project is far smaller. Imports still accept v1 `.framia`
  and `.duo` files.

## Current limits

- The recovered frontend was a compiled bundle, so its variable names are generated and it needs a gradual source refactor.
- GIF and MP4 export render imported video clips. MP4 export offers music on/off using imported audio clips and the browser's available MP4 recorder.
- The replacement Worker uses new `framia_*_v2` tables. Two cloud projects and all 13 legacy rooms were copied into them. The rooms' 14 memberships and six-character codes were preserved, and the original D1 tables and R2 snapshots remain in place.
- Local workerd tests cover signed-out access, two-user isolation, remote rooms, reconnect, and snapshot recovery. The hosted preview has been checked with an existing signed-in session; a fresh hosted sign-in/callback/sign-out cycle and two-account hosted test remain to be verified.
- Not implemented yet from the feature request: shared cloud workspaces with invite links, Discord-style profiles (banners, gradients, bios, avatar upload), the friendship system, custom keyboard binding remapping, geometric construction guides, and post-import video FPS/speed retiming.
- Merging layers whose blend mode or opacity is not "normal" rasterises those two layers per frame (lossless PNG) instead of concatenating strokes, which keeps the visual result but creates an image element for that frame.

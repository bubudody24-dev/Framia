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

## Current limits

- The recovered frontend was a compiled bundle, so its variable names are generated and it needs a gradual source refactor.
- GIF and MP4 export render imported video clips. MP4 export offers music on/off using imported audio clips and the browser's available MP4 recorder.
- The replacement Worker uses new `framia_*_v2` tables. The two cloud projects visible through the old API were copied into the new project table after deployment and verified by opening one in the editor. The original D1 tables and R2 objects remain in place. Existing room records could not be inventoried from the old API and have not been migrated to the new room table.
- Local workerd tests cover signed-out access, two-user isolation, remote rooms, reconnect, and snapshot recovery. The hosted preview has been checked with an existing signed-in session; a fresh hosted sign-in/callback/sign-out cycle and two-account hosted test remain to be verified.

---
name: home-assistant-panel-ui
description: Building, styling, and debugging Home Assistant custom panels and config panels (panel_custom, Lit, HA design tokens, full-width app bars, permissions, config flows, HACS distribution, tests). Load before any HA UI work.
---

# Home Assistant Panel UI

Use for any change to a Home Assistant custom integration that ships a `panel_custom`
panel, a configuration panel, or HA-facing frontend assets. This is the team's
hard-won knowledge from the `frickeldave_store` integration — follow it instead of
re-discovering the failure modes.

## Non-negotiable rules

1. **Never import Lit as a bare specifier in a browser module.** `import { LitElement } from "lit"`
   fails in HA: HA ships no browser import map and `panel_custom` imports `module_url` directly.
   Vendor Lit as a local ESM bundle and import `./lit.js`.
2. **The app bar must span the full viewport width**, not the content max-width. Put the bar
   outside the content shell; the shell may stay `max-width: 1440px`.
3. **App bar actions are icon buttons, not coloured text buttons.** Refresh, import, add, etc.
   are 40–44 px icon buttons with `aria-label`/`title`; primary/text buttons belong in the
   content area, never in the top bar.
4. **Match HA metrics and tokens**, do not invent a look: 56 px bar height, HA surface/divider
   colours, 8 px spacing grid, 12 px card radius, 44 px touch targets, HA typography tokens.
5. **`require_admin` is not access control.** Every protected HTTP/WebSocket route checks the
   integration's own roles server-side on every request (default deny, revocation on next call).
6. **Config flows must be serialisable.** On HA 2026.10+ schemas are serialised with `probatio`;
   a plain callable validator inside a schema raises `ValueError: unable to serialize schema`
   and surfaces as “Config flow could not be loaded: 500”.
7. **A config panel replaces the integration's options-flow gear** only when registered with
   `config_panel_domain=DOMAIN`; HA then links `/{url_path}?config_entry=<entry_id>`.
8. **Release hygiene:** tag = manifest version **without** a leading `v`; bump manifest,
   `const.py`, `pyproject.toml`; CHANGELOG; HACS update; hard reload after installing.

## Registration

```python
await panel_custom.async_register_panel(
    hass,
    frontend_url_path="my-integration",            # sidebar panel
    webcomponent_name="my-integration-panel",
    sidebar_title="My Integration",
    sidebar_icon="mdi:cog",
    module_url="/my_integration_frontend/my-integration-panel.js",
    embed_iframe=False,
    require_admin=False,                          # own roles still enforced per request
    config={"api_prefix": "/api/my_integration"},
)

await panel_custom.async_register_panel(
    hass,
    frontend_url_path="my-integration-config",    # replaces the options-flow gear
    webcomponent_name="my-integration-config-panel",
    module_url="/my_integration_frontend/my-integration-config-panel.js",
    embed_iframe=False,
    require_admin=True,
    config_panel_domain=DOMAIN,
)
```

- Serve assets with `hass.http.async_register_static_paths([StaticPathConfig(url, dir, cache_headers=False)])`
  (fall back to `register_static_path` only for HA < 2024.7).
- Register both panels idempotently and remove both on unload.
- Check that the module file exists; log a clear warning instead of failing setup.

## Lit without an import map

Build a local bundle once and commit it:

```bash
npm i -D lit esbuild
npx esbuild node_modules/lit/index.js --bundle --format=esm --minify \
  --legal-comments=inline --outfile=custom_components/<domain>/frontend/lit.js
```

Then `import { LitElement, html, css } from "./lit.js";`. Add a guard test that rejects any
bare specifier (`from "lit"`, `import "x"`) in shipped frontend files, and run
`node --check` on every module in CI.

## App bar: pixel-matching HA

- Full width, sticky, 56 px, bottom divider, background `--app-header-background-color`
  (fallback `--primary-background-color`), text `--primary-text-color`.
- Left: hamburger icon button. It opens the HA sidebar by dispatching a composed,
  bubbling event — verified against HA's `ha-menu-button`:

```js
this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
```

- Right: three-dot menu button with `aria-haspopup="menu"`, `aria-expanded`, accessible
  menu items (`role="menu"`/`menuitem`, Esc/outside click, arrow keys, focus return).
- Middle: title (and optional subtitle). Actions as icon buttons between title and menu.
- Do **not** put the bar inside `max-width`/padding content wrappers; wrap content below it.
- On narrow screens keep the hamburger and menu visible; let the title truncate and actions wrap.

## Config panel navigation

HA config pages have a back affordance; a custom config panel must provide its own:

- Back: `history.back()` when there is same-origin history; otherwise navigate to
  `/config/integrations`.
- Forward: `history.forward()`; disable both when there is no history (`history.length` heuristics).
- Use the same full-width bar metrics as the sidebar panel, with the title and icon buttons.

## Config/options flow schemas (HA 2026.10+)

- Prefer the HA-native schema library: `try: import probatio as schema_lib` /
  `except ImportError: import voluptuous as schema_lib`.
- Never put a plain function validator in a form schema. Validate in the step and return
  `{"errors": {...}}`.
- Websocket command schemas: markers are **keys**, validators are **values**
  (`{schema_lib.Optional("limit"): int}`), never the reverse.
- Test the HTTP serialisation path, not just the flow result:
  `probatio.to_field_list(result["data_schema"], custom_serializer=cv.custom_serializer)`
  (fallback `voluptuous_serialize.convert` on older HA).
- Stale “Already in progress” flows are in-memory; close other tabs and restart HA.

## Auth and API

- Fetch with `Authorization: Bearer <token>`; token from `hass.auth.data.access_token`
  (fallback `hass.auth.accessToken`), base URL from `hass.auth.data.hassUrl` (fallback origin).
- Enforce roles server-side on every route, including files, exports, WebSocket and previews.
- Image previews behind auth must be fetched as blobs/object URLs, not plain `<img src>`.
- Return `{"error": {"code", "message"}}`; the panel shows readable German messages.
- Guard destructive operations: never allow removing the last `app_admin`; confirm deletes.

## Design system (official HA guidance)

Source of truth: <https://contributors.home-assistant.io/design/> — principles, foundations,
patterns, components and UI text. Read the relevant subpage before inventing a control.

### Principles and UI text

- Personality: welcoming, candid, supportive, generous, independent. Local-first, no dark patterns.
- Sentence case for titles, buttons, labels; active voice; concise; "you"/"your" (German: "du"/"dein").
- One thing, one name; say "integration", not "component".
- **Add** puts an existing thing somewhere; **Create** makes something new. **Remove** keeps it
  re-addable; **Delete** is permanent. German: Hinzufügen/Erstellen, Entfernen/Löschen.
- Icon buttons always need a label (`aria-label` + tooltip). A confirmation button says what it
  does ("Löschen", not "OK"), destructive actions use the danger variant.
- Field labels are always visible; placeholders are not labels.

### Color, typography, spacing, motion

- Use **semantic tokens** (`--ha-color-text-primary`, `--ha-color-fill-primary-*`, …), never the
  raw `--ha-color-primary-*` palettes. The semantic tokens switch with dark/light automatically.
  Map the integration's `--fd-*` layer onto semantic tokens, not hex values.
- Type scale tokens `--ha-font-size-xs…5xl` (10/12/14/16/20/24/28/32/40 px), weights
  normal 400 / medium 500 (actions) / bold 700 (headings), line-height 1.2 headings, 1.6 body.
- Spacing is a 4 px scale `--ha-space-1…20` (4/8/12/16/20/24/…). Radii: `--ha-border-radius-sm`
  4, `md` 8, `lg` 12, `xl` 16; cards/dialogs generously rounded, buttons/chips pill-shaped.
- Motion: `--ha-animation-duration-instant` 75 ms, `fast` 150, `normal` 250, `slow` 350.
  Never animate a loop without a `prefers-reduced-motion: reduce` fallback; tokens collapse to 1 ms.

### Accessibility (WCAG 2.2 AA)

- Text contrast ≥ 4.5:1 (large ≥ 3:1); control borders/icons ≥ 3:1. Never colour alone — pair
  with icon or text (alerts always have a type icon).
- Focus ring: 2 px solid `--ha-color-focus`, 2 px offset; visible on every interactive element.
- Keyboard: logical order, no focus traps, one tab stop per composite widget, arrow keys inside
  lists/dialogs/menus, Esc closes, focus returns to the trigger.
- Touch targets ≥ 44×44 px. Labels/`aria-label` for every control; invalid inputs set `aria-invalid`
  and announce the message; async results use `aria-live`.
- German UI text but keep token/entity IDs in backticks.

### Header / app bar (pixel metrics from HA source)

HA's `ha-header-bar`: row height `var(--header-height)` (56 px), background
`var(--app-header-background-color, var(--primary-background-color))`, text
`var(--app-header-text-color, var(--primary-text-color))`, bottom border
`var(--app-header-border-bottom)`, sections padding `0 var(--ha-space-3)` (12 px), icon buttons
48×48 (`--ha-icon-button-size`), title `--ha-font-size-xl` normal weight with
`padding-inline-start: var(--ha-space-6)` (24 px), line-height = header height.
Full viewport width, sticky, no content max-width, no coloured text buttons — icons only.

### Buttons

- Appearances: accent (default), filled, outlined, plain (cancel/dismiss). Variants: brand,
  danger, warning, success, neutral. Sizes: XS 24 px / 8 px padding, S 32/12, **M 40/16 (default)**,
  L 48/16; font 14 px except L 16 px. Focus ring 2 px + 2 px offset. Loading replaces the label
  with a spinner and blocks repeat clicks.
- List rows: 48 px one-line (64 px with second line), 8 px list padding top/bottom, text first,
  actions at the end, chevron only for navigation.

### Dialogs

- Material 3: scrim, rounded surface, **close button top-left**, title (+ optional subtitle),
  optional header icon actions top-right, body padding 0 top / 24 px elsewhere, footer buttons
  bottom-right (12 px gap, 16 px side padding).
- Destructive confirmation: title asks the question, description explains, buttons Cancel + the
  verb (danger), focus starts on Cancel, no close button, no Esc/scrim close while running.
- Unsaved changes: Esc/scrim close is blocked and the dialog shakes; focus returns to the opener.

### Forms

- Visible labels, helper text below the field, `*` for required; validate on submit (or blur),
  error replaces the helper text and moves focus to the first invalid field; form-level errors
  at the top. Password fields must not confuse password managers. Dialog forms autofocus.
- Loading: spinner for unknown areas, busy state on the button that started the action, skeletons
  for known layouts; loading always ends in content, empty state or a readable error.

### Patterns

- Empty states: heading + description + optional action; distinguish "nothing yet" from
  "no results" (filters). Never show an empty state while loading.
- Errors: field error for one field, alert for the page/dialog (icon + message, not colour only),
  toast for a short success (≥4 s, optional Undo), dialog only when a decision is required.
- Confirmations: irreversible → confirmation dialog; reversible → do it and offer Undo.
- Lists: same row anatomy, actions via buttons at the row end or a menu; use `Remove` for grants
  (re-addable) and `Delete` only for permanent deletions.

### Review checklist for every UI change

1. Full-width 56 px app bar with 48 px icon buttons, HA tokens, no coloured text buttons.
2. Semantic colour/typography/spacing/radius/motion tokens only; dark and light theme checked.
3. Focus ring, keyboard order, labels, aria-live, 44 px touch targets, contrast.
4. Dialog anatomy (close top-left, footer bottom-right, destructive dialog semantics).
5. Loading/empty/error states for every async surface; no spinner left running.
6. German UI text follows HA wording rules (Add/Create, Remove/Delete) and sentence case.
7. `node --check`, bare-import guard, DOM smoke test; both HA versions pass.

## Brand, HACS and releases

- Custom integration brand assets live in `custom_components/<domain>/brand/`
  (`icon.png` 256×256, `icon@2x.png` 512×512, optional dark variants).
- HACS cannot read private repositories at all. Make the repo public for HACS.
- HACS installs the default branch when no release exists; a release is preferred.
- Tag exactly the manifest version without `v`; bump every version marker together.
- HACS may cache module URLs; after an update restart HA and hard-reload the browser.

## Testing checklist

- `pytest` with `pytest-homeassistant-custom-component` on the oldest supported and the
  current HA version. Mock all external HTTP.
- Config-flow tests: create entry, options, invalid input, **and schema serialisation**.
- WebSocket tests: build every command schema and validate realistic + invalid messages.
- Frontend tests: `node --check`; guard against bare imports; DOM smoke test with
  `happy-dom` + the vendored `lit.js` (stub `fetch`, assert rendered text, dialogs,
  menus, role gating); report unhandled rejections.
- CI jobs: ruff, mypy, pytest, hassfest, HACS validation, frontend syntax check.

## Debugging quick table

| Symptom | First check |
| --- | --- |
| Panel page is black | Browser console + network: module 404 or `Failed to resolve module specifier` |
| “Config flow could not be loaded: 500” | HA log traceback; schema serialisation (callable validator) |
| “Already in progress” | Stale in-memory flow: close tabs, restart HA |
| Gear opens the old options flow | `config_panel_domain` registration and `hass.panels`; hard reload |
| 403 on every route | Grant missing/default deny; check role mapping, not `require_admin` |
| Images not shown | Auth-protected URL loaded as blob; token/base URL |
| Update not offered | Tag = manifest version, release published, repo public |

## Gate

Run through this checklist before shipping any HA UI change. UI work is reviewed by the
Frontend specialist (Natasha); releases are cut only after both HA versions pass.

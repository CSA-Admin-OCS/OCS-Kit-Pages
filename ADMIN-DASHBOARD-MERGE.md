# Admin Dashboard: merge notes

Branch `admin-dashboard`. Delete this file after merging.

## What the branch adds

| Path | What |
|---|---|
| `navigation/admin/index.md` | `/admin/`: Admin Dashboard (kit, roles and user counts, feature summary with "N need setup", admin tools links) |
| `navigation/admin/features.md` | `/admin/features/`: Feature Manager and setup guides (`/admin/features/?f=<id>` opens one guide) |
| `_includes/admin/gate.html` | Shared top of both pages: build facts for the JS (booleans only), mock banner, live status line, sign-in / no-access panels |
| `assets/js/admin/kit-api.js` | Data layer: identity (Spring `/api/person/get`, Flask `/api/id`), `/api/kit`, `/api/kit/admin`, PUT/DELETE on both backends, mock mode |
| `assets/js/admin/common.js` | View model merging the catalog with both backends' admin payloads, helpers |
| `assets/js/admin/dashboard.js`, `features.js` | Page scripts |
| `assets/js/admin/catalog-fallback.js` | Public parts of the canonical catalog (names, descriptions, labels, setup guides; no values) |
| `assets/js/admin/mock/kit-admin.json` | Mock data (Education kit, sample users) for `?mock=1` |
| `_sass/open-coding/admin-dashboard.scss` | Page styles on top of the ocs__ grammar |
| `_sass/open-coding/elements/{tabs,modals,forms/fields,forms/labels,typography/truncate}` | Pulled verbatim from upstream Open-Coding-Society/pages |

Removed: `navigation/authentication/admin.md` (the old `/admin` page only showed the school nav table).

## Small edits in shared files (already on the branch, check for conflicts)

- `_sass/open-coding/_main.scss`: one line, `@import "open-coding/admin-dashboard";`
- `_sass/open-coding/elements/_main.scss`: `tabs` and `modals` imports
- `_sass/open-coding/elements/forms/_main.scss`: `fields` and `labels` imports
- `_sass/open-coding/elements/typography/_main.scss`: `truncate` import

## Alignment with main (merged in `baaef6b`)

- The nav **Admin** link already exists on main (`assets/js/api/login.js`, `data-feature-admin`,
  shown to Admins by `assets/js/kit-features.js`). It points at `/admin`, which serves `/admin/`.
- "Is this feature's website part built?" comes from `site.data.kit.enabled` (written by
  `scripts/apply_kit.py` into `_data/kit.json`; falls back to `site.kit_enabled`). The rebuild
  snippet keeps the site's `kit: features:` style (`["+id"]` modifiers, or appends to an explicit list).
- After every successful change the Feature Manager clears the kit runtime cache
  (`sessionStorage["ocs-kit-runtime"]`) and calls `OCS_KIT.refresh(true)`, so the nav updates at once.
- Admin pages are not claimed by any feature in `kits/catalog.json`, so `apply_kit.py` treats them as
  core and never prunes them (checked: no `admin` path in `_config.kit.yml` exclude or `_data/kit.json` urls).
- `kits/` is excluded from the build, so the pages use the bundled `assets/js/admin/catalog-fallback.js`.
  Regenerate it whenever `kits/catalog.json` changes names, descriptions, labels or setup guides:

  ```bash
  python3 - <<'PY'
  import json
  c = json.load(open('kits/catalog.json'))
  keep = {k: c[k] for k in ('version', 'feature_management', 'roles', 'categories', 'labels')}
  keep['kits'] = {k: {kk: v[kk] for kk in ('name', 'description', 'features', 'roles', 'signup_role') if kk in v} for k, v in c['kits'].items()}
  keep['features'] = {k: {kk: v[kk] for kk in ('name', 'category', 'labels', 'always_on', 'description', 'setup') if kk in v} for k, v in c['features'].items()}
  p = 'assets/js/admin/catalog-fallback.js'
  src = open(p).read()
  open(p, 'w').write(src[:src.index('export default')] + 'export default ' + json.dumps(keep, indent=2, ensure_ascii=False) + ';\n')
  PY
  ```
- Backend CORS: previews on another port (e.g. 4700) are blocked by the backends' allow list; the
  real site origin (4500 locally) works.

## Backend contract the pages expect

- `GET /api/kit` (public), `GET /api/kit/admin` (401/403 for non-admins),
  `PUT /api/kit/admin/features` with `{"features": {"<id>": bool}}` returning the admin payload,
  `DELETE /api/kit/admin/features/<id>`.
- Admin payload per feature: `enabled`, `source` (`kit` | `env` | `admin`), optional `updated_by`,
  `setup.settings[]` with `configured`, and `ready`. Flask's public payload may use `name` instead of
  `kit_name`; both are accepted.
- User counts use Spring `GET /api/people` (roles); if it fails the card says counts are unavailable.

## Testing without backends

`/admin/?mock=1`, `/admin/features/?mock=1` (Admin), `?mock=staff`, `?mock=member`, `?mock=anon`.
Add `&mockfail=flask` (or `spring`) to see a partial failure, `&mockfail=403` for a rejected change.

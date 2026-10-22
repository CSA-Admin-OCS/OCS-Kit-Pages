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

## Edits for you to apply at merge (files this branch did not touch)

1. **Nav link** (shared nav include / runtime nav script): show "Admin" linking to
   `{{ site.baseurl }}/admin/` for Admins only (Spring `ROLE_ADMIN` or Flask `role == "Admin"`).
   Optional: for staff, a "Features" link to `/admin/features/` (they get a read-only list).
   The pages themselves already block everyone else, so a visible link is harmless.
2. **`scripts/apply_kit.py`**: `navigation/admin/**`, `_includes/admin/**`, `assets/js/admin/**` and
   `_sass/open-coding/admin-dashboard.scss` belong to the `core` feature (never pruned).
3. **Catalog on the site**: the pages first try `{{ site.baseurl }}/kits/catalog.json` and fall back to
   `assets/js/admin/catalog-fallback.js`. If `kits/` is in `_config.yml` `exclude`, either keep it
   copied or regenerate the fallback whenever the catalog changes:

   ```bash
   python3 - <<'EOF'
   import json
   c = json.load(open('kits/catalog.json'))
   keep = {k: c[k] for k in ('version', 'feature_management', 'roles', 'categories', 'labels')}
   keep['kits'] = {k: {kk: v[kk] for kk in ('name', 'description', 'features', 'roles', 'signup_role') if kk in v} for k, v in c['kits'].items()}
   keep['features'] = {k: {kk: v[kk] for kk in ('name', 'category', 'labels', 'always_on', 'description', 'setup') if kk in v} for k, v in c['features'].items()}
   src = open('assets/js/admin/catalog-fallback.js').read()
   head = src[:src.index('export default')]
   open('assets/js/admin/catalog-fallback.js', 'w').write(head + 'export default ' + json.dumps(keep, indent=2, ensure_ascii=False) + ';\n')
   EOF
   ```
4. **`_config.yml`**: nothing required. The pages read `site.kit.features` (empty list = every
   feature's pages are in the build) to say when a feature needs a website rebuild, and report only
   whether each `site.kit.*` key is set (never its value).
5. **Backend CORS**: previews on another port (e.g. 4700) are blocked by the backends' CORS allow
   list; the real site origin already works.

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

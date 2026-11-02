# OCS-in-a-Kit: Pages

A Jekyll site for a school computer science program: lessons, notebooks, games, a student/teacher toolkit and login/profile pages that talk to the OCS-in-a-Kit Flask and Spring backends. Use it as a GitHub template, set a few values and deploy to GitHub Pages.

Based on the Open Coding Society pages project (see `LICENSE`).

## 1. Create your site

1. On GitHub, click **Use this template** and create a repository under your school's account or organization.
2. Clone it:

```bash
git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>
```

## 2. Configure `_config.yml`

Edit the top of `_config.yml`:

| Key | What to set |
| --- | --- |
| `title`, `description`, `owner_name` | Your school or program name |
| `github_username`, `github_repo` | Where this repository lives (used for notebook links) |
| `baseurl` | `""` for a custom domain or `<user>.github.io`; `"/<repo-name>"` for a project site. CI sets it from the repo name automatically. |
| `minima.social_links` | Your school's links |

Then the `kit:` block, which holds everything school-specific:

```yaml
kit:
  school_name: "Your School"
  schools: []            # profile-page school dropdown; or edit _data/kit_school.yml
  backend:
    flask: "https://flask.example.com"     # deployed Flask backend
    spring: "https://spring.example.com"   # deployed Spring backend
    flask_local: "http://localhost:8587"   # used when the site runs on localhost
    spring_local: "http://localhost:8585"
  name: education         # vanilla | education | business
  features: []            # [] = the preset; see "Choosing a kit"
  build: all              # all | kit; see "Build modes"
```

`assets/js/api/config.js` reads `kit.backend` at build time, so every page that imports `pythonURI` / `javaURI` uses your servers. Your backends must allow your Pages origin in their CORS settings.

AI chat features call the Flask backend's `/api/gemini` proxy. Set `GEMINI_API_KEY` on the backend; no keys belong in this repository (see `.env.example`).

## 3. Run locally

Requirements: Ruby with Bundler, Python 3, `make`.

```bash
./scripts/venv.sh          # creates venv/, installs Python and Ruby dependencies
source venv/bin/activate
make                       # converts notebooks, builds projects, serves the site
```

The server address is printed when `make` finishes (default `http://localhost:4500`). Other targets: `make stop`, `make clean`, `make build`. A second `make` only reconverts notebooks that changed.

## 4. Deploy to GitHub Pages

1. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The `.github/workflows/jekyll-gh-pages.yml` workflow converts notebooks, computes `baseurl` from the repository name (or uses `""` when a `CNAME` file exists) and publishes the site.

## Choosing a kit

The site ships in three presets. An Admin picks one at **Admin > Manage features > Start from a kit** with no rebuild; `kit.name` in `_config.yml` is the fallback for when no backend answers:

| Kit | For | Features |
| --- | --- | --- |
| `vanilla` | Handing the site to students | core |
| `education` | A CS classroom | core, lessons, code-runner, assignments, game-engine, ai-chatbot, ai-grading, calendar, analytics, hallpass, social, resume |
| `business` | Organizations (no students) | core, ai-chatbot, social, calendar, analytics, resume |

Menus hide links to features that are off and their pages show a "This feature is turned off" message. Core (home, login, signup, profile, blog, search, admin) is always on.

### Build modes

`kit.build` in `_config.yml` decides which pages this build contains:

| `kit.build` | What ships | Trade-off |
| --- | --- | --- |
| `all` (default) | Every feature's pages, notebooks and projects | Admins switch kits and features from the website with no rebuild. A larger site. |
| `kit` | Only the pages of `kit.name` / `kit.features` | A smaller site, but turning on any other feature needs a rebuild (the Feature Manager says so). |

`make KIT=vanilla` and `apply_kit.py --kit vanilla` build exactly that kit, so they imply `kit`; add `KIT_BUILD=all` or `--build all` to keep every page. Hidden pages are public static files in `all` mode: the switch controls what people see, and the backends enforce access.

| Feature | Category | Labels | Vanilla | Education | Business | Main paths |
| --- | --- | --- | --- | --- | --- | --- |
| `core` | core | student-safe, personal-data | yes | yes | yes | everything not listed below |
| `lessons` | education | classroom, student-safe |  | yes |  | `_notebooks/JavaScriptLessons/`, `_notebooks/Foundations/2025-02-05-network_stack.ipynb`, `_notebooks/Foundations/2026-02-16-variables_instructor_hw.ipynb` ... |
| `code-runner` | general | runs-code, student-safe |  | yes |  | `_posts/2026-01-03-code-runner-examples.md`, `_posts/2026-01-03-ui-runner-examples.md`, `_notebooks/Foundations/2025-12-27-code-runner.ipynb` ... |
| `assignments` | education | classroom, teacher-tools, personal-data |  | yes |  | `navigation/toolkit/student.md`, `navigation/toolkit/student_aesthetihawk.md`, `navigation/toolkit/teacher.md` ... |
| `game-engine` | general | student-safe |  | yes |  | `assets/js/GameEnginev1/`, `assets/js/GameEnginev1.1/`, `_projects/games/` ... |
| `ai-chatbot` | general | needs-api-key, third-party-data |  | yes | yes | `_layouts/chatbot.html`, `_layouts/certchatbot.html`, `_layouts/base_chatadpt.html` ... |
| `ai-grading` | education | classroom, teacher-tools, needs-api-key, third-party-data |  | yes |  | (backend only) |
| `social` | general | user-content |  | yes | yes | `_includes/microblog_foundation.html`, `_includes/inbox_foundation.html`, `_includes/feedback_foundation.html` ... |
| `calendar` | general | teacher-tools |  | yes | yes | `navigation/toolkit/calendar.md`, `_layouts/calendar.html`, `_includes/calendar.html` ... |
| `analytics` | general | teacher-tools, personal-data |  | yes | yes | `navigation/authentication/analytics-dashboard.md`, `navigation/authentication/stats.md`, `navigation/toolkit/analytics_help.md` ... |
| `hallpass` | education | classroom, teacher-tools |  | yes |  | (backend only) |
| `finance-sim` | general | simulation, student-safe |  |  |  | `_layouts/finance.html`, `_layouts/fortunefindersBank.html`, `_layouts/fortunefindersCasino.html` ... |
| `resume` | general | personal-data |  | yes | yes | (backend only) |
| `kasm` | general | needs-external-service |  |  |  | `images/kasm/`, `_data/kasm_flashcard.yml` |
| `face-recognition` | general | privacy-sensitive, personal-data |  |  |  | `navigation/authentication/facial_recognition.md` |
| `examples` | general | demo, student-safe |  |  |  | `features/hacks/`, `features/media-literacy/`, `_includes/hack.html` |

The full list with descriptions, labels and setup steps is in `kits/catalog.json`.

## Customizing features

`kit.features` in `_config.yml` adjusts the preset:

```yaml
kit:
  name: education
  features: []                          # the preset as is
  # features: ["+finance-sim", "-hallpass"]   add / remove relative to the preset
  # features: ["lessons", "code-runner"]       exactly these (core is always on)
  # features: ["*"]                            everything
```

1. Edit `kit.name` / `kit.features`.
2. Preview the result: `python scripts/apply_kit.py --list` (or `make kit-list`).
3. Run `make` (local) or push (GitHub Pages). For a one-off trimmed build: `make KIT=vanilla` or `make FEATURES=+finance-sim,-social`.

### Run time

Every page asks both `{javaURI}/api/kit` and `{pythonURI}/api/kit` and caches the answer for 60 seconds (`assets/js/kit-features.js`). Changes in the Feature Manager apply at once for that Admin.

- If both answer, a feature is on only if both say on, and the admin pages show the disagreement. If one answers, the other's last known answer still counts.
- **During an outage** the last known answers stay in force (kept in the browser), so what an Admin turned off stays off.
- **If no answer was ever seen**, menus follow `kit.name` / `kit.features` and no page is replaced.
- **Side effects fail closed.** Trackers, comment and social widgets, the camera and outside APIs start only after the check passes, and stop if the feature goes off. Put such markup in `<template data-kit-load="my-feature">`, or check `OCS_KIT.canRun('my-feature')` in scripts. Requests that belong to a feature are listed in `RULES` in `kit-features.js`.

`?mock=1` on the admin pages uses sample data for testing. It works only on `localhost` and `127.0.0.1`, never lets a side effect run, and CI leaves the sample data out of the site (`--no-mock-fixtures`).

Tests: `make kit-test` (no dependencies) and `scripts/tests/kit_browser.js` (playwright-core, see its header).

## Adding a new feature

`kits/catalog.json` is the only file to edit; navigation guards read the generated `site.data.kit`.

1. Add the feature to the canonical catalog in the OCS-Kit repository (id, name, category, labels, kits), then copy it here: `python scripts/apply_kit.py --sync-canonical ../OCS-Kit/kits/catalog.json`.
2. In `kits/catalog.json`, list the feature's files under `"pages"`: folders end with `/`, globs are allowed. Notebooks (`_notebooks/...`) and projects (`_projects/...`) also exclude their generated output.
3. Run `python scripts/apply_kit.py --check`: it fails on unknown ids, paths that do not exist, paths claimed by two features and drift from the canonical catalog. CI runs the same check.
4. Links in shared pages: use the `kit/link.html` include (`include kit/link.html url="/my-page" text="My page"`). Mark other markup with `data-feature="my-feature"` so run-time switches hide it (links to the feature's pages are marked automatically). `site.data.kit.disabled` only lists features left out of a `kit.build: kit` build, and is empty in `all` mode, so it must not be the only guard for anything with side effects.

## Where things live

- `_notebooks/` - Jupyter lessons, converted to posts at build time
- `_posts/` - Markdown posts
- `_projects/` - self-contained projects registered in `_projects/.makeprojects`
- `features/` - optional feature pages (predictors, media literacy, hacks)
- `kits/catalog.json` - kit presets and which files belong to which feature
- `scripts/apply_kit.py` - applies the kit (generates `_config.kit.yml`, `_data/kit*.json`)
- `navigation/` - top-level pages (login, profile, toolkit, search)
- `_data/kit_school.yml` - school options for the profile page

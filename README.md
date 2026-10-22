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
  name: business          # vanilla | education | business
  features: []            # [] = the preset; see "Choosing a kit"
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

The site ships in three presets. Pick one with `kit.name` in `_config.yml`:

| Kit | For | Features |
| --- | --- | --- |
| `vanilla` | Handing the site to students | core |
| `education` | A CS classroom | core, lessons, code-runner, assignments, game-engine, ai-chatbot, ai-grading, calendar, analytics, hallpass, social, resume |
| `business` | Organizations (no students) | core, ai-chatbot, social, calendar, analytics, resume |

Pages of features that are off are not built (and their notebooks/projects are not converted), and menus hide links to them. Core (home, login, signup, profile, blog, search, admin) is always on.

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
3. Run `make` (local) or push (GitHub Pages). For a one-off build: `make KIT=vanilla` or `make FEATURES=+finance-sim,-social`.

Admins can also switch features off at run time from the backends: every page asks `{javaURI}/api/kit` (then `{pythonURI}/api/kit`), caches the answer for 5 minutes and hides links of features that are off. If no backend answers, the build-time selection is used.

## Adding a new feature

`kits/catalog.json` is the only file to edit; navigation guards read the generated `site.data.kit`.

1. Add the feature to the canonical catalog in the OCS-Kit repository (id, name, category, labels, kits), then copy it here: `python scripts/apply_kit.py --sync-canonical ../OCS-Kit/kits/catalog.json`.
2. In `kits/catalog.json`, list the feature's files under `"pages"`: folders end with `/`, globs are allowed. Notebooks (`_notebooks/...`) and projects (`_projects/...`) also exclude their generated output.
3. Run `python scripts/apply_kit.py --check`: it fails on unknown ids, paths that do not exist, paths claimed by two features and drift from the canonical catalog. CI runs the same check.
4. Links in shared pages: use the `kit/link.html` include (`include kit/link.html url="/my-page" text="My page"`), or wrap markup in an `unless site.data.kit.disabled contains 'my-feature'` block. Mark menu items with `data-feature="my-feature"` so run-time switches hide them too (links to the feature's pages are marked automatically).

## Where things live

- `_notebooks/` - Jupyter lessons, converted to posts at build time
- `_posts/` - Markdown posts
- `_projects/` - self-contained projects registered in `_projects/.makeprojects`
- `features/` - optional feature pages (predictors, media literacy, hacks)
- `kits/catalog.json` - kit presets and which files belong to which feature
- `scripts/apply_kit.py` - applies the kit (generates `_config.kit.yml`, `_data/kit*.json`)
- `navigation/` - top-level pages (login, profile, toolkit, search)
- `_data/kit_school.yml` - school options for the profile page

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
  features: []           # filled by kit presets
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

The server address is printed when `make` finishes (default `http://localhost:4500`). Other targets: `make stop`, `make clean`, `make build`.

## 4. Deploy to GitHub Pages

1. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The `.github/workflows/jekyll-gh-pages.yml` workflow converts notebooks, computes `baseurl` from the repository name (or uses `""` when a `CNAME` file exists) and publishes the site.

## Where things live

- `_notebooks/` - Jupyter lessons, converted to posts at build time
- `_posts/` - Markdown posts
- `_projects/` - self-contained projects registered in `_projects/.makeprojects`
- `features/` - optional feature pages (predictors, media literacy, hacks)
- `navigation/` - top-level pages (login, profile, toolkit, search)
- `_data/kit_school.yml` - school options for the profile page

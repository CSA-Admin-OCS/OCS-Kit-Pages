#!/usr/bin/env python3
"""Apply the OCS-in-a-Kit feature selection to this Jekyll site.

kits/catalog.json is the single source of truth: it lists every feature
(id, name, category, labels, description) and, under "pages", the files and
folders of this repo that belong to it. Kit presets live in the same file
under "kits". Everything not claimed by a feature is core and always built.

_config.yml chooses the kit:

    kit:
      name: education          # vanilla | education | business (the preset)
      features: []             # [] = use the preset as is
      # features: ["+finance-sim", "-hallpass"]   add/remove relative to the preset
      # features: ["lessons", "code-runner"]      explicit list (core is always on)
      # features: ["*"]                           every feature

Usage (run from the repo root; `make` does this for you):

    python scripts/apply_kit.py            write _config.kit.yml + _data/kit*.json
    python scripts/apply_kit.py --list     show kits, features and what is enabled
    python scripts/apply_kit.py --check    validate the catalog (CI runs this)
    python scripts/apply_kit.py --enabled-projects   registered _projects to build
    python scripts/apply_kit.py --sync-canonical PATH   copy ids/names/kits from
                                           the OCS-Kit canonical catalog, keep "pages"

Options: --kit NAME and --features "a,b,-c" override _config.yml (used to
build test sites); --root DIR runs against another checkout.

Generated files (gitignored, rewritten only when their content changes):
    _config.kit.yml         exclude: (merged with _config.yml's list) + kit_enabled
    _data/kit_features.json ["core", "lessons", ...]  -> site.data.kit_features
    _data/kit.json          kit name, enabled/disabled ids, url->feature map,
                            role labels -> site.data.kit and assets/js/kit-features.js
"""
import argparse
import fnmatch
import json
import os
import re
import sys

try:
    import yaml
except ImportError:  # PyYAML is in requirements.txt; fall back to a tiny reader
    yaml = None

ROOT = os.getcwd()
CATALOG = "kits/catalog.json"
CANONICAL_DEFAULT = os.path.join("..", "OCS-Kit", "kits", "catalog.json")
# Keys that exist only in this repo's catalog (everything else must match the canonical one)
LOCAL_FEATURE_KEYS = {"pages", "notes"}
LOCAL_TOP_KEYS = {"description", "pages_help"}
PAGE_EXTS = (".md", ".markdown", ".html", ".ipynb")


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------

def _path(*parts):
    return os.path.join(ROOT, *parts)


def load_catalog():
    with open(_path(CATALOG), encoding="utf-8") as f:
        return json.load(f)


def load_config():
    """Return the parsed _config.yml (only the parts we need when PyYAML is missing)."""
    with open(_path("_config.yml"), encoding="utf-8") as f:
        text = f.read()
    if yaml:
        return yaml.safe_load(text) or {}
    # Minimal fallback: kit.name, kit.features (flow list) and top-level exclude list
    cfg, kit, exclude, section = {}, {}, [], None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" "):
            section = line.split(":")[0].strip()
            continue
        if section == "kit":
            m = re.match(r"^\s{2}(name|features):\s*(.*?)\s*(#.*)?$", line)
            if m:
                kit[m.group(1)] = json.loads(m.group(2)) if m.group(1) == "features" else m.group(2).strip("\"'")
        elif section == "exclude":
            m = re.match(r"^\s*-\s*(.+?)\s*$", line)
            if m:
                exclude.append(m.group(1).strip("\"'"))
    cfg["kit"], cfg["exclude"] = kit, exclude
    return cfg


# --------------------------------------------------------------------------
# Resolving the enabled feature set
# --------------------------------------------------------------------------

class KitError(Exception):
    pass


def resolve(catalog, kit_name, overrides):
    """Return the ordered list of enabled feature ids.

    overrides: [] -> preset; items without +/- form an explicit base list
    ("*" = all features); "+id" / "-id" then add/remove. core is always on.
    """
    features = catalog["features"]
    order = list(features)
    kits = catalog["kits"]
    if kit_name not in kits:
        raise KitError(f"unknown kit '{kit_name}' (choose one of: {', '.join(kits)})")
    overrides = [str(x).strip() for x in (overrides or []) if str(x).strip()]
    base_items = [x for x in overrides if x[0] not in "+-"]
    if base_items:
        base = base_items
    else:
        base = kits[kit_name]["features"]
    enabled = set()
    for fid in base:
        if fid == "*":
            enabled.update(order)
        elif fid in features:
            enabled.add(fid)
        else:
            raise KitError(f"unknown feature '{fid}'")
    for item in overrides:
        if item[0] in "+-":
            fid = item[1:]
            if fid == "*":
                if item[0] == "+":
                    enabled.update(order)
                else:
                    enabled.clear()
                continue
            if fid not in features:
                raise KitError(f"unknown feature '{fid}' in '{item}'")
            if item[0] == "+":
                enabled.add(fid)
            else:
                if features[fid].get("always_on"):
                    raise KitError(f"'{fid}' is always on and cannot be removed")
                enabled.discard(fid)
    for fid, spec in features.items():
        if spec.get("always_on"):
            enabled.add(fid)
    return [fid for fid in order if fid in enabled]


def selection(args=None):
    """(catalog, kit_name, overrides, enabled) from _config.yml plus CLI overrides."""
    catalog = load_catalog()
    kit_cfg = (load_config().get("kit") or {})
    kit_name = (getattr(args, "kit", None) or kit_cfg.get("name") or "business").strip()
    if getattr(args, "features", None) is not None:
        overrides = [x for x in args.features.split(",")]
    else:
        overrides = kit_cfg.get("features") or []
        if isinstance(overrides, str):
            overrides = [overrides]
    return catalog, kit_name, overrides, resolve(catalog, kit_name, overrides)


# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

def matches(path, pattern):
    """Jekyll's exclude semantics: fnmatch, or plain string prefix."""
    pattern = pattern.rstrip("/")
    return fnmatch.fnmatch(path, pattern) or path == pattern or path.startswith(pattern + "/") \
        or (not any(c in pattern for c in "*?[") and path.startswith(pattern))


def registered_projects():
    """Project paths from _projects/.makeprojects (without :dev)."""
    path = _path("_projects", ".makeprojects")
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                out.append(line.split(":")[0])
    return out


def project_dirs_under(pattern):
    """Project names (basename) whose _projects/<path> falls under pattern."""
    names = []
    for proj in registered_projects():
        if matches(f"_projects/{proj}", pattern) or matches(f"_projects/{proj}/", pattern):
            names.append(os.path.basename(proj))
    # unregistered project folders too (anything with an index.* or Makefile)
    base = _path(pattern.rstrip("/"))
    if os.path.isdir(base):
        for dirpath, dirnames, filenames in os.walk(base):
            if any(n in filenames for n in ("index.ipynb", "index.md")):
                name = os.path.basename(dirpath)
                if name not in names:
                    names.append(name)
    return names


def derived_patterns(pattern):
    """Generated outputs that come from a source pattern.

    _notebooks/X.ipynb  -> _posts/X (prefix: covers _IPYNB_2_.md and course splits)
    _projects/<p>       -> every place the project Makefile copies to
    """
    out = []
    p = pattern.rstrip("/")
    if p.startswith("_notebooks/"):
        out.append("_posts/" + p[len("_notebooks/"):].replace(".ipynb", ""))
    elif p.startswith("_posts/") and p.endswith((".md", ".markdown")):
        out.append(re.sub(r"\.(md|markdown)$", "", p))  # course-split variants
    elif p.startswith("_projects/"):
        for name in project_dirs_under(pattern):
            out += [f"_notebooks/projects/{name}", f"_posts/projects/{name}",
                    f"_posts/projects/*-{name}.md", f"assets/js/projects/{name}",
                    f"assets/css/projects/{name}", f"_sass/projects/{name}",
                    f"images/projects/{name}", f"_includes/projects/{name}"]
    return out


def feature_patterns(catalog, fid, derived=True):
    pats = list(catalog["features"][fid].get("pages", []))
    if derived:
        for p in list(pats):
            pats += derived_patterns(p)
    return pats


def disabled_patterns(catalog, enabled):
    pats = []
    for fid in catalog["features"]:
        if fid not in enabled:
            pats += feature_patterns(catalog, fid)
    return pats


def disabled_globs(prefix=None):
    """Patterns for disabled features using the current _config.yml (for converters)."""
    catalog, _, _, enabled = selection()
    pats = disabled_patterns(catalog, enabled)
    return [p for p in pats if prefix is None or p.startswith(prefix)]


def is_disabled(path, patterns):
    path = os.path.relpath(os.path.abspath(path), ROOT).replace(os.sep, "/")
    return any(matches(path, p) for p in patterns)


SKIP_DIRS = {".git", "_site", "venv", ".venv", ".bundle", "node_modules", ".sass-cache",
             ".jekyll-cache", "vendor", "port_venv"}


def repo_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT).replace(os.sep, "/")
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not (rel == "." and d.startswith("."))]
        for name in filenames:
            yield (name if rel == "." else f"{rel}/{name}")


def front_matter(path):
    """permalink/title from a page's front matter (md/html) or a notebook's first cell."""
    try:
        with open(_path(path), encoding="utf-8") as f:
            if path.endswith(".ipynb"):
                cells = json.load(f).get("cells") or []
                src = cells[0].get("source", "") if cells else ""
                text = "".join(src) if isinstance(src, list) else src
            else:
                text = f.read(4000)
    except (OSError, ValueError):
        return {}
    m = re.match(r"\s*---\s*\n(.*?)\n---", text, re.S)
    if not m:
        return {}
    fm = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"^(permalink|title):\s*(.*?)\s*$", line)
        if mm:
            fm[mm.group(1)] = mm.group(2).strip("\"'")
    return fm


def feature_urls(catalog, files):
    """Map each page permalink owned by a feature -> feature id (for nav guards)."""
    urls = {}
    for fid in catalog["features"]:
        pats = feature_patterns(catalog, fid, derived=False)
        if not pats:
            continue
        for path in files:
            if path.endswith(PAGE_EXTS) and any(matches(path, p) for p in pats):
                for link in page_urls(path):
                    urls.setdefault(link, fid)
    return dict(sorted(urls.items()))


def page_urls(path):
    """URLs a page is served at, normalised without a trailing slash ("/guides/" -> "/guides").

    A front-matter permalink wins; otherwise a plain page outside the _underscore dirs is served
    at its path (dir/index.md -> /dir, dir/page.md -> /dir/page and /dir/page.html)."""
    link = front_matter(path).get("permalink")
    if link:
        return [link.rstrip("/") or "/"] if link.startswith("/") else []
    if path.endswith(".ipynb") or any(part.startswith("_") for part in path.split("/")):
        return []
    stem = "/" + os.path.splitext(path)[0]
    if stem == "/index":
        return []
    if stem.endswith("/index"):
        return [stem[:-len("/index")]]
    return [stem, stem + ".html"]


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------

def write_if_changed(rel, content):
    path = _path(rel)
    try:
        with open(path, encoding="utf-8") as f:
            if f.read() == content:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


ADMIN_CATALOG_JS = "assets/js/admin/catalog-fallback.js"


def admin_catalog_js(catalog):
    """Public parts of the catalog for the Admin Dashboard (names, labels, setup guides; no values)."""
    keep = {k: catalog[k] for k in ("version", "feature_management", "roles", "categories", "labels") if k in catalog}
    keep["kits"] = {k: {kk: v[kk] for kk in ("name", "description", "features", "roles", "signup_role") if kk in v}
                    for k, v in catalog["kits"].items()}
    keep["features"] = {k: {kk: v[kk] for kk in ("name", "category", "labels", "always_on", "description", "setup") if kk in v}
                        for k, v in catalog["features"].items()}
    return ("// GENERATED by scripts/apply_kit.py from kits/catalog.json. Do not edit.\n"
            "// Public parts of the kit catalog for the Admin Dashboard: feature names, descriptions,\n"
            "// labels and setup guides. Contains setting NAMES and help text only, never values.\n"
            "export default " + json.dumps(keep, indent=2, ensure_ascii=False) + ";\n")


def apply(args):
    catalog, kit_name, overrides, enabled = selection(args)
    disabled = [fid for fid in catalog["features"] if fid not in enabled]
    base_exclude = list(load_config().get("exclude") or [])
    exclude = base_exclude + [p for p in disabled_patterns(catalog, enabled) if p not in base_exclude]
    files = list(repo_files())
    urls = feature_urls(catalog, files)
    kit = catalog["kits"][kit_name]

    lines = ["# GENERATED by scripts/apply_kit.py from _config.yml kit: + kits/catalog.json.",
             "# Do not edit; pass it after _config.yml: jekyll build --config _config.yml,_config.kit.yml",
             f"kit_name: {json.dumps(kit_name)}",
             "kit_enabled: " + json.dumps(enabled),
             "exclude:"] + [f"  - {json.dumps(p)}" for p in exclude]
    changed = write_if_changed("_config.kit.yml", "\n".join(lines) + "\n")
    changed |= write_if_changed("_data/kit_features.json", json.dumps(enabled, indent=2) + "\n")
    data = {
        "kit": kit_name,
        "name": kit.get("name", kit_name),
        "enabled": enabled,
        "disabled": disabled,
        "urls": urls,
        "disabled_urls": sorted(u for u, f in urls.items() if f in disabled)
                         + sorted(u + "/" for u, f in urls.items() if f in disabled and u != "/"),
        "features": {fid: {"name": f.get("name", fid), "category": f.get("category"),
                           "labels": f.get("labels", [])}
                     for fid, f in catalog["features"].items()},
        "roles": {rid: r.get("label", rid) for rid, r in (kit.get("roles") or {}).items()},
        "signup_role": kit.get("signup_role", "member"),
    }
    changed |= write_if_changed("_data/kit.json", json.dumps(data, indent=2) + "\n")
    changed |= write_if_changed(ADMIN_CATALOG_JS, admin_catalog_js(catalog))
    if not args.quiet:
        print(f"Kit: {kit_name} ({len(enabled)}/{len(catalog['features'])} features: {', '.join(enabled)})"
              + (" [updated]" if changed else ""))


# --------------------------------------------------------------------------
# --list / --check / --enabled-projects / --sync-canonical
# --------------------------------------------------------------------------

def cmd_list(args):
    catalog, kit_name, overrides, enabled = selection(args)
    feats = catalog["features"]
    print("Kits (kits/catalog.json):")
    for kid, kit in catalog["kits"].items():
        mark = "*" if kid == kit_name else " "
        print(f" {mark} {kid:10} {kit.get('name', '')}: {', '.join(kit['features'])}")
    print(f"\nSelected: kit.name={kit_name}  kit.features={json.dumps(overrides)}")
    print(f"\n{'on':3} {'feature':17} {'category':10} {'pages':>5}  labels")
    for fid, f in feats.items():
        on = "yes" if fid in enabled else " - "
        print(f"{on:3} {fid:17} {f.get('category', ''):10} {len(f.get('pages', [])):>5}  {', '.join(f.get('labels', []))}")
    print(f"\nEnabled ({len(enabled)}): {', '.join(enabled)}")
    off = [fid for fid in feats if fid not in enabled]
    print(f"Disabled ({len(off)}): {', '.join(off) or '-'}")


def strip_local(catalog):
    c = {k: v for k, v in catalog.items() if k not in LOCAL_TOP_KEYS}
    c["features"] = {fid: {k: v for k, v in f.items() if k not in LOCAL_FEATURE_KEYS}
                     for fid, f in catalog["features"].items()}
    return c


def find_canonical(explicit=None):
    for cand in [explicit, os.environ.get("OCS_KIT_CATALOG"), _path(CANONICAL_DEFAULT)]:
        if cand and os.path.exists(cand):
            return cand
    return None


def cmd_check(args):
    errors, warnings = [], []
    try:
        with open(_path(ADMIN_CATALOG_JS)) as fh:
            if fh.read() != admin_catalog_js(load_catalog()):
                errors.append(f"{ADMIN_CATALOG_JS} is out of date with kits/catalog.json: run `python scripts/apply_kit.py`")
    except FileNotFoundError:
        errors.append(f"{ADMIN_CATALOG_JS} is missing: run `python scripts/apply_kit.py`")
    catalog = load_catalog()
    feats, kits = catalog.get("features", {}), catalog.get("kits", {})
    labels, cats = catalog.get("labels", {}), catalog.get("categories", {})

    # ids, categories, labels, kits
    for fid, f in feats.items():
        if f.get("category") not in cats:
            errors.append(f"feature '{fid}': unknown category '{f.get('category')}'")
        for lab in f.get("labels", []):
            if lab not in labels:
                errors.append(f"feature '{fid}': unknown label '{lab}'")
        if not isinstance(f.get("pages", []), list):
            errors.append(f"feature '{fid}': 'pages' must be a list")
    for kid, kit in kits.items():
        for fid in kit.get("features", []):
            if fid != "*" and fid not in feats:
                errors.append(f"kit '{kid}': unknown feature '{fid}'")

    # paths exist and are claimed once
    files = list(repo_files())
    owner = {}
    for fid, f in feats.items():
        if f.get("always_on") and f.get("pages"):
            errors.append(f"feature '{fid}' is always on; it must not list pages")
        for pat in f.get("pages", []):
            if pat.startswith("/") or ".." in pat.split("/"):
                errors.append(f"feature '{fid}': path must be repo-relative: {pat}")
                continue
            hits = [p for p in files if matches(p, pat)]
            if not hits:
                errors.append(f"feature '{fid}': path does not exist: {pat}")
            for p in hits:
                if p in owner and owner[p][0] != fid:
                    errors.append(f"path claimed by two features: {p} ({owner[p][0]}: {owner[p][1]}, {fid}: {pat})")
                owner.setdefault(p, (fid, pat))
    # core layouts/includes must never be excluded
    for p in ("_layouts/opencs.html", "_layouts/post.html", "_layouts/page.html",
              "_includes/themes/minima/base.html", "_includes/themes/minima/header.html",
              "_includes/head-custom.html", "assets/js/api/config.js", "assets/js/api/login.js",
              "assets/js/kit-features.js", "index.md"):
        if p in owner:
            errors.append(f"core file {p} is claimed by feature '{owner[p][0]}'")

    # _config.yml selection
    try:
        selection(args)
    except KitError as e:
        errors.append(f"_config.yml kit: {e}")

    # canonical catalog (OCS-Kit/kits/catalog.json)
    canon_path = find_canonical(args.canonical)
    if canon_path:
        with open(canon_path, encoding="utf-8") as f:
            canon = json.load(f)
        mine = strip_local(catalog)
        canon_cmp = {k: v for k, v in canon.items() if k not in LOCAL_TOP_KEYS}
        if list(feats) != list(canon.get("features", {})):
            missing = [x for x in canon["features"] if x not in feats]
            extra = [x for x in feats if x not in canon["features"]]
            errors.append(f"feature ids differ from canonical {canon_path}: missing {missing}, extra {extra}"
                          + ("" if missing or extra else " (order differs)"))
        for key in sorted(set(mine) | set(canon_cmp)):
            if key == "features":
                for fid in canon["features"]:
                    if fid in mine["features"] and mine["features"][fid] != canon["features"][fid]:
                        diff = [k for k in set(mine["features"][fid]) | set(canon["features"][fid])
                                if mine["features"][fid].get(k) != canon["features"][fid].get(k)]
                        errors.append(f"feature '{fid}' differs from canonical in: {', '.join(sorted(diff))}")
            elif mine.get(key) != canon_cmp.get(key):
                errors.append(f"'{key}' differs from canonical catalog (run --sync-canonical)")
    else:
        warnings.append("canonical OCS-Kit catalog not found (set OCS_KIT_CATALOG); skipped id/kit comparison")

    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"error: {e}")
    claimed = len(owner)
    print(f"kit catalog: {len(feats)} features, {len(kits)} kits, {claimed} files mapped, "
          f"{len(errors)} error(s)")
    return 1 if errors else 0


def cmd_enabled_projects(args):
    catalog, _, _, enabled = selection(args)
    pats = disabled_patterns(catalog, enabled)
    wanted = None
    if args.projects is not None:
        wanted = args.projects.split()
    for proj in (wanted if wanted is not None else registered_projects()):
        name = proj.split(":")[0]
        if not any(matches(f"_projects/{name}", p) for p in pats):
            print(proj)


def cmd_sync(args):
    """Copy every canonical field into kits/catalog.json, keeping local pages/notes."""
    canon_path = find_canonical(args.sync_canonical)
    if not canon_path:
        sys.exit(f"canonical catalog not found: {args.sync_canonical}")
    with open(canon_path, encoding="utf-8") as f:
        canon = json.load(f)
    try:
        mine = load_catalog()
    except OSError:
        mine = {"features": {}}
    out = {"description": mine.get("description", "")}
    for k, v in canon.items():
        if k in LOCAL_TOP_KEYS:
            continue
        out[k] = v
    out["features"] = {}
    for fid, f in canon["features"].items():
        local = mine.get("features", {}).get(fid, {})
        out["features"][fid] = dict(f)
        for k in LOCAL_FEATURE_KEYS:
            if k in local:
                out["features"][fid][k] = local[k]
        if not f.get("always_on"):
            out["features"][fid].setdefault("pages", [])
    for k in ("pages_help",):
        if k in mine:
            out[k] = mine[k]
    dropped = [fid for fid in mine.get("features", {}) if fid not in canon["features"]]
    with open(_path(CATALOG), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"synced {CATALOG} from {canon_path}" + (f"; dropped features {dropped} (move their pages!)" if dropped else ""))


def main():
    global ROOT
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", help="repo root (default: current directory)")
    ap.add_argument("--kit", help="override kit.name")
    ap.add_argument("--features", help="override kit.features, comma separated (e.g. '+finance-sim,-hallpass')")
    ap.add_argument("--list", action="store_true", help="show kits, features and what is enabled")
    ap.add_argument("--check", action="store_true", help="validate kits/catalog.json (non-zero exit on errors)")
    ap.add_argument("--canonical", help="canonical catalog for --check (default ../OCS-Kit/kits/catalog.json or $OCS_KIT_CATALOG)")
    ap.add_argument("--enabled-projects", action="store_true", help="print registered projects not disabled by the kit")
    ap.add_argument("--projects", help="with --enabled-projects: filter this space-separated list instead")
    ap.add_argument("--sync-canonical", metavar="PATH", nargs="?", const="", help="copy canonical catalog fields")
    ap.add_argument("-q", "--quiet", action="store_true")
    args = ap.parse_args()
    if args.root:
        ROOT = os.path.abspath(args.root)
    try:
        if args.check:
            return cmd_check(args)
        if args.list:
            return cmd_list(args)
        if args.enabled_projects:
            return cmd_enabled_projects(args)
        if args.sync_canonical is not None:
            return cmd_sync(args)
        apply(args)
    except KitError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

---
published: false
---
# Education kit lessons: manifest

Branch `education-lessons`. Everything below is new in this branch unless marked *edit*.
Feature id: **lessons** for all of it. These entries are already added to the `lessons` feature's
`pages` list in `kits/catalog.json` on this branch (`make kit-check` passes, no path claimed twice):

```json
"lessons/", "_notebooks/Lessons/", "_notebooks/Guides/", "_posts/Guides/",
"_includes/lessons/", "assets/js/csa-lessons/", "assets/lessons/", "images/rps/"
```

Derived outputs (`_posts/Lessons*` from `_notebooks/Lessons/`) are excluded automatically.
`_sass/open-coding/csa-unit2-interactive.scss` stays **core** on purpose: it is imported by the core
`_main.scss`, so excluding it would break the stylesheet; it only adds `.u2-*` classes.
The lessons also *use* the existing **code-runner** feature (cells marked `CODE_RUNNER` render as
runners; Python/Java runners need the kit backend). No game-engine lessons were imported.

## Supporting files (feature: lessons unless marked core)

| Path | Purpose |
|---|---|
| `lessons/index.md` | `/lessons/` overview (hub cards) |
| `lessons/python.md` | `/lessons/python/` course index |
| `lessons/java.md` | `/lessons/java/` course index |
| `lessons/guides.md` | `/guides/` index |
| `lessons/MANIFEST.md` | this file (`published: false`, not rendered) |
| `lessons/_tools/import_lessons.py` | re-runnable import + cleaning tool (`python3 lessons/_tools/import_lessons.py <upstream pages clone>`); Jekyll ignores `_tools` |
| `_includes/lessons/course-index.html` | lists pages by `lesson_course`, grouped by `lesson_unit`, ordered by `lesson_order` (kit `ocs__card`/`ocs__table` classes) |
| `assets/js/csa-lessons/unit2-interactives.js` | lesson widgets (`u2-card`: MCQ, trace, order, fill) used by Java units 2-4 |
| `_sass/open-coding/csa-unit2-interactive.scss` | (core) styles for those widgets, built on the kit's sass mixins/variables |
| `_sass/open-coding/_main.scss` | (core) *edit*: one added line `@import "csa-unit2-interactive";` |
| `assets/lessons/java/3-7_bank.zip` | Maven starter project for Java 3.07 homework (build output removed) |
| `images/rps/{rock.jpg,paper.jpeg,scissors.jpeg}` | images used by the VS Code guide's interactive example |

## Navigation (for the nav owner to wire in)

No nav include was edited. Suggested entries: **Lessons** -> `/lessons/`, with children
`/lessons/python/`, `/lessons/java/`, `/guides/`.

## Lesson and guide files

| File | URL | Upstream source |
|---|---|---|
| `_notebooks/Lessons/Python/2026-01-01-python-01-intro.ipynb` | `/lessons/python/intro/` | `_notebooks/Foundation/2026-07-25-Introduction-to-Python.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-02-3-01-variables.ipynb` | `/lessons/python/3-01-variables/` | `_projects/lessons/python/notebooks/2026-07-21-variables_python_instructor.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-03-3-02-data-abstraction.ipynb` | `/lessons/python/3-02-data-abstraction/` | `_projects/lessons/python/notebooks/2025-09-26-data_abstractions_remakers.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-04-3-03-math-expressions.ipynb` | `/lessons/python/3-03-math-expressions/` | `_projects/lessons/python/notebooks/2026-09-15-mathexpressions-lesson.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-05-3-04-strings.ipynb` | `/lessons/python/3-04-strings/` | `_projects/lessons/python/notebooks/2026-09-15-strings_intercepters.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-06-3-05-booleans.ipynb` | `/lessons/python/3-05-booleans/` | `_projects/lessons/python/notebooks/2026-09-15-boolean_scratchers_py_hw.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-07-3-06-conditionals.ipynb` | `/lessons/python/3-06-conditionals/` | `_projects/lessons/python/notebooks/2026-09-25-conditionals-python.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-08-3-07-nested-conditionals.ipynb` | `/lessons/python/3-07-nested-conditionals/` | `_projects/lessons/python/notebooks/2026-09-17-nested-conditionals-python.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-09-3-08-iteration.ipynb` | `/lessons/python/3-08-iteration/` | `_projects/lessons/python/notebooks/2025-09-26-iterations_scratchers_lesson.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-10-3-09-developing-algorithms.ipynb` | `/lessons/python/3-09-developing-algorithms/` | `_projects/lessons/python/notebooks/2026-09-18-developing-algorithms.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-11-3-10-lists.ipynb` | `/lessons/python/3-10-lists/` | `_projects/lessons/python/notebooks/2025-09-30-lists_scratchers_lesson.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-12-3-12-calling-procedures.ipynb` | `/lessons/python/3-12-calling-procedures/` | `_projects/lessons/python/notebooks/2025-10-08-calling_procedures_remakers_lesson.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-13-3-13-developing-procedures.ipynb` | `/lessons/python/3-13-developing-procedures/` | `_projects/lessons/python/notebooks/2025-10-09-developing_procedures_remakers_lesson.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-14-3-14-libraries.ipynb` | `/lessons/python/3-14-libraries/` | `_projects/lessons/python/notebooks/2026-09-16-libraries_python.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-15-3-16-simulations.ipynb` | `/lessons/python/3-16-simulations/` | `_notebooks/CSP/big-ideas/big-idea-3/2026-04-27-3.16_Simulation.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-16-3-17-algorithmic-efficiency.ipynb` | `/lessons/python/3-17-algorithmic-efficiency/` | `_projects/lessons/python/notebooks/2026-09-21-algorithmic-efficiency.ipynb` |
| `_notebooks/Lessons/Python/2026-01-01-python-17-3-18-undecidable-problems.ipynb` | `/lessons/python/3-18-undecidable-problems/` | `_notebooks/CSP/big-ideas/big-idea-3/2026-04-26-3.2_Undecidable_Problems.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-01-1-01-algorithms.ipynb` | `/lessons/java/1-01-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-1.1-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-02-1-02-variables.ipynb` | `/lessons/java/1-02-variables/` | `_projects/lessons/java/notebooks/2025-09-21-1.2-variables.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-03-1-03-expressions-output.ipynb` | `/lessons/java/1-03-expressions-output/` | `_projects/lessons/java/notebooks/2025-09-21-1.3-output.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-04-1-04-assignment-input.ipynb` | `/lessons/java/1-04-assignment-input/` | `_projects/lessons/java/notebooks/2025-09-21-1.4-input.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-05-1-05-casting.ipynb` | `/lessons/java/1-05-casting/` | `_projects/lessons/java/notebooks/2025-09-21-1.5-data_casting.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-06-1-06-compound-assignment.ipynb` | `/lessons/java/1-06-compound-assignment/` | `_projects/lessons/java/notebooks/2025-09-21-1.6-operators-innovators.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-07-1-07-apis-libraries.ipynb` | `/lessons/java/1-07-apis-libraries/` | `_projects/lessons/java/notebooks/2025-09-21-1.7-grinders-apis.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-08-1-08-comments.ipynb` | `/lessons/java/1-08-comments/` | `_projects/lessons/java/notebooks/2025-09-21-1.8-documentation-with-comments.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-09-1-09-method-signatures.ipynb` | `/lessons/java/1-09-method-signatures/` | `_projects/lessons/java/notebooks/2025-09-21-1.9-method_signatures-applicators.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-10-1-09-method-signatures-homework.ipynb` | `/lessons/java/1-09-method-signatures-homework/` | `_projects/lessons/java/notebooks/2025-09-21-1.9-Method_Signatures-Homework-applicators.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-11-1-10-class-methods.ipynb` | `/lessons/java/1-10-class-methods/` | `_projects/lessons/java/notebooks/2025-09-21-1.10-class_methods.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-12-1-10-class-methods-homework.ipynb` | `/lessons/java/1-10-class-methods-homework/` | `_projects/lessons/java/notebooks/2025-09-21-1.10-class_methods_homework.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-13-1-11-math-class.ipynb` | `/lessons/java/1-11-math-class/` | `_projects/lessons/java/notebooks/2025-09-21-1.11-math_class.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-14-1-11-math-class-homework.ipynb` | `/lessons/java/1-11-math-class-homework/` | `_projects/lessons/java/notebooks/2025-09-21-1.11-math_classhw.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-15-1-12-classes-objects.ipynb` | `/lessons/java/1-12-classes-objects/` | `_projects/lessons/java/notebooks/2025-09-21-1.12-classes_and_objects.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-16-1-12-classes-objects-homework.ipynb` | `/lessons/java/1-12-classes-objects-homework/` | `_projects/lessons/java/notebooks/2025-09-21-1.12-hw.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-17-1-13-object-creation.ipynb` | `/lessons/java/1-13-object-creation/` | `_projects/lessons/java/notebooks/2025-09-21-1.13-object_creationGrinders.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-18-1-14-instance-methods.ipynb` | `/lessons/java/1-14-instance-methods/` | `_projects/lessons/java/notebooks/2025-09-21-1.14-callinginstances-innovators.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-19-1-14-instance-methods-homework.ipynb` | `/lessons/java/1-14-instance-methods-homework/` | `_projects/lessons/java/notebooks/2025-09-21-1.14-callinginstances-homework-innovators.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-20-1-15-string-manipulation.ipynb` | `/lessons/java/1-15-string-manipulation/` | `_projects/lessons/java/notebooks/2025-09-21-1.15-java-objects.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-21-unit-1-quiz.ipynb` | `/lessons/java/unit-1-quiz/` | `_projects/lessons/java/notebooks/2025-09-21-u1quiz.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-22-2-01-algorithms-selection-repetition.ipynb` | `/lessons/java/2-01-algorithms-selection-repetition/` | `_projects/lessons/java/notebooks/2025-09-21-2.1.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-23-2-02-boolean-expressions.ipynb` | `/lessons/java/2-02-boolean-expressions/` | `_projects/lessons/java/notebooks/2025-09-21-2.2.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-24-2-03-if-statements.ipynb` | `/lessons/java/2-03-if-statements/` | `_projects/lessons/java/notebooks/2025-09-21-2.3.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-25-2-04-nested-if.ipynb` | `/lessons/java/2-04-nested-if/` | `_projects/lessons/java/notebooks/2025-09-21-2.4.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-26-2-05-compound-boolean.ipynb` | `/lessons/java/2-05-compound-boolean/` | `_projects/lessons/java/notebooks/2025-09-21-2.5.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-27-2-06-comparing-boolean.ipynb` | `/lessons/java/2-06-comparing-boolean/` | `_projects/lessons/java/notebooks/2025-09-21-2.6.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-28-2-07-while-loops.ipynb` | `/lessons/java/2-07-while-loops/` | `_projects/lessons/java/notebooks/2025-09-21-2.7.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-29-2-08-for-loops.ipynb` | `/lessons/java/2-08-for-loops/` | `_projects/lessons/java/notebooks/2025-09-21-2.8.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-30-2-09-selection-iteration-algorithms.ipynb` | `/lessons/java/2-09-selection-iteration-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-2.9.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-31-2-10-string-algorithms.ipynb` | `/lessons/java/2-10-string-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-2.10.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-32-2-11-nested-iteration.ipynb` | `/lessons/java/2-11-nested-iteration/` | `_projects/lessons/java/notebooks/2025-09-21-2.11.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-33-2-12-run-time-analysis.ipynb` | `/lessons/java/2-12-run-time-analysis/` | `_projects/lessons/java/notebooks/2025-09-21-2.12.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-34-2-x-login-cookies.ipynb` | `/lessons/java/2-x-login-cookies/` | `_projects/lessons/java/notebooks/2025-09-21-jwt-selection-iteration.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-35-unit-2-quiz.ipynb` | `/lessons/java/unit-2-quiz/` | `_projects/lessons/java/notebooks/2025-09-21-u2quiz.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-36-unit-2-frq.ipynb` | `/lessons/java/unit-2-frq/` | `_projects/lessons/java/notebooks/2025-09-21-u2frq.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-37-3-01-abstraction-design.ipynb` | `/lessons/java/3-01-abstraction-design/` | `_projects/lessons/java/notebooks/2025-09-21-3.1.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-38-3-02-impact-of-design.ipynb` | `/lessons/java/3-02-impact-of-design/` | `_projects/lessons/java/notebooks/2025-09-21-3.2.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-39-3-03-anatomy-of-a-class.ipynb` | `/lessons/java/3-03-anatomy-of-a-class/` | `_projects/lessons/java/notebooks/2025-09-21-3.3.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-40-3-04-constructors.ipynb` | `/lessons/java/3-04-constructors/` | `_projects/lessons/java/notebooks/2025-09-21-3.4.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-41-3-05-method-writing.ipynb` | `/lessons/java/3-05-method-writing/` | `_projects/lessons/java/notebooks/2025-09-21-3.5.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-42-3-06-passing-references.ipynb` | `/lessons/java/3-06-passing-references/` | `_projects/lessons/java/notebooks/2025-09-21-3.6.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-43-3-07-class-variables.ipynb` | `/lessons/java/3-07-class-variables/` | `_projects/lessons/java/notebooks/2025-09-21-3.7.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-44-3-08-scope-access.ipynb` | `/lessons/java/3-08-scope-access/` | `_projects/lessons/java/notebooks/2025-09-21-3.8.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-45-3-09-this-keyword.ipynb` | `/lessons/java/3-09-this-keyword/` | `_projects/lessons/java/notebooks/2025-09-21-3.9.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-46-3-x-game-state.ipynb` | `/lessons/java/3-x-game-state/` | `_projects/lessons/java/notebooks/2025-09-21-state-persistence.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-47-4-01-data-collection.ipynb` | `/lessons/java/4-01-data-collection/` | `_projects/lessons/java/notebooks/2025-09-21-4.1-data-collection-ethics.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-48-4-02-data-sets.ipynb` | `/lessons/java/4-02-data-sets/` | `_projects/lessons/java/notebooks/2025-09-21-4.2-data-sets.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-49-4-03-arrays.ipynb` | `/lessons/java/4-03-arrays/` | `_projects/lessons/java/notebooks/2025-09-21-4.3-array-creation-and-access.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-50-4-04-array-traversals.ipynb` | `/lessons/java/4-04-array-traversals/` | `_projects/lessons/java/notebooks/2025-09-21-4.4-array-transversals.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-51-4-05-array-algorithms.ipynb` | `/lessons/java/4-05-array-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-4.5-array-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-52-4-06-text-files.ipynb` | `/lessons/java/4-06-text-files/` | `_projects/lessons/java/notebooks/2025-09-21-4.6-using-text-files.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-53-4-07-wrapper-classes.ipynb` | `/lessons/java/4-07-wrapper-classes/` | `_projects/lessons/java/notebooks/2025-09-21-4.7-wrapper-classes.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-54-4-08-arraylist-methods.ipynb` | `/lessons/java/4-08-arraylist-methods/` | `_projects/lessons/java/notebooks/2025-09-21-4.8-arraylist-methods.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-55-4-09-arraylist-traversals.ipynb` | `/lessons/java/4-09-arraylist-traversals/` | `_projects/lessons/java/notebooks/2025-09-21-4.9-ArrayList_Transversals.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-56-4-10-arraylist-algorithms.ipynb` | `/lessons/java/4-10-arraylist-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-4.10-implementing-arraylist-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-57-4-11-2d-arrays.ipynb` | `/lessons/java/4-11-2d-arrays/` | `_projects/lessons/java/notebooks/2025-09-21-4.11-2d-arrays.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-58-4-12-2d-array-traversals.ipynb` | `/lessons/java/4-12-2d-array-traversals/` | `_projects/lessons/java/notebooks/2025-09-21-4.12-traversing-2d-arrays.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-59-4-13-2d-algorithms.ipynb` | `/lessons/java/4-13-2d-algorithms/` | `_projects/lessons/java/notebooks/2025-09-21-4.13-2d-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-60-4-14-linear-search.ipynb` | `/lessons/java/4-14-linear-search/` | `_projects/lessons/java/notebooks/2025-09-21-4.14-linear-search-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-61-4-15-sorting.ipynb` | `/lessons/java/4-15-sorting/` | `_projects/lessons/java/notebooks/2025-09-21-4.15-sorting-algorithms.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-62-4-16-recursion.ipynb` | `/lessons/java/4-16-recursion/` | `_projects/lessons/java/notebooks/2025-09-21-4.16-recursions.ipynb` |
| `_notebooks/Lessons/Java/2026-01-02-java-63-4-17-recursive-search-sort.ipynb` | `/lessons/java/4-17-recursive-search-sort/` | `_projects/lessons/java/notebooks/2025-09-21-4.17-recursive-searching-and-sorting.ipynb` |
| `_posts/Guides/2026-01-03-guide-01-windows-wsl-setup.md` | `/guides/windows-wsl-setup/` | `_posts/Foundation/B-tools_and_equipment/2025-04-15-tools_setup-win.md` |
| `_posts/Guides/2026-01-03-guide-02-macos-setup.md` | `/guides/macos-setup/` | `_posts/Foundation/B-tools_and_equipment/2025-04-15-tools_setup-macos.md` |
| `_posts/Guides/2026-01-03-guide-03-linux-setup.md` | `/guides/linux-setup/` | `_posts/Foundation/B-tools_and_equipment/2025-04-15-tools_setup-linux.md` |
| `_posts/Guides/2026-01-03-guide-04-github.md` | `/guides/github/` | `_posts/Foundation/B-tools_and_equipment/2025-04-15-tools_setup-github.md` |
| `_posts/Guides/2026-01-03-guide-05-vscode.md` | `/guides/vscode/` | `_posts/Foundation/B-tools_and_equipment/2025-04-15-tools_setup-vscode.md` |
| `_notebooks/Guides/2026-01-03-guides-06-troubleshooting.ipynb` | `/guides/troubleshooting/` | `_notebooks/Foundation/B-tools_and_equipment/2025-09-02-tools_setup-trouble.ipynb` |
| `_posts/Guides/2026-01-03-guide-07-postman.md` | `/guides/postman/` | `_posts/Foundation/B-tools_and_equipment/2025-08-06-intro-to-postman.md` |
| `_notebooks/Guides/2026-01-03-guides-08-jupyter-notebooks.ipynb` | `/guides/jupyter-notebooks/` | `_notebooks/Foundation/F-projects/2025-08-19-jupyter-whatarenotebooks.ipynb` |
| `_notebooks/Guides/2026-01-03-guides-09-python-kernel.ipynb` | `/guides/python-kernel/` | `_notebooks/Foundation/G-kernels/2025-06-14-kernels-python.ipynb` |
| `_notebooks/Guides/2026-01-03-guides-10-java-kernel.ipynb` | `/guides/java-kernel/` | `_notebooks/Foundation/G-kernels/2025-06-14-kernels-java.ipynb` |
| `_notebooks/Guides/2026-01-03-guides-11-javascript-html-css-kernels.ipynb` | `/guides/javascript-html-css-kernels/` | `_notebooks/Foundation/G-kernels/2025-06-14-kernels-javascripthtmlcss.ipynb` |
| `_posts/Guides/2026-01-03-guide-12-github-pages.md` | `/guides/github-pages/` | `_posts/Foundation/C-github_pages/2023-08-23-github_pages-intro.md` |
| `_posts/Guides/2026-01-03-guide-13-markdown-page.md` | `/guides/markdown-page/` | `_posts/Foundation/C-github_pages/2023-08-23-github_pages-markdown.md` |
| `_posts/Guides/2026-01-03-guide-14-pages-theme.md` | `/guides/pages-theme/` | `_posts/Foundation/C-github_pages/2023-08-23-github_pages-theme.md` |
| `_notebooks/Guides/2026-01-03-guides-15-intro-to-javascript.ipynb` | `/guides/intro-to-javascript/` | `_notebooks/Foundation/2026-07-22-Introduction-to-JavaScript.ipynb` |
| `_notebooks/Guides/2026-01-03-guides-16-html-and-javascript.ipynb` | `/guides/html-and-javascript/` | `_notebooks/Foundation/B-tools_and_equipment/2025-06-13-html_javascript.ipynb` |

Generated build files (`_posts/Lessons/**/*_IPYNB_2_.md`, `_posts/Guides/*_IPYNB_2_.md`) are gitignored and
produced by `scripts/convert_notebooks.py`.

## Upstream inventory (Open-Coding-Society/pages @ 49e2eb0)

Where the courses live upstream:
- **Python**: `_projects/lessons/python/notebooks` (AP CSP Big Idea 3, topics 3.01-3.17), plus
  `_notebooks/Foundation/*Introduction-to-Python.ipynb` and `_notebooks/CSP/big-ideas/big-idea-3/`.
- **Java**: `_projects/lessons/java/notebooks` (AP CSA units 1-4; old URLs `/csa/unit_0N/N_M`,
  linked from `navigation/csamainlessons.md` and `_includes/nav/csa_units/`). Not in a separate repo.
  Related upstream folders `_projects/lessons/{csa1,csa2,cs112,cs113}` hold Spring/college/FRQ material.

| Area | Upstream | Kept | Dropped / not imported (reason) |
|---|---|---|---|
| Python (`_projects/lessons/python`) | 15 | 14 | 1: older duplicate 3.09 (inline-styled maze) |
| Python extras | Intro to Python, 3.16 Simulation, 3.2 Undecidable | 3 | CSP `lessons/strings*` (duplicate of 3.04) |
| Java (`_projects/lessons/java`) | 67 | 63 | u3/u4 quiz (empty stubs), submission-roles (class grading workflow), sass-utilities-runners (site-internal design doc) |
| Guides (Foundation) | ~45 posts + 26 notebooks | 16 | sprint/agile-classroom/sprint plans (logistics), KASM + accounts (school infra), tools orchestration (teacher proposal), anatomy (old theme), Jekyll/Jekyll-themes/notebook-languages (AI-graded FRQ widgets with an embedded API key; need rewrite), utterances, hacks pages, runner example posts (kit already has them), projects (game lessons) |
| `_projects/lessons/javascript` | 13 | 0 | kit already ships `_notebooks/JavaScriptLessons`; not duplicated |
| `csa2` AP FRQ practice | 28 | 0 | candidate for a later "Java FRQ practice" unit (needs the same cleaning) |
| `cs112` / `cs113` | 36 / 30 | 0 | college-course drafts, checkpoints, team-teach pages |
| CSP other big ideas (data, pandas/ML, networks, AWS, safe computing) | ~35 | 0 | candidates later (pandas intro, binary, networks); AWS deployment and sprint plans drop |
| `student_toolkit`, `capstone`, `gamify`, `forum`, `CSH` | many | 0 | school tools, student projects, grading/submission apps |

## Cleaning rules applied (see the tool's docstring)

- Front matter rebuilt: `layout: post`, clean title/description, `author: OCS Kit`, permalink
  `/lessons/python/<slug>/`, `/lessons/java/<slug>/`, `/guides/<slug>/`; `lesson_course`, `lesson_unit`,
  `lesson_order`, `lesson_kind` drive the index pages. Removed `courses:` week scheduling (so the
  course split script leaves these files alone), `menu`, assignment/grading keys, contributor names/uids.
  Values are colon-free because the notebook converter re-emits them unquoted.
- Dropped sections: LxD cycle, grading plans/rubrics, submission instructions and safety rules,
  revision/feedback logs, timed in-class participation activities, due dates and points lines,
  Google Form links/iframes, sentences about submitting work.
- School/teacher/student references replaced with neutral wording or placeholders; links to the
  upstream site made relative and mapped to the new URLs; links to upstream-only pages unlinked.
- Formatting: heading numbers, minute timings and colour spans removed; `<style>` blocks removed from
  markdown; the dark hard-coded "mcq-card" quiz converted to the themed `u2-mcq` widget; mermaid
  theme overrides removed; guides keep only `display:none` from inline styles (needed by scripts).
  Interactive UI-runner code cells keep their own CSS because it is the code being taught.
- Outputs cleared except short plain-text results; a kit `ocs__pager` previous/next footer added.

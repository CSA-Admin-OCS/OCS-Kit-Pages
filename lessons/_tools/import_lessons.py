#!/usr/bin/env python3
"""Import and clean the Python and Java lesson notebooks for the OCS Kit Education kit.

Usage:
    python3 lessons/_tools/import_lessons.py <path-to-upstream-pages-clone>

Reads lesson notebooks from an upstream Open-Coding-Society/pages checkout
(_projects/lessons/{python,java}, _notebooks/Foundation, _notebooks/CSP) and
writes cleaned copies to _notebooks/Lessons/{Python,Java}/.

Cleaning rules (applied to every notebook):
  * front matter rebuilt: layout post, clean title/description, author "OCS Kit",
    permalink /lessons/<course>/<slug>/, lesson_course/lesson_unit/lesson_order
    keys (used by the /lessons/ index pages); course week scheduling, menus,
    assignment/grading keys and contributor names are removed
  * teacher/classroom-process sections dropped (LxD cycle, grading plans and
    rubrics, submission instructions, revision/feedback logs, timed in-class
    participation activities)
  * external submission forms (Google Forms) and dated due lines removed
  * school, teacher and student references replaced with neutral wording
  * links to the old upstream permalinks rewritten to the new /lessons/ URLs
  * headings normalised: numbering, minute timings and inline colour spans removed
  * inline <style> blocks removed from markdown cells
  * code outputs cleared except short plain-text results
  * a previous / course index / next footer appended
"""
import copy
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "_notebooks" / "Lessons"

# --------------------------------------------------------------------------------------
# Lesson specification: (source path relative to upstream, slug, unit, kind, title, description)
# title/description None -> derived from the upstream front matter
# --------------------------------------------------------------------------------------
PY = "_projects/lessons/python/notebooks/"
JV = "_projects/lessons/java/notebooks/"

PYTHON = [
    ("_notebooks/Foundation/2026-07-25-Introduction-to-Python.ipynb", "intro", "Getting Started", "lesson",
     "Intro to Python", "Python basics: primitive and reference data types, dictionaries, classes and objects."),
    (PY + "2026-07-21-variables_python_instructor.ipynb", "3-01-variables", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.01 Variables and Assignments", "Store values in variables, pick fitting data types, and update values with assignment."),
    (PY + "2025-09-26-data_abstractions_remakers.ipynb", "3-02-data-abstraction", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.02 Data Abstraction", "Use lists and dictionaries to group related data and manage complexity."),
    (PY + "2026-09-15-mathexpressions-lesson.ipynb", "3-03-math-expressions", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.03 Mathematical Expressions", "Arithmetic operators, operator precedence, modulus, and sequencing in Python and pseudocode."),
    (PY + "2026-09-15-strings_intercepters.ipynb", "3-04-strings", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.04 Strings", "Index, slice, concatenate, and search strings, then split structured text."),
    (PY + "2026-09-15-boolean_scratchers_py_hw.ipynb", "3-05-booleans", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.05 Boolean Expressions", "Relational and logical operators that evaluate to True or False."),
    (PY + "2026-09-25-conditionals-python.ipynb", "3-06-conditionals", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.06 Conditionals", "Make decisions with if, elif, and else, and trace which branch runs."),
    (PY + "2026-09-17-nested-conditionals-python.ipynb", "3-07-nested-conditionals", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.07 Nested Conditionals", "Put decisions inside decisions and trace multi-level logic."),
    (PY + "2025-09-26-iterations_scratchers_lesson.ipynb", "3-08-iteration", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.08 Iteration", "Repeat code with for and while loops, and control loops with conditions."),
    (PY + "2026-09-18-developing-algorithms.ipynb", "3-09-developing-algorithms", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.09 Developing Algorithms", "Compare, trace, modify, and combine algorithms in Python and College Board pseudocode."),
    (PY + "2025-09-30-lists_scratchers_lesson.ipynb", "3-10-lists", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.10 Lists", "Create, index, update, and traverse lists; common list algorithms."),
    (PY + "2025-10-08-calling_procedures_remakers_lesson.ipynb", "3-12-calling-procedures", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.12 Calling Procedures", "Define procedures with parameters, pass arguments, and decompose a task into helper procedures."),
    (PY + "2025-10-09-developing_procedures_remakers_lesson.ipynb", "3-13-developing-procedures", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.13 Developing Procedures", "Design your own procedures with parameters and return values."),
    (PY + "2026-09-16-libraries_python.ipynb", "3-14-libraries", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.14 Libraries", "Import and use library procedures and APIs instead of writing everything yourself."),
    ("_notebooks/CSP/big-ideas/big-idea-3/2026-04-27-3.16_Simulation.ipynb", "3-16-simulations", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.16 Simulations", "What simulations are, why their results differ from reality, and an interactive event-planning simulation."),
    (PY + "2026-09-21-algorithmic-efficiency.ipynb", "3-17-algorithmic-efficiency", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.17 Algorithmic Efficiency", "Compare how running time grows, and recognise reasonable versus unreasonable time."),
    ("_notebooks/CSP/big-ideas/big-idea-3/2026-04-26-3.2_Undecidable_Problems.ipynb", "3-18-undecidable-problems", "Big Idea 3: Algorithms and Programming", "lesson",
     "3.18 Undecidable Problems", "Decidable versus undecidable problems and the halting problem, with practice questions."),
]

U1, U2, U3, U4 = ("Unit 1: Using Objects and Methods", "Unit 2: Selection and Iteration",
                  "Unit 3: Class Creation", "Unit 4: Data Collections")
JAVA = [
    (JV + "2025-09-21-1.1-algorithms.ipynb", "1-01-algorithms", U1, "lesson", "1.01 Algorithms, Programming, and Compilers", "What an algorithm is, how Java source code is compiled and run, and how to read compiler errors."),
    (JV + "2025-09-21-1.2-variables.ipynb", "1-02-variables", U1, "lesson", "1.02 Variables and Data Types",
     "Declare variables with int, double, boolean, and String, use final for constants, and choose types from what the data means."),
    (JV + "2025-09-21-1.3-output.ipynb", "1-03-expressions-output", U1, "lesson", "1.03 Expressions and Output", "Print with System.out.print and println, use escape sequences, and evaluate arithmetic expressions."),
    (JV + "2025-09-21-1.4-input.ipynb", "1-04-assignment-input", U1, "lesson", "1.04 Assignment Statements and Input", "Assign and update variables, tell assignment apart from equality, and read input with Scanner."),
    (JV + "2025-09-21-1.5-data_casting.ipynb", "1-05-casting", U1, "lesson", "1.05 Casting and Range of Variables", None),
    (JV + "2025-09-21-1.6-operators-innovators.ipynb", "1-06-compound-assignment", U1, "lesson", "1.06 Compound Assignment Operators", None),
    (JV + "2025-09-21-1.7-grinders-apis.ipynb", "1-07-apis-libraries", U1, "lesson", "1.07 Application Program Interface (API) and Libraries", None),
    (JV + "2025-09-21-1.8-documentation-with-comments.ipynb", "1-08-comments", U1, "lesson", "1.08 Documentation with Comments", None),
    (JV + "2025-09-21-1.9-method_signatures-applicators.ipynb", "1-09-method-signatures", U1, "lesson", "1.09 Method Signatures", None),
    (JV + "2025-09-21-1.9-Method_Signatures-Homework-applicators.ipynb", "1-09-method-signatures-homework", U1, "homework", "1.09 Method Signatures: Homework", "Practice problems for method signatures, overloading, and return types."),
    (JV + "2025-09-21-1.10-class_methods.ipynb", "1-10-class-methods", U1, "lesson", "1.10 Calling Class Methods", None),
    (JV + "2025-09-21-1.10-class_methods_homework.ipynb", "1-10-class-methods-homework", U1, "homework", "1.10 Calling Class Methods: Homework", "Practice calling static (class) methods."),
    (JV + "2025-09-21-1.11-math_class.ipynb", "1-11-math-class", U1, "lesson", "1.11 Math Class", None),
    (JV + "2025-09-21-1.11-math_classhw.ipynb", "1-11-math-class-homework", U1, "homework", "1.11 Math Class: Homework", "Practice with Math.abs, Math.pow, Math.sqrt, and Math.random."),
    (JV + "2025-09-21-1.12-classes_and_objects.ipynb", "1-12-classes-objects", U1, "lesson", "1.12 Objects: Instances of Classes", None),
    (JV + "2025-09-21-1.12-hw.ipynb", "1-12-classes-objects-homework", U1, "homework", "1.12 Objects: Homework", "Identify classes, objects, attributes, and behaviors in a scenario."),
    (JV + "2025-09-21-1.13-object_creationGrinders.ipynb", "1-13-object-creation", U1, "lesson", "1.13 Object Creation and Storage (Instantiation)", None),
    (JV + "2025-09-21-1.14-callinginstances-innovators.ipynb", "1-14-instance-methods", U1, "lesson", "1.14 Calling Instance Methods", None),
    (JV + "2025-09-21-1.14-callinginstances-homework-innovators.ipynb", "1-14-instance-methods-homework", U1, "homework", "1.14 Calling Instance Methods: Homework", "Practice creating objects and calling their instance methods."),
    (JV + "2025-09-21-1.15-java-objects.ipynb", "1-15-string-manipulation", U1, "lesson", "1.15 String Manipulation", None),
    (JV + "2025-09-21-u1quiz.ipynb", "unit-1-quiz", U1, "quiz", "Unit 1 Quiz", "Review questions for primitive types, objects, and methods."),
    (JV + "2025-09-21-2.1.ipynb", "2-01-algorithms-selection-repetition", U2, "lesson", "2.01 Algorithms with Selection and Repetition", None),
    (JV + "2025-09-21-2.2.ipynb", "2-02-boolean-expressions", U2, "lesson", "2.02 Boolean Expressions", None),
    (JV + "2025-09-21-2.3.ipynb", "2-03-if-statements", U2, "lesson", "2.03 if Statements", None),
    (JV + "2025-09-21-2.4.ipynb", "2-04-nested-if", U2, "lesson", "2.04 Nested if Statements", None),
    (JV + "2025-09-21-2.5.ipynb", "2-05-compound-boolean", U2, "lesson", "2.05 Compound Boolean Expressions", None),
    (JV + "2025-09-21-2.6.ipynb", "2-06-comparing-boolean", U2, "lesson", "2.06 Comparing Boolean Expressions", None),
    (JV + "2025-09-21-2.7.ipynb", "2-07-while-loops", U2, "lesson", "2.07 while Loops", None),
    (JV + "2025-09-21-2.8.ipynb", "2-08-for-loops", U2, "lesson", "2.08 for Loops", None),
    (JV + "2025-09-21-2.9.ipynb", "2-09-selection-iteration-algorithms", U2, "lesson", "2.09 Implementing Selection and Iteration Algorithms", None),
    (JV + "2025-09-21-2.10.ipynb", "2-10-string-algorithms", U2, "lesson", "2.10 Implementing String Algorithms", None),
    (JV + "2025-09-21-2.11.ipynb", "2-11-nested-iteration", U2, "lesson", "2.11 Nested Iteration", None),
    (JV + "2025-09-21-2.12.ipynb", "2-12-run-time-analysis", U2, "lesson", "2.12 Informal Run-Time Analysis", None),
    (JV + "2025-09-21-jwt-selection-iteration.ipynb", "2-x-login-cookies", U2, "extension", "Extension: Login Tokens and Cookies with Selection and Iteration",
     "Apply if statements and loops to a login flow: validate a token and search a list of cookies."),
    (JV + "2025-09-21-u2quiz.ipynb", "unit-2-quiz", U2, "quiz", "Unit 2 Quiz", "Review questions for selection and iteration."),
    (JV + "2025-09-21-u2frq.ipynb", "unit-2-frq", U2, "quiz", "Unit 2 FRQ Practice", None),
    (JV + "2025-09-21-3.1.ipynb", "3-01-abstraction-design", U3, "lesson", "3.01 Abstraction and Program Design", None),
    (JV + "2025-09-21-3.2.ipynb", "3-02-impact-of-design", U3, "lesson", "3.02 Impact of Program Design", None),
    (JV + "2025-09-21-3.3.ipynb", "3-03-anatomy-of-a-class", U3, "lesson", "3.03 Anatomy of a Class", None),
    (JV + "2025-09-21-3.4.ipynb", "3-04-constructors", U3, "lesson", "3.04 Constructors", None),
    (JV + "2025-09-21-3.5.ipynb", "3-05-method-writing", U3, "lesson", "3.05 Methods: How to Write Them", None),
    (JV + "2025-09-21-3.6.ipynb", "3-06-passing-references", U3, "lesson", "3.06 Methods: Passing and Returning References", None),
    (JV + "2025-09-21-3.7.ipynb", "3-07-class-variables", U3, "lesson", "3.07 Class Variables and Methods", None),
    (JV + "2025-09-21-3.8.ipynb", "3-08-scope-access", U3, "lesson", "3.08 Scope and Access", None),
    (JV + "2025-09-21-3.9.ipynb", "3-09-this-keyword", U3, "lesson", "3.09 this Keyword", "Use the this keyword to refer to the current object, resolve shadowed names, and pass the current object to methods."),
    (JV + "2025-09-21-state-persistence.ipynb", "3-x-game-state", U3, "extension", "Extension: Object State in Games",
     "Use objects, encapsulation, and class variables to model game characters whose state changes, then save and load it."),
    (JV + "2025-09-21-4.1-data-collection-ethics.ipynb", "4-01-data-collection", U4, "lesson", "4.01 Ethical and Social Issues Around Data Collection", None),
    (JV + "2025-09-21-4.2-data-sets.ipynb", "4-02-data-sets", U4, "lesson", "4.02 Introduction to Using Data Sets", None),
    (JV + "2025-09-21-4.3-array-creation-and-access.ipynb", "4-03-arrays", U4, "lesson", "4.03 Array Creation and Access", None),
    (JV + "2025-09-21-4.4-array-transversals.ipynb", "4-04-array-traversals", U4, "lesson", "4.04 Array Traversals", None),
    (JV + "2025-09-21-4.5-array-algorithms.ipynb", "4-05-array-algorithms", U4, "lesson", "4.05 Implementing Array Algorithms", None),
    (JV + "2025-09-21-4.6-using-text-files.ipynb", "4-06-text-files", U4, "lesson", "4.06 Using Text Files", None),
    (JV + "2025-09-21-4.7-wrapper-classes.ipynb", "4-07-wrapper-classes", U4, "lesson", "4.07 Wrapper Classes", None),
    (JV + "2025-09-21-4.8-arraylist-methods.ipynb", "4-08-arraylist-methods", U4, "lesson", "4.08 ArrayList Methods", None),
    (JV + "2025-09-21-4.9-ArrayList_Transversals.ipynb", "4-09-arraylist-traversals", U4, "lesson", "4.09 ArrayList Traversals", None),
    (JV + "2025-09-21-4.10-implementing-arraylist-algorithms.ipynb", "4-10-arraylist-algorithms", U4, "lesson", "4.10 Implementing ArrayList Algorithms", None),
    (JV + "2025-09-21-4.11-2d-arrays.ipynb", "4-11-2d-arrays", U4, "lesson", "4.11 2D Array Creation and Access", None),
    (JV + "2025-09-21-4.12-traversing-2d-arrays.ipynb", "4-12-2d-array-traversals", U4, "lesson", "4.12 2D Array Traversals", None),
    (JV + "2025-09-21-4.13-2d-algorithms.ipynb", "4-13-2d-algorithms", U4, "lesson", "4.13 Implementing 2D Array Algorithms", None),
    (JV + "2025-09-21-4.14-linear-search-algorithms.ipynb", "4-14-linear-search", U4, "lesson", "4.14 Searching Algorithms", None),
    (JV + "2025-09-21-4.15-sorting-algorithms.ipynb", "4-15-sorting", U4, "lesson", "4.15 Sorting Algorithms", None),
    (JV + "2025-09-21-4.16-recursions.ipynb", "4-16-recursion", U4, "lesson", "4.16 Recursion", None),
    (JV + "2025-09-21-4.17-recursive-searching-and-sorting.ipynb", "4-17-recursive-search-sort", U4, "lesson", "4.17 Recursive Searching and Sorting", None),
]

COURSES = {
    "python": dict(items=PYTHON, dir="Python", category="Python", date="2026-01-01", label="Python"),
    "java": dict(items=JAVA, dir="Java", category="Java", date="2026-01-02", label="Java"),
}

# --------------------------------------------------------------------------------------
# Cleaning rules
# --------------------------------------------------------------------------------------
DROP_HEADING = re.compile(
    r"^(?:"
    # exact headings
    r"(?:lxd( cycle)?( process)?|empathize|define|ideate|prototype( & test)?|test|"
    r"grading( plan| rubric)?|classroom rubric|quick validation checklist|rubric|"
    r"feedback( evidence| and revisions| received)?|lesson design and revision|revision made|"
    r"create your homework page|submit|submission|what to submit)$"
    # prefixes
    r"|lxd|lesson revisions?|submit your work|submission instructions|complete and submit|grading plan|grading rubric|submission safety rules|submission checklist|"
    r"prepare (your )?submission|publish your homework|how to submit|participation \d+|due (by|on|date)|"
    r"feedback and revision|lesson revisions & feedback"
    r")",
    re.I,
)

# (pattern, replacement) applied to markdown and code
REPLACEMENTS = [
    (r"from our Friends of Poway Seniors capstone", "from a community project for a seniors' nonprofit"),
    (r"our Friends of Poway Seniors capstone", "a community project for a seniors' nonprofit"),
    (r"Friends of Poway Seniors", "Friends of Seniors"),
    (r"\s*\((?:\d(?:st|nd|rd|th)|fourth) period\)", ""),
    (r"the shared class server is down; not something you can fix", "the backend server is down or unreachable"),
    (r"<(\{\{\s*site\.baseurl\s*\}\}[^>\s]+)>", r"[\1](\1)"),
    (r"your submission description", "your notes"),
    (r"into the Description box when you submit", "into your notes"),
    (r"Poway Neighborhood Emergency Corps", "Neighborhood Emergency Corps"),
    (r"Poway Recovery Center", "Community Recovery Center"),
    (r"\bPoway\b", "Lakeview"),
    (r"Mr\. Mortens[eo]n asks you", "your teacher asks you"),
    (r"(?:John )?Mortens[eo]n'?s?", "the instructor"),
    (r"our (?:own )?capstone (?:project|nonprofit|site)", "a community nonprofit project"),
    (r"our capstone", "a community project"),
    (r"(?:Your teacher's out sick\. )?You're covering 1st period", "You're covering a class"),
    (r"\b(?:\d(?:st|nd|rd|th)|fourth|4th) period\b", "class"),
    (r"https?://flask\.opencodingsociety\.com", "your Flask backend"),
    (r"`flask\.opencodingsociety\.com`", "your deployed Flask backend"),
    (r"https?://(?:pages\.)?opencodingsociety\.com/csa/unit_0(\d)/(\d+)_(\d+)", r"{{site.baseurl}}/csa/unit_0\1/\2_\3"),
    (r"https?://(?:pages\.)?opencodingsociety\.com(/[^\s)\"'>]*)?", r"{{site.baseurl}}\1"),
    (r"opencodingsociety\.com", "the course site"),
    (r"your submission notes", "your notes"),
    (r"submission notebook", "notebook"),
    (r"\[Jump to the LxD cycle\]\(#lxd-cycle-process\)\s*·\s*", ""),
    (r"<a id=\"lxd-cycle-process\"></a>", ""),
    (r"Unzip the file under `_projects/lessons/java/static/3-7_bank.zip`",
     "Download and unzip [3-7_bank.zip]({{site.baseurl}}/assets/lessons/java/3-7_bank.zip)"),
    (r"^\s*\*\*Due:\*\*.*$", ""),
    (r"^\s*\*\*Points:\*\*.*$", ""),
    (r'<img src="\{\{site\.baseurl\}\}/images/Cookie\.png"[^>]*>', ""),  # image missing upstream
    (r"\s*\(Extra Credit\)", ""),
]

PSEUDO_HEADING = re.compile(r"^\s*(?:\*\*)?([A-Z][^.!?]{2,60}?)(?:\*\*)?\s*$")
HTML_DROP_SECTION = re.compile(
    r"<h([1-3])[^>]*>\s*(?:\d+\.\s*)?(?:LxD|Lesson Revisions?|Feedback|Grading)[^<]*</h\1>.*?(?=<h[12][\s>]|\Z)",
    re.S | re.I)
SUBMIT_WORD = re.compile(r"submi(t|ssion|tted)|Empathize|\bLxD\b|frontmatter you need|Peer reviewers|\bteam [A-Z]\w+", re.I)
FORM_LINE = re.compile(r"forms\.gle|docs\.google\.com/forms", re.I)
DUE_LINE = re.compile(r"^\s*#*\s*\**due (by|on|date)\b.*$", re.I | re.M)
STYLE_BLOCK = re.compile(r"<style\b[^>]*>.*?</style>\s*", re.S | re.I)
SPAN_STYLE = re.compile(r"<span\s+style=\"[^\"]*\"\s*>(.*?)</span>", re.S | re.I)
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
FENCE = re.compile(r"^\s*(```|~~~)")
TIMING = re.compile(r"\s*\((?:about )?\d+\s*(?:-\s*\d+\s*)?(?:min|mins|minutes?)\b[^)]*\)", re.I)
INCLASS = re.compile(r"\s*\((?:In-Class|in class|Read First)\)", re.I)

warnings = []


def norm_heading(text):
    t = re.sub(r"<[^>]+>", "", text)
    t = re.sub(r"[*_`]", "", t)
    t = re.sub(r"^[\W\d]*?(\d+(\.\d+)*\.?)?\s*", "", t)  # leading emoji/numbering
    t = TIMING.sub("", t)
    t = re.sub(r"\(.*?\)", "", t)
    return t.strip(" :-—")


def clean_heading_line(hashes, text):
    text = SPAN_STYLE.sub(r"\1", text)
    text = re.sub(r"Homework\s*&\s*Submission", "Homework", text, flags=re.I)
    m = re.fullmatch(r"\*\*(.+?)\*\*", text.strip())
    if m:
        text = m.group(1)
    if len(hashes) <= 3:
        text = re.sub(r"^(\d+)\.\s+(?=[A-Za-z])", "", text)  # "1. Reference Guide" -> "Reference Guide"
    text = TIMING.sub("", text)
    text = INCLASS.sub("", text)
    return f"{hashes} {text.strip()}"


def apply_replacements(s):
    for pat, rep in REPLACEMENTS:
        s = re.sub(pat, rep, s, flags=re.M)
    return s


class SectionFilter:
    """Drops classroom-process sections across markdown cells."""

    def __init__(self):
        self.drop_level = None

    def process_markdown(self, src):
        out, in_fence = [], False
        for line in src.split("\n"):
            if FENCE.match(line):
                in_fence = not in_fence
            m = None if in_fence else HEADING.match(line)
            if not m and not in_fence and PSEUDO_HEADING.match(line) and DROP_HEADING.match(norm_heading(line)):
                # bold/plain line acting as a heading, e.g. "Prepare your submission IPYNB"
                if self.drop_level is None or self.drop_level >= 4:
                    self.drop_level = 4
                continue
            if m:
                level = len(m.group(1))
                if self.drop_level is not None and level <= self.drop_level:
                    self.drop_level = None
                if self.drop_level is None and DROP_HEADING.match(norm_heading(m.group(2))):
                    self.drop_level = level
                    continue
                if self.drop_level is None:
                    out.append(clean_heading_line(m.group(1), m.group(2)))
                continue
            if self.drop_level is None:
                out.append(line)
        return "\n".join(out)


def mcq_card_to_u2(src):
    """Replace the hard-coded dark-theme "mcq-card" widget with the themed u2-mcq markup."""
    m = re.search(r'<div id="([\w-]+)" class="mcq-card".*?</script>', src, re.S)
    if not m:
        return src
    qm = re.search(r"var QUESTIONS = (\[.*?\]);\n", m.group(0), re.S)
    questions = json.loads(qm.group(1))
    esc = lambda t: t.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    plain = lambda t: re.sub(r"<[^>]+>", "", t)
    parts = [f'<script src="{{{{site.baseurl}}}}/assets/js/csa-lessons/unit2-interactives.js"></script>',
             "", f'<div class="u2-card u2-mcq" id="{m.group(1)}">',
             '  <div class="u2-card__header">', '    <div class="u2-card__title">MCQ Check</div>',
             f'    <div class="u2-card__subtitle">{len(questions)} questions. Pick an answer to see feedback.</div>',
             "  </div>", '  <div class="u2-card__body">']
    for n, q in enumerate(questions, 1):
        parts += ['    <div class="u2-mcq__q">', f'      <div class="u2-mcq__number">Question {n}</div>',
                  f'      <div class="u2-card__prompt">{q["prompt"]}</div>', '      <div class="u2-mcq__options">']
        for key, text in q["options"]:
            ok = key == q["answer"]
            fb = ("Correct. " if ok else f"Not quite. The answer is {q['answer']}. ") + plain(q.get("explanation", ""))
            attr = ' data-correct="true"' if ok else ""
            parts.append(f'      <button class="u2-mcq__option"{attr} data-feedback="{esc(fb)}">{key}. {text}</button>')
        parts += ["      </div>", "    </div>"]
    parts += ["  </div>", "</div>"]
    return src[:m.start()] + "\n".join(parts) + src[m.end():]


def drop_submission_sentences(src):
    """Remove plain-text sentences about submitting work (outside code, HTML and scripts)."""
    out, in_fence, in_script = [], False, False
    for line in src.split("\n"):
        if FENCE.match(line):
            in_fence = not in_fence
        if "<script" in line:
            in_script = True
        if in_fence or in_script or line.lstrip().startswith("<") or not SUBMIT_WORD.search(line):
            out.append(line)
        else:
            parts = re.split(r"(?<=[.!?])\s+", line)
            kept = [p for p in parts if not SUBMIT_WORD.search(p)]
            new = " ".join(kept).rstrip()
            if re.fullmatch(r"\s*([-*]|\d+\.)?\s*", new):
                pass
            else:
                out.append(new)
        if "</script>" in line:
            in_script = False
    return "\n".join(out)


def link_rewriter(old_to_new):
    def rewrite(s):
        def sub(m):
            path = m.group(2).rstrip("/")
            if path in old_to_new:
                return m.group(1) + old_to_new[path]
            return m.group(0)
        # {{site.baseurl}}/path  or {{ site.baseurl }}/path
        s = re.sub(r"(\{\{\s*site\.baseurl\s*\}\})(/[A-Za-z0-9_./-]+)", sub, s)
        s = re.sub(r"(\]\()(/[A-Za-z0-9_./-]+)", sub, s)
        s = re.sub(r"\{\{\s*'(/[A-Za-z0-9_./-]+)'\s*\|\s*relative_url\s*\}\}",
                   lambda m: "{{site.baseurl}}" + old_to_new.get(m.group(1).rstrip("/"), m.group(1)), s)
        return s
    return rewrite


def strip_dead_links(s, known_prefixes=("/lessons/", "/guides/", "/assets/", "/images/")):
    """Turn links to upstream-only pages into plain text."""
    def md(m):
        url = m.group(2)
        path = re.sub(r"^\{\{\s*site\.baseurl\s*\}\}", "", url)
        if path.startswith("/") and not path.startswith(known_prefixes):
            warnings.append(f"dead link removed: {url}")
            return m.group(1)
        return m.group(0)
    s = re.sub(r"\[([^\]]+)\]\(((?:\{\{\s*site\.baseurl\s*\}\})?/[^)\s]*)\)", md, s)

    def html(m):
        url = m.group(2)
        path = re.sub(r"^\{\{\s*site\.baseurl\s*\}\}", "", url)
        if path.startswith("/") and not path.startswith(known_prefixes):
            warnings.append(f"dead html link removed: {url}")
            return m.group(3)
        return m.group(0)
    s = re.sub(r"<a\b([^>]*?)href=\"((?:\{\{\s*site\.baseurl\s*\}\})?/[^\"]*)\"[^>]*>(.*?)</a>", html, s, flags=re.S)
    s = re.sub(r"<a\b[^>]*href=\"\{\{\s*'(/capstone[^']*)'\s*\|\s*relative_url\s*\}\}\"[^>]*>(.*?)</a>", r"\2", s, flags=re.S)
    return s


def clean_outputs(cell):
    keep = []
    for out in cell.get("outputs", []):
        text = None
        if out.get("output_type") == "stream":
            text = "".join(out.get("text", []))
        elif out.get("output_type") in ("execute_result", "display_data"):
            data = out.get("data", {})
            if set(data) <= {"text/plain"}:
                text = "".join(data.get("text/plain", []))
        if text is None or len(text) > 3000 or re.search(r"/home/|/Users/|C:\\\\|Traceback|Exception", text):
            continue
        o = copy.deepcopy(out)
        if "execution_count" in o:
            o["execution_count"] = None
        keep.append(o)
    cell["outputs"] = keep
    cell["execution_count"] = None
    cell["metadata"] = {}


def parse_front_matter(nb):
    src = "".join(nb["cells"][0]["source"])
    m = re.match(r"\s*---\s*\n(.*?)\n---", src, re.S)
    try:
        return yaml.safe_load(m.group(1)) if m else {}
    except yaml.YAMLError:
        return {}


def build(upstream):
    upstream = Path(upstream)
    all_items = []
    old_to_new = {}
    for course, cfg in COURSES.items():
        for idx, (src, slug, unit, kind, title, desc) in enumerate(cfg["items"]):
            nb = json.loads((upstream / src).read_text())
            fm = parse_front_matter(nb)
            permalink = f"/lessons/{course}/{slug}/"
            if fm.get("permalink"):
                old_to_new[str(fm["permalink"]).rstrip("/")] = permalink
            all_items.append(dict(course=course, cfg=cfg, idx=idx, src=src, slug=slug, unit=unit, kind=kind,
                                  title=re.sub(r":\s+", " - ", title) if title else title, desc=desc, nb=nb, fm=fm, permalink=permalink))
    # known upstream aliases
    old_to_new.update({
        "/csa/unit_01/1_10/homework": "/lessons/java/1-10-class-methods-homework/",
        "/csa/unit_01/1_11_hw": "/lessons/java/1-11-math-class-homework/",
        "/csa/unit_01/1_12/homework": "/lessons/java/1-12-classes-objects-homework/",
        "/csa/unit_01/1_14_homework": "/lessons/java/1-14-instance-methods-homework/",
        "/csa/unit_01/1_9_hw": "/lessons/java/1-09-method-signatures-homework/",
        "/navigation/java-reference": "/lessons/java/",
        "/navigation/py-reference": "/lessons/python/",
        "/python/data-abstractions": "/lessons/python/3-02-data-abstraction/",
        "/python/nested-conditionals/student-life": "/lessons/python/3-07-nested-conditionals/",
    })
    rewrite = link_rewriter(old_to_new)

    for course, cfg in COURSES.items():
        outdir = DEST / cfg["dir"]
        outdir.mkdir(parents=True, exist_ok=True)
        for old in outdir.glob("*.ipynb"):
            old.unlink()

    by_course = {}
    for it in all_items:
        by_course.setdefault(it["course"], []).append(it)

    for course, items in by_course.items():
        for pos, it in enumerate(items):
            fm, nb = it["fm"], it["nb"]
            title = it["title"] or str(fm.get("title", it["slug"])).strip()
            desc = it["desc"] or str(fm.get("description") or "").strip()
            desc = apply_replacements(re.sub(r"\s+", " ", desc))
            if not desc or re.search(r"points|\b[A-Z][a-z]+, [A-Z][a-z]+", desc):
                warnings.append(f"{it['slug']}: weak description {desc!r}")
            # the notebook converter re-emits front matter without quoting, so keep values colon-free
            nocolon = lambda v: re.sub(r":\s+", " - ", v).replace("#", "")
            title, desc = nocolon(title), nocolon(desc)
            it["title"] = title
            unit = nocolon(it["unit"])
            new_fm = {
                "layout": "post",
                "title": title,
                "description": desc,
                "categories": [it["cfg"]["category"]],
                "author": "OCS Kit",
                "codemirror": True,
                "toc": True,
                "permalink": it["permalink"],
                "lesson_course": course,
                "lesson_unit": unit,
                "lesson_order": pos + 1,
                "lesson_kind": it["kind"],
            }
            fm_text = "---\n" + yaml.safe_dump(new_fm, sort_keys=False, allow_unicode=True, width=1000) + "---"

            cells = [{"cell_type": "raw", "metadata": {}, "source": fm_text.splitlines(keepends=True)}]
            sf = SectionFilter()
            for cell in nb["cells"][1:]:
                c = copy.deepcopy(cell)
                src = "".join(c.get("source", []))
                if c["cell_type"] == "markdown":
                    if FORM_LINE.search(src):
                        src = "\n".join(l for l in src.split("\n") if not FORM_LINE.search(l))
                        src = re.sub(r"<iframe[^>]*docs\.google\.com.*?</iframe>", "", src, flags=re.S)
                    src = STYLE_BLOCK.sub("", src)
                    src = mcq_card_to_u2(src)
                    src = SPAN_STYLE.sub(r"\1", src)
                    src = re.sub(r'\s+style="color:\s*#[0-9a-fA-F]{3,6};?\s*"', "", src)
                    src = re.sub(r'(<img\b[^>]*?)\s+style="[^"]*"', r"\1", src)
                    src = re.sub(r"^\s*%%\{init:.*?\}%%\s*$\n?", "", src, flags=re.M)
                    src = HTML_DROP_SECTION.sub("", src)
                    src = DUE_LINE.sub("", src)
                    src = sf.process_markdown(src)
                    # top-level "# Title" duplicates the page title
                    src = re.sub(r"\A\s*# [^\n]*\n?", "", src) if re.match(r"\A\s*# ", src) and cells and len(cells) == 1 else src
                    src = apply_replacements(src)
                    src = drop_submission_sentences(src)
                    src = rewrite(src)
                    src = strip_dead_links(src)
                    src = re.sub(r"!\[[^\]]*\]\(\{\{site\.baseurl\}\}/images/capstone/[^)]*\)(\{:[^}]*\})?", "", src)
                    src = re.sub(r"<img[^>]*images/capstone/[^>]*>", "", src)
                    src = re.sub(r"\n{3,}", "\n\n", src).strip()
                    if not src or re.fullmatch(r"(-{3,}\s*)+", src):
                        continue
                elif c["cell_type"] == "code":
                    if sf.drop_level is not None:
                        warnings.append(f"{it['slug']}: code cell inside dropped section kept")
                    src = re.split(r"\n#%% vscode\.cell", src)[0]
                    src = apply_replacements(src)
                    src = rewrite(src)
                    clean_outputs(c)
                elif c["cell_type"] == "raw":
                    continue
                c["source"] = src.splitlines(keepends=True)
                if c["cell_type"] == "markdown":
                    c.pop("outputs", None)
                    c.pop("execution_count", None)
                    c["metadata"] = {}
                cells.append(c)

            # footer navigation (kit pager classes)
            prev_it = items[pos - 1] if pos > 0 else None
            next_it = items[pos + 1] if pos + 1 < len(items) else None
            label = it["cfg"]["label"]
            footer = ['<nav class="ocs__pager" aria-label="Lesson navigation">']
            if prev_it:
                footer.append(f'  <a class="ocs__pager-link" href="{{{{site.baseurl}}}}{prev_it['permalink']}">&larr; {prev_it['title']}</a>')
            else:
                footer.append(f'  <a class="ocs__pager-link" href="{{{{site.baseurl}}}}/lessons/{course}/">&larr; {label} course index</a>')
            if next_it:
                footer.append(f'  <a class="ocs__pager-link next" href="{{{{site.baseurl}}}}{next_it['permalink']}">{next_it['title']} &rarr;</a>')
            else:
                footer.append(f'  <a class="ocs__pager-link next" href="{{{{site.baseurl}}}}/lessons/{course}/">{label} course index &rarr;</a>')
            footer.append("</nav>")
            footer.append("")
            footer.append(f"[All {label} lessons]({{{{site.baseurl}}}}/lessons/{course}/)")
            cells.append({"cell_type": "markdown", "metadata": {}, "source": [l + "\n" for l in footer]})

            out_nb = {"cells": cells, "metadata": {
                "kernelspec": {"display_name": "Java", "language": "java", "name": "java"} if course == "java"
                else {"display_name": "Python 3", "language": "python", "name": "python3"},
                "language_info": {"name": "java" if course == "java" else "python"}},
                "nbformat": 4, "nbformat_minor": 5}
            for n, cell in enumerate(out_nb["cells"]):
                cell["id"] = f"cell-{n:03d}"
            fname = f"{it['cfg']['date']}-{course}-{pos + 1:02d}-{it['slug']}.ipynb"
            (DEST / it["cfg"]["dir"] / fname).write_text(json.dumps(out_nb, indent=1, ensure_ascii=False) + "\n")
            it["file"] = f"_notebooks/Lessons/{it['cfg']['dir']}/{fname}"
    return all_items


if __name__ == "__main__":
    items = build(sys.argv[1])
    for it in items:
        print(f"{it['file']}\t{it['permalink']}\t{it['src']}")
    for w in warnings:
        print("WARN", w, file=sys.stderr)

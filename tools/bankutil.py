#!/usr/bin/env python3
"""Helpers for writing data/bank/<topic-id>.json question banks.

A bank is the pool the lesson page ("Test your understanding") and the
Test Me builder (#/test) draw from — 20-30 questions per lesson, shuffled on
every run. Question shape matches the site's quiz engine:

    {"type": "mcq", "difficulty": "easy",
     "prompt": "...", "choices": ["...", ...], "answer": "B",
     "explanation": "..."}

Authoring format (Python, so LaTeX can live in raw strings):

    from bankutil import write_bank, add_questions
    write_bank("10-1-circles-and-circumference", "10.1", "Circles and Circumference", [
        ("easy", r"Diameter of a circle with radius $9$?", ["$18$", "$4.5$", "$81$", "$3$"], "A",
         r"$d = 2r = 18$."),
    ])

Grid-in questions pass None for the choices and a list of accepted answers
instead of a letter:

        ("medium", r"Solve for $x$ ...", None, ["7", "7.0"], r"..."),

Every writer validates the questions and raises on anything malformed, so a
typo fails loudly instead of shipping a broken quiz.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, "data", "bank")
LETTERS = "ABCDE"
DIFFS = ("easy", "medium", "hard")


def _build(items, where):
    out = []
    for i, item in enumerate(items, 1):
        diff, prompt, choices, ans, why = item
        tag = f"{where} Q{i}"
        assert diff in DIFFS, f"{tag}: bad difficulty {diff!r}"
        assert prompt and prompt.strip(), f"{tag}: empty prompt"
        assert why and why.strip(), f"{tag}: empty explanation"
        if choices is None:
            assert isinstance(ans, (list, tuple)) and ans, f"{tag}: grid-in needs accepted answers"
            out.append({
                "type": "grid-in", "difficulty": diff, "prompt": prompt,
                "acceptedAnswers": [str(a) for a in ans], "explanation": why,
            })
            continue
        assert 3 <= len(choices) <= 5, f"{tag}: {len(choices)} choices"
        assert len(set(choices)) == len(choices), f"{tag}: duplicate choices"
        assert ans in LETTERS[:len(choices)], f"{tag}: answer {ans!r} out of range"
        for c in choices:
            assert str(c).strip(), f"{tag}: empty choice"
        out.append({
            "type": "mcq", "difficulty": diff, "prompt": prompt,
            "choices": list(choices), "answer": ans, "explanation": why,
        })
    return out


def _save(path, bank):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=1)


def write_bank(topic_id, lesson_code, title, items):
    """Create (or replace) a bank."""
    os.makedirs(BANK, exist_ok=True)
    bank = {
        "id": topic_id, "lessonCode": lesson_code, "title": title,
        "questions": _build(items, lesson_code),
    }
    _save(os.path.join(BANK, topic_id + ".json"), bank)
    print(f"  {lesson_code:<6} {len(bank['questions']):>2} questions  {topic_id}")


def add_questions(topic_id, items):
    """Append to an existing bank (used to top up the seeded lessons)."""
    path = os.path.join(BANK, topic_id + ".json")
    bank = json.load(open(path, encoding="utf-8"))
    before = len(bank["questions"])
    bank["questions"].extend(_build(items, bank["lessonCode"]))
    _save(path, bank)
    print(f"  {bank['lessonCode']:<6} {before} + {len(items)} = {len(bank['questions'])} questions")

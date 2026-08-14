#!/usr/bin/env python3
"""Regenerate data/index.json — the lightweight summary the site loads on boot.

Run this after adding or editing anything in data/topics/ or data/manifest.json:

    python3 tools/build-index.py

(then bump BUST in js/app.js so students' browsers pick up the change).

The index holds only what the home page, module cards, badges, and search
need. The full topic JSON is fetched lazily when a lesson is opened.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

manifest = json.load(open(os.path.join(DATA, "manifest.json"), encoding="utf-8"))

def bank_size(topic_id):
    """How many questions data/bank/<id>.json holds (0 if there is no bank)."""
    path = os.path.join(DATA, "bank", topic_id + ".json")
    if not os.path.exists(path):
        return 0
    return len(json.load(open(path, encoding="utf-8")).get("questions", []))


topics = []
for fname in manifest["topics"]:
    t = json.load(open(os.path.join(DATA, "topics", fname), encoding="utf-8"))
    pp_items = [it for p in t.get("pastPapers", []) for it in (p.get("items") or [])]
    topics.append({
        "id": t["id"],
        "file": fname,
        "title": t["title"],
        "track": t.get("track", "ap"),
        "lessonCode": t["lessonCode"],
        "curriculumModule": t["curriculumModule"],
        "satDomain": t["satDomain"],
        "published": bool(t.get("published")),
        "questionCount": len(t.get("questions", [])),
        "lessonQuiz": t.get("lessonQuiz", 0),
        "hasLessonHtml": bool(t.get("lessonHtml")),
        "vidCount": len(t.get("videos", [])),
        "ppCount": len(pp_items),
        "ppVidCount": sum(1 for it in pp_items if str(it.get("video") or "").strip()),
        "bankCount": bank_size(t["id"]),
    })

out = os.path.join(DATA, "index.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"topics": topics}, f, ensure_ascii=False, separators=(",", ":"))

published = sum(1 for t in topics if t["published"])
print(f"Wrote data/index.json — {len(topics)} topics ({published} published)")

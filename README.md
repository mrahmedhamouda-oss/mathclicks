# MathClicks

Free IGCSE 0580 and American Pathway (Algebra 2 & Geometry) math lessons by
Mr Ahmed Hamouda — worked examples, quizzes, and past-paper practice with mark
schemes. Static site — no build step. All content lives in `data/`.

## Publishing lessons

Every lesson file in `data/topics/` has a `"published"` flag. Students only see
lessons where it is `true` — everything else is invisible to them. When a
lesson's content is ready, flip `"published": false` to `true`.

## Adding questions to a lesson

Every lesson already has a file in `data/topics/`. Open it and add question
objects to the `"questions"` array. Two kinds:

**Multiple choice** (`answer` is the letter of the correct choice):

```json
{
  "id": "q1",
  "type": "mcq",
  "difficulty": "medium",
  "prompt": "If $x^2 - 5x + 6 = 0$, what is the sum of all solutions?",
  "choices": ["$-5$", "$-1$", "$5$", "$6$"],
  "answer": "C",
  "explanation": "Factor: $(x-2)(x-3)=0$, so $x=2$ or $x=3$; the sum is $5$."
}
```

**Grid-in** (`acceptedAnswers` lists correct forms; numeric equivalents like
`0.75` vs `3/4` are accepted automatically):

```json
{
  "id": "q2",
  "type": "grid-in",
  "difficulty": "easy",
  "prompt": "If $2x = 7$, what is the value of $x$?",
  "acceptedAnswers": ["7/2", "3.5"],
  "explanation": "Divide both sides by 2."
}
```

**Explanation videos** — each lesson can also have a `"videos"` array (shown
above the quiz). YouTube links are embedded automatically; direct `.mp4` links
also work:

```json
"videos": [
  { "title": "Factoring quadratics — full explanation", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX" }
]
```

**Interactive lesson notes** — a lesson can have `"lessonHtml": "lessons/2-2.html"`
pointing to an HTML fragment in `data/lessons/`. It renders as a "Learn the
lesson" section (concept cards, collapsible examples with step-by-step reveal
buttons, vocabulary flip cards, number-line explorer) above the video and quiz.

Notes:

- Math goes between `$...$` (LaTeX, rendered by KaTeX). Example: `$\frac{3}{4}$`, `$x^2$`, `$\sqrt{5}$`.
- `difficulty`: `"easy"`, `"medium"`, or `"hard"`.
- Optional `"image": "assets/images/filename.png"` for diagram questions (put the file in `assets/images/`).
- New lesson files must also be listed in `data/manifest.json` (all 53 curriculum lessons are already there).

## Publishing checklist

Before pushing content changes live:

1. `python3 tools/build-index.py` — regenerate `data/index.json` (a GitHub
   Action also does this automatically if you forget).
2. Bump the `BUST` version in `js/app.js` (e.g. `?v=1` → `?v=2`) so returning
   students' browsers fetch the new data files.
3. If you edited `css/style.css`, `css/game.css`, `css/lesson-embed.css` or a
   JS file, also bump that file's `?v=` number (in `index.html` for style.css
   and app.js; in `js/app.js` for the lazily-loaded game/lesson-embed files).
4. GitHub Pages caches for ~10 minutes — wait a moment before checking live.

## Regenerating the lesson index

The site boots from `data/index.json` — a small summary (title, counts, badges)
of every topic — and only downloads a full topic file when a lesson is opened.
**After any change to `data/topics/`, `data/manifest.json`, or a lesson's
`published` flag, regenerate it:**

```
python3 tools/build-index.py
```

Then bump the `BUST` version in `js/app.js` so returning students fetch the
fresh files.

## Analytics (Cloudflare Web Analytics)

The site is set up for Cloudflare Web Analytics — free, privacy-friendly, no
cookies, no consent banner needed. To switch it on:

1. Log in (or sign up, no card needed) at <https://dash.cloudflare.com> and
   open **Web Analytics** in the left sidebar.
2. **Add a site** → enter the hostname `mrahmedhamouda-oss.github.io` →
   Cloudflare shows you a JS snippet containing a `"token"` value. Copy that
   token.
3. In `index.html`, find the commented-out "Cloudflare Web Analytics" block at
   the end of `<head>`, replace `CLOUDFLARE_TOKEN_HERE` with your token, and
   remove the surrounding `<!--` and `-->` so the script loads.

Visits appear in the Cloudflare dashboard within a few minutes of deploying.

## Preview locally

The site loads JSON with `fetch`, so it needs a local server (double-clicking
`index.html` won't work):

```
cd sat-math-practice
python3 serve.py
```

then open <http://localhost:8017>. (`serve.py` disables caching so edits
appear on refresh.)

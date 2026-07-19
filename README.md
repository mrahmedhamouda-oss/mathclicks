# 10SAT Math Practice

SAT Math practice site for 10SAT (Algebra 2 & Geometry, American Pathway, 2026–2027).
Static site — no build step. All content lives in `data/`.

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

Notes:

- Math goes between `$...$` (LaTeX, rendered by KaTeX). Example: `$\frac{3}{4}$`, `$x^2$`, `$\sqrt{5}$`.
- `difficulty`: `"easy"`, `"medium"`, or `"hard"`.
- Optional `"image": "assets/images/filename.png"` for diagram questions (put the file in `assets/images/`).
- New lesson files must also be listed in `data/manifest.json` (all 53 curriculum lessons are already there).

## Passcode

Students enter a shared passcode once per device. To change it, compute the new
hash (`node -e "...passHash..."`) and update `PASS_HASH` in `js/app.js` — or just
ask Claude to change it. This is a courtesy gate, not real security.

## Preview locally

The site loads JSON with `fetch`, so it needs a local server (double-clicking
`index.html` won't work):

```
cd sat-math-practice
python3 -m http.server 8000
```

then open <http://localhost:8000>.

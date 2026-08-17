"""Key Figures for lesson 9-2, Adding and Subtracting Rational Expressions.

This lesson already has Try It Yourself and Summary sections, so only the
pictures are missing.
"""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("practice", "Try It Yourself"), ("summary", "Summary"), ("quiz", "Practice Quiz")]
practice = None

# ---- Figure 1: the LCD is the union of the factor lists ---------------------
LEFT = 'fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="1.8"'
RIGHT = 'fill="var(--sl-orange-soft)" stroke="var(--sl-orange)" stroke-width="1.8"'
OUT = 'fill="var(--sl-green-soft)" stroke="var(--sl-green)" stroke-width="1.8"'
p = [
    '<text class="g-lbl-sm" x="170" y="16" text-anchor="middle">'
    'denominators: &nbsp;x&sup2; &minus; 9 = (x &minus; 3)(x + 3) &nbsp;and&nbsp; x&sup2; + 6x + 9 = (x + 3)&sup2;</text>',
    # two overlapping rounded rectangles, Venn-style
    f'<rect x="24" y="34" width="176" height="86" rx="43" {LEFT} fill-opacity="0.55"/>',
    f'<rect x="140" y="34" width="176" height="86" rx="43" {RIGHT} fill-opacity="0.55"/>',
    '<text class="g-meas-b" x="70" y="30" text-anchor="middle">first</text>',
    '<text class="g-meas" x="272" y="30" text-anchor="middle">second</text>',
    '<text class="g-lbl" x="76" y="82" text-anchor="middle">x &minus; 3</text>',
    '<text class="g-lbl" x="170" y="74" text-anchor="middle">x + 3</text>',
    '<text class="g-lbl-sm" x="170" y="94" text-anchor="middle">(shared)</text>',
    '<text class="g-lbl" x="266" y="82" text-anchor="middle">x + 3</text>',
    '<text class="g-lbl-sm" x="170" y="140" text-anchor="middle">'
    'take every factor, to the highest power it appears anywhere</text>',
    f'<rect x="60" y="152" width="220" height="34" rx="9" {OUT}/>',
    '<text class="g-grn" x="170" y="174" text-anchor="middle">LCD = (x &minus; 3)(x + 3)&sup2;</text>',
    '<text class="g-lbl-sm" x="170" y="208" text-anchor="middle">'
    'not the product of the two denominators &mdash; that would repeat (x + 3) three times</text>',
]
lcd_fig = ('<svg viewBox="0 0 340 220" width="340" role="img" aria-label="two overlapping sets of '
           'factors whose union gives the least common denominator">\n  '
           + "\n  ".join(p) + '\n</svg>')

# ---- Figure 2: the numerical version of the same procedure -----------------
STEP = 'fill="var(--sl-surface-3)" stroke="var(--sl-line-2)" stroke-width="1.5"'
rows = [
    ("the problem", "1/6 + 1/4", "the same problem", "1/(x&minus;1) + 1/(x+1)"),
    ("factor the denominators", "6 = 2&middot;3, 4 = 2&sup2;", "factor the denominators",
     "(x&minus;1), (x+1)"),
    ("build the LCD", "2&sup2;&middot;3 = 12", "build the LCD", "(x&minus;1)(x+1)"),
    ("rewrite each fraction", "2/12 + 3/12", "rewrite each fraction",
     "(x+1)/LCD + (x&minus;1)/LCD"),
    ("add the numerators", "5/12", "add the numerators", "2x/((x&minus;1)(x+1))"),
]
q = []
y = 30
q.append('<text class="g-meas-b" x="88" y="16" text-anchor="middle">with numbers</text>')
q.append('<text class="g-meas" x="252" y="16" text-anchor="middle">with algebra</text>')
for i, (ln, lv, rn, rv) in enumerate(rows):
    q.append(f'<rect x="6" y="{y}" width="164" height="40" rx="7" {STEP}/>')
    q.append(f'<rect x="176" y="{y}" width="158" height="40" rx="7" {STEP}/>')
    q.append(f'<text class="g-lbl-sm" x="14" y="{y+16}" text-anchor="start">{ln}</text>')
    q.append(f'<text class="g-meas-b" x="14" y="{y+33}" text-anchor="start">{lv}</text>')
    q.append(f'<text class="g-lbl-sm" x="184" y="{y+16}" text-anchor="start">{rn}</text>')
    q.append(f'<text class="g-grn" x="184" y="{y+33}" text-anchor="start">{rv}</text>')
    y += 46
parallel_fig = (f'<svg viewBox="0 0 340 {y}" width="340" role="img" aria-label="a side by side '
                f'comparison of adding numerical fractions and adding rational expressions">\n  '
                + "\n  ".join(q) + '\n</svg>')

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; the LCD is a union of factors, not a product</div>
{lcd_fig}
<figcaption>List the factors of each denominator, then build the LCD by taking <b>every</b> factor that
appears, each to the <b>highest power</b> it reaches in any one denominator. Here <code>(x + 3)</code>
appears once on the left and squared on the right, so the LCD carries <code>(x + 3)&sup2;</code> &mdash;
squared, not cubed. Multiplying the two denominators together would also give a common denominator, but
a needlessly large one that you would then have to simplify back down.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; you already know this procedure</div>
{parallel_fig}
<figcaption>Nothing in this lesson is new. Adding <code>1/6 + 1/4</code> and adding
<code>1/(x &minus; 1) + 1/(x + 1)</code> are the same five steps, and the only thing that changes is
that the factors are now expressions instead of primes. If you get stuck on an algebraic one, do the
matching numerical one first and copy your own moves.</figcaption>
</figure>
"""

"""Key Figures + Try It Yourself for lesson 4-3, Operations with Polynomials."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])

nav = [("concepts", "Concepts"), ("figures", "Key Figures"), ("examples", "Examples"),
       ("calculator", "Operations Calculator"), ("practice", "Try It Yourself"),
       ("quiz", "Practice Quiz")]


def box_model(cols, rows, cells, svg_id, aria, note, cw=74, ch=46, x0=58, y0=44):
    """A rectangle-area grid: column headers across the top, row headers down the side."""
    p = [f'<text class="g-lbl-sm" x="{x0 - 12}" y="{y0 - 14}" text-anchor="end">&times;</text>']
    for j, c in enumerate(cols):
        p.append(f'<text class="g-meas-b" x="{x0 + j*cw + cw/2}" y="{y0 - 12}" '
                 f'text-anchor="middle">{c}</text>')
    for i, r in enumerate(rows):
        p.append(f'<text class="g-meas" x="{x0 - 12}" y="{y0 + i*ch + ch/2 + 5}" '
                 f'text-anchor="end">{r}</text>')
    for i in range(len(rows)):
        for j in range(len(cols)):
            p.append(f'<rect x="{x0 + j*cw}" y="{y0 + i*ch}" width="{cw}" height="{ch}" '
                     f'fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="1.6"/>')
            p.append(f'<text class="g-lbl" x="{x0 + j*cw + cw/2}" y="{y0 + i*ch + ch/2 + 6}" '
                     f'text-anchor="middle">{cells[i][j]}</text>')
    w = x0 + len(cols) * cw + 14
    h = y0 + len(rows) * ch + 46
    for k, line in enumerate(note):
        p.append(f'<text class="{"g-grn" if k else "g-lbl-sm"}" x="{w/2}" '
                 f'y="{y0 + len(rows)*ch + 20 + k*17}" text-anchor="middle">{line}</text>')
    return (f'<svg id="{svg_id}" viewBox="0 0 {w} {h}" width="{min(w,340)}" role="img" '
            f'aria-label="{aria}">\n  ' + "\n  ".join(p) + '\n</svg>')


foil_fig = box_model(
    ["x", "&minus;3"], ["2x", "4"],
    [["2x&sup2;", "&minus;6x"], ["4x", "&minus;12"]],
    "l43fig1",
    "a two by two area grid multiplying 2x plus 4 by x minus 3",
    ["add the four cells:", "2x&sup2; &minus; 6x + 4x &minus; 12 = 2x&sup2; &minus; 2x &minus; 12"])

grid_fig = box_model(
    ["x&sup2;", "2x", "&minus;1"], ["x", "3"],
    [["x&sup3;", "2x&sup2;", "&minus;x"], ["3x&sup2;", "6x", "&minus;3"]],
    "l43fig2",
    "a three by two area grid multiplying x squared plus 2x minus 1 by x plus 3",
    ["add all six cells:", "x&sup3; + 5x&sup2; + 5x &minus; 3"],
    cw=68)

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; FOIL is really just an area grid</div>
{foil_fig}
<figcaption>Multiplying <code>(2x + 4)(x &minus; 3)</code> means finding the area of a rectangle whose
sides are those two expressions. Split each side into its terms and you get four smaller rectangles
&mdash; and those four areas are exactly First, Outer, Inner, Last. The grid is worth learning because
nothing can be left out: every row must meet every column.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; the grid keeps working when FOIL stops</div>
{grid_fig}
<figcaption>FOIL is a four-letter word, so it only ever handles two-term &times; two-term. Here
<code>(x&sup2; + 2x &minus; 1)(x + 3)</code> needs <b>six</b> products, and the grid produces all six
without you having to remember a mnemonic. Add along the diagonals and like terms are already grouped
for you: 2x&sup2; + 3x&sup2; = 5x&sup2;, and &minus;x + 6x = 5x.</figcaption>
</figure>
"""

practice = """
<p>Work each one out, then reveal. Problems 2 and 5 are where signs go wrong.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Simplify (4x&sup2; &minus; 3x + 7) + (2x&sup2; + 5x &minus; 9).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(4x&sup2; + 2x&sup2;) + (&minus;3x + 5x) + (7 &minus; 9)</span><span class="reason">Group like terms &mdash; same variable, same power</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">6x&sup2; + 2x &minus; 2</span><span class="reason">Combine each group</span></div>
<div class="answer-box">6x&sup2; + 2x &minus; 2</div>
<div class="check-box"><strong>Check with a number:</strong> at x = 1 the two originals give 8 and &minus;2, totalling 6; the answer gives 6 + 2 &minus; 2 = 6 &#10003;. Substituting a value is a fast way to catch a slip.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Simplify (5x&sup2; &minus; 2x + 1) &minus; (3x&sup2; + 4x &minus; 6).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">5x&sup2; &minus; 2x + 1 &minus; 3x&sup2; &minus; 4x + 6</span><span class="reason">Distribute the minus sign to <b>all three</b> terms</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">2x&sup2; &minus; 6x + 7</span><span class="reason">Combine like terms</span></div>
<div class="answer-box">2x&sup2; &minus; 6x + 7</div>
<div class="warning-box"><strong>The subtraction trap:</strong> changing only the first sign, giving 2x&sup2; + 2x &minus; 5. The minus applies to every term inside the bracket, so &minus;(&minus;6) becomes +6.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Multiply (3x &minus; 5)(2x + 7).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">3x &middot; 2x = 6x&sup2;</span><span class="reason">First</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">3x &middot; 7 = 21x</span><span class="reason">Outer</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">&minus;5 &middot; 2x = &minus;10x</span><span class="reason">Inner</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">&minus;5 &middot; 7 = &minus;35</span><span class="reason">Last</span></div>
<div class="answer-box">6x&sup2; + 11x &minus; 35</div>
<div class="check-box"><strong>Check at x = 1:</strong> (3 &minus; 5)(2 + 7) = (&minus;2)(9) = &minus;18, and 6 + 11 &minus; 35 = &minus;18 &#10003;</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Multiply (x + 4)(x&sup2; &minus; 3x + 2) using a grid.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">x &middot; (x&sup2;, &minus;3x, 2) = x&sup3;, &minus;3x&sup2;, 2x</span><span class="reason">First row of the grid</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">4 &middot; (x&sup2;, &minus;3x, 2) = 4x&sup2;, &minus;12x, 8</span><span class="reason">Second row</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x&sup3; + (&minus;3x&sup2; + 4x&sup2;) + (2x &minus; 12x) + 8</span><span class="reason">Collect like terms</span></div>
<div class="answer-box">x&sup3; + x&sup2; &minus; 10x + 8</div>
<div class="check-box"><strong>Check at x = 1:</strong> (5)(1 &minus; 3 + 2) = (5)(0) = 0, and 1 + 1 &minus; 10 + 8 = 0 &#10003;. Six products, six cells &mdash; the grid guarantees none were skipped.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">Expand (2x &minus; 3)&sup2;.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(2x &minus; 3)(2x &minus; 3)</span><span class="reason">A square means two identical factors &mdash; write them out</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">4x&sup2; &minus; 6x &minus; 6x + 9</span><span class="reason">Four products; note (&minus;3)(&minus;3) = +9</span></div>
<div class="answer-box">4x&sup2; &minus; 12x + 9</div>
<div class="warning-box"><strong>The most common error in all of algebra:</strong> writing (2x &minus; 3)&sup2; = 4x&sup2; + 9. Squaring does not distribute across a sum or difference &mdash; the middle term &minus;12x is real. Check at x = 1: (&minus;1)&sup2; = 1, and 4 &minus; 12 + 9 = 1 &#10003;, whereas 4 + 9 = 13 &#10007;</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">A rectangle is (x + 5) long and (2x &minus; 1) wide. Write its area and its perimeter as polynomials in standard form.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">A = (x + 5)(2x &minus; 1)</span><span class="reason">Area is length &times; width</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">A = 2x&sup2; &minus; x + 10x &minus; 5 = 2x&sup2; + 9x &minus; 5</span><span class="reason">Multiply out and collect</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">P = 2(x + 5) + 2(2x &minus; 1)</span><span class="reason">Perimeter is twice each side</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">P = 2x + 10 + 4x &minus; 2 = 6x + 8</span><span class="reason">Distribute and collect</span></div>
<div class="answer-box">Area = 2x&sup2; + 9x &minus; 5 and Perimeter = 6x + 8</div>
<div class="check-box"><strong>Degree tells you they are different animals:</strong> area multiplies two lengths so it is degree 2, while perimeter only adds lengths so it stays degree 1. If your area came out linear, you added when you should have multiplied.</div>
</div></div>
"""

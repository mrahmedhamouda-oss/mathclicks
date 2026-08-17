"""Key Figures + Try It Yourself for lesson 6-1, Operations on Functions."""
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])

nav = [("concepts", "Concepts"), ("figures", "Key Figures"),
       ("examples", "Step-by-Step Examples"), ("practice", "Try It Yourself"),
       ("summary", "Summary"), ("quiz", "Practice Quiz")]

MACH = 'fill="var(--sl-blue-soft)" stroke="var(--sl-blue)" stroke-width="2"'
MACH2 = 'fill="var(--sl-orange-soft)" stroke="var(--sl-orange)" stroke-width="2"'


def machine_row(y, first, second, vals, part):
    """x -> [inner] -> value -> [outer] -> value, drawn as two boxes in a chain."""
    p = []
    p.append(f'<text class="g-lbl" x="14" y="{y+6}" text-anchor="start">x</text>')
    p.append(f'<text class="g-meas" x="30" y="{y+2}" text-anchor="start">= {vals[0]}</text>')
    p.append(f'<line class="g-line-thin" x1="66" y1="{y}" x2="88" y2="{y}"/>')
    p.append(f'<polygon points="88,{y} 82,{y-4} 82,{y+4}" fill="var(--sl-ink-2)"/>')
    p.append(f'<rect x="90" y="{y-17}" width="66" height="34" rx="7" {MACH}/>')
    p.append(f'<text class="g-lbl-sm" x="123" y="{y+5}" text-anchor="middle">{first}</text>')
    p.append(f'<line class="g-line-thin" x1="156" y1="{y}" x2="192" y2="{y}"/>')
    p.append(f'<polygon points="192,{y} 186,{y-4} 186,{y+4}" fill="var(--sl-ink-2)"/>')
    p.append(f'<text class="g-meas" x="174" y="{y-8}" text-anchor="middle">{vals[1]}</text>')
    p.append(f'<rect x="194" y="{y-17}" width="66" height="34" rx="7" {MACH2}/>')
    p.append(f'<text class="g-lbl-sm" x="227" y="{y+5}" text-anchor="middle">{second}</text>')
    p.append(f'<line class="g-line-thin" x1="260" y1="{y}" x2="292" y2="{y}"/>')
    p.append(f'<polygon points="292,{y} 286,{y-4} 286,{y+4}" fill="var(--sl-ink-2)"/>')
    p.append(f'<text class="g-grn" x="298" y="{y+5}" text-anchor="start">{vals[2]}</text>')
    return [f'<g data-part="{part}">' + "".join(p) + "</g>"]


# f(x) = 3x, g(x) = 2x - 4, tested at x = 5
# [f o g](5) = f(g(5)) = f(6) = 18       g first, then f
# [g o f](5) = g(f(5)) = g(15) = 26      f first, then g
body = []
body.append('<text class="g-meas-b" x="170" y="18" text-anchor="middle">'
            'f(x) = 3x &nbsp;&middot;&nbsp; g(x) = 2x &minus; 4 &nbsp;&middot;&nbsp; start with x = 5</text>')
body.append('<text class="g-lbl-sm" x="14" y="46" text-anchor="start" data-part="fg">'
            '[f &#8728; g](5) &mdash; inner function g runs first</text>')
body += machine_row(76, "g: &times;2 &minus; 4", "f: &times;3", ["5", "6", "18"], "fg")
body.append('<text class="g-lbl-sm" x="14" y="122" text-anchor="start" data-part="gf">'
            '[g &#8728; f](5) &mdash; inner function f runs first</text>')
body += machine_row(152, "f: &times;3", "g: &times;2 &minus; 4", ["5", "15", "26"], "gf")
body.append('<text class="g-meas" x="170" y="196" text-anchor="middle">'
            '18 &ne; 26 &mdash; so [f &#8728; g](x) is not [g &#8728; f](x)</text>')
machine_fig = ('<svg id="l61fig1" viewBox="0 0 340 208" width="340" role="img" '
               'aria-label="two chains of function machines showing that composing f after g gives 18 '
               'while composing g after f gives 26">\n  ' + "\n  ".join(body) + '\n</svg>')

# ---- Figure 2: which x values survive ---------------------------------------
DOM = 'fill="var(--sl-green-soft)" stroke="var(--sl-green)" stroke-width="1.8"'
BAD = 'fill="var(--sl-bad-soft)" stroke="var(--sl-bad-line)" stroke-width="1.8"'
p2 = [
    '<text class="g-meas-b" x="170" y="18" text-anchor="middle">'
    'f(x) = &radic;x &nbsp;&middot;&nbsp; g(x) = x &minus; 4 &nbsp;&middot;&nbsp; [f &#8728; g](x) = &radic;(x &minus; 4)</text>',
    f'<rect x="26" y="38" width="132" height="52" rx="9" {DOM}/>',
    '<text class="g-lbl-sm" x="92" y="58" text-anchor="middle">g accepts</text>',
    '<text class="g-meas" x="92" y="78" text-anchor="middle">every real x</text>',
    f'<rect x="182" y="38" width="132" height="52" rx="9" {BAD}/>',
    '<text class="g-lbl-sm" x="248" y="58" text-anchor="middle">but f only accepts</text>',
    '<text class="g-meas" x="248" y="78" text-anchor="middle">inputs &ge; 0</text>',
    '<line class="g-line-thin" x1="158" y1="64" x2="180" y2="64"/>',
    '<text class="g-lbl-sm" x="170" y="112" text-anchor="middle">so g(x) = x &minus; 4 must itself be &ge; 0</text>',
    f'<rect x="76" y="126" width="188" height="38" rx="9" {DOM}/>',
    '<text class="g-grn" x="170" y="150" text-anchor="middle">domain of f &#8728; g: x &ge; 4</text>',
]
domain_fig = ('<svg viewBox="0 0 340 176" width="340" role="img" aria-label="a diagram showing that '
              'the domain of f composed with g is restricted to x greater than or equal to 4">\n  '
              + "\n  ".join(p2) + '\n</svg>')

figures = f"""
<figure class="fig">
<div class="fig-title">Figure 1 &mdash; composition is a chain of machines, and order matters</div>
{machine_fig}
<div class="fig-legend">
  <span class="fig-chip" onclick="figHi(this,'l61fig1','fg')">[f &#8728; g](5) = 18</span>
  <span class="fig-chip" onclick="figHi(this,'l61fig1','gf')">[g &#8728; f](5) = 26</span>
</div>
<figcaption>Think of each function as a machine: a number goes in, a number comes out. Composition
wires two machines in series, and <code>[f &#8728; g](x)</code> means the output of <b>g</b> is fed into
<b>f</b> &mdash; so <b>g runs first</b>, even though f is written first. Swap the order and you get a
different answer, which is why composition is not commutative.</figcaption>
</figure>

<figure class="fig">
<div class="fig-title">Figure 2 &mdash; the domain has to survive both machines</div>
{domain_fig}
<figcaption>An <i>x</i> only belongs to the domain of <code>f &#8728; g</code> if it clears two hurdles:
g must accept it, and g's output must be something f accepts. Here g takes any real number, but f
= &radic;x refuses negatives, so we need <code>x &minus; 4 &ge; 0</code>. The composed formula
&radic;(x &minus; 4) happens to show this clearly, but with division the restriction can hide &mdash;
which is why you check the <i>inner</i> function's output, not just the final simplified formula.</figcaption>
</figure>
"""

practice = """
<p>Use f(x) = x&sup2; &minus; 1 and g(x) = 2x + 3 unless a problem says otherwise. Work each one out
before revealing.</p>

<div class="try-box"><h4>Problem 1</h4><div class="prob">Find (f + g)(x) and (f &minus; g)(x).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(f + g)(x) = (x&sup2; &minus; 1) + (2x + 3)</span><span class="reason">Add the two rules</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">= x&sup2; + 2x + 2</span><span class="reason">Combine like terms</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">(f &minus; g)(x) = (x&sup2; &minus; 1) &minus; (2x + 3)</span><span class="reason">Subtract &mdash; keep the bracket</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">= x&sup2; &minus; 2x &minus; 4</span><span class="reason">Distribute the minus to both terms</span></div>
<div class="answer-box">(f + g)(x) = x&sup2; + 2x + 2 and (f &minus; g)(x) = x&sup2; &minus; 2x &minus; 4</div>
<div class="warning-box"><strong>Order matters for subtraction:</strong> (g &minus; f)(x) = &minus;x&sup2; + 2x + 4, which is not the same function. Read carefully which one is being subtracted.</div>
</div></div>

<div class="try-box"><h4>Problem 2</h4><div class="prob">Find (f &middot; g)(x) and state (f/g)(x) with its restriction.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">(f &middot; g)(x) = (x&sup2; &minus; 1)(2x + 3)</span><span class="reason">Multiply the rules</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">= 2x&sup3; + 3x&sup2; &minus; 2x &minus; 3</span><span class="reason">Expand all six products and collect</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">(f/g)(x) = (x&sup2; &minus; 1)/(2x + 3)</span><span class="reason">Divide the rules</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">2x + 3 = 0 &rarr; x = &minus;3/2</span><span class="reason">Exclude wherever the denominator is zero</span></div>
<div class="answer-box">(f &middot; g)(x) = 2x&sup3; + 3x&sup2; &minus; 2x &minus; 3; &nbsp;(f/g)(x) = (x&sup2; &minus; 1)/(2x + 3), x &ne; &minus;3/2</div>
<div class="check-box"><strong>State the restriction even if nothing cancels.</strong> A quotient of functions is undefined wherever the bottom function is zero, and that exclusion is part of the answer.</div>
</div></div>

<div class="try-box"><h4>Problem 3</h4><div class="prob">Find [f &#8728; g](2) and [g &#8728; f](2).</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">g(2) = 2(2) + 3 = 7</span><span class="reason">For f &#8728; g the inner function g goes first</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">f(7) = 49 &minus; 1 = 48</span><span class="reason">Feed that output into f</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">f(2) = 4 &minus; 1 = 3</span><span class="reason">For g &#8728; f the inner function f goes first</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">g(3) = 2(3) + 3 = 9</span><span class="reason">Feed that output into g</span></div>
<div class="answer-box">[f &#8728; g](2) = 48 and [g &#8728; f](2) = 9</div>
<div class="check-box"><strong>Very different answers</strong> from the same starting number &mdash; exactly the point of Figure 1. Work strictly inside out.</div>
</div></div>

<div class="try-box"><h4>Problem 4</h4><div class="prob">Find [f &#8728; g](x) as a simplified expression.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">[f &#8728; g](x) = f(2x + 3)</span><span class="reason">Replace the input of f with the whole of g(x)</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">= (2x + 3)&sup2; &minus; 1</span><span class="reason">Wherever f had x, put (2x + 3) &mdash; brackets are essential</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">= 4x&sup2; + 12x + 9 &minus; 1</span><span class="reason">Expand the square in full</span></div>
<div class="answer-box">[f &#8728; g](x) = 4x&sup2; + 12x + 8</div>
<div class="check-box"><strong>Check against Problem 3:</strong> at x = 2 this gives 16 + 24 + 8 = 48 &#10003;, matching the step-by-step value. Substituting a number is the fastest way to catch a composition slip.</div>
</div></div>

<div class="try-box"><h4>Problem 5</h4><div class="prob">If p(x) = 1/x and q(x) = x &minus; 5, find [p &#8728; q](x) and its domain.</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">[p &#8728; q](x) = p(x &minus; 5) = 1/(x &minus; 5)</span><span class="reason">q runs first, and its output becomes p's input</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">p rejects an input of 0</span><span class="reason">So q(x) must not be 0</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">x &minus; 5 &ne; 0 &rarr; x &ne; 5</span><span class="reason">Exclude that value</span></div>
<div class="answer-box">[p &#8728; q](x) = 1/(x &minus; 5), domain: all real x except x = 5</div>
<div class="check-box"><strong>Same logic as Figure 2:</strong> the restriction comes from what the <i>outer</i> function refuses, applied to the <i>inner</i> function's output.</div>
</div></div>

<div class="try-box"><h4>Problem 6</h4><div class="prob">Given f(x) = x&sup2; &minus; 1 and g(x) = 2x + 3, is there any value of x where [f &#8728; g](x) = [g &#8728; f](x)?</div>
<button class="reveal-btn" onclick="reveal(this)">Show Solution</button><div class="reveal-body">
<div class="solution-step"><span class="num">1</span><span class="math">[f &#8728; g](x) = 4x&sup2; + 12x + 8</span><span class="reason">From Problem 4</span></div>
<div class="solution-step"><span class="num">2</span><span class="math">[g &#8728; f](x) = 2(x&sup2; &minus; 1) + 3 = 2x&sup2; + 1</span><span class="reason">Substitute f into g this time</span></div>
<div class="solution-step"><span class="num">3</span><span class="math">4x&sup2; + 12x + 8 = 2x&sup2; + 1</span><span class="reason">Set them equal</span></div>
<div class="solution-step"><span class="num">4</span><span class="math">2x&sup2; + 12x + 7 = 0</span><span class="reason">Collect on one side</span></div>
<div class="solution-step"><span class="num">5</span><span class="math">x = (&minus;12 &plusmn; &radic;(144 &minus; 56)) / 4 = (&minus;6 &plusmn; &radic;22)/2</span><span class="reason">Quadratic formula, then simplify &radic;88 = 2&radic;22</span></div>
<div class="answer-box">Yes, at x = (&minus;6 &plusmn; &radic;22)/2 &asymp; &minus;0.65 and &minus;5.35</div>
<div class="check-box"><strong>Not commutative does not mean never equal.</strong> The two compositions are different <i>functions</i>, but different functions can still agree at particular points &mdash; here at two of them.</div>
</div></div>
"""

"""Insert a Key Figures and/or Try It Yourself section into an existing lesson.

The Module 2 lessons were rewritten wholesale, but the Module 3-9 lessons already
have good prose and quizzes -- they are only missing pictures and scaffolded
practice. This patches those two sections in without touching the rest.

Each lesson supplies its content in a `patch_<lesson>.py` module exposing:
    figures  -- HTML for the body of <section id="figures">   (or None)
    practice -- HTML for the body of <section id="practice">  (or None)
    nav      -- list of (jump-id, label) for the rebuilt jump nav
"""
import importlib
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

REVEAL_JS = """function reveal(btn){const b=btn.nextElementSibling;b.classList.toggle('open');btn.textContent=b.classList.contains('open')?'Hide Solution':'Show Solution';}
function figHi(chip,figId,cls){
  const fig=document.getElementById(figId);
  const on=chip.classList.contains('on');
  fig.parentElement.querySelectorAll('.fig-chip').forEach(c=>c.classList.remove('on'));
  fig.querySelectorAll('[data-part]').forEach(e=>e.classList.remove('g-fade'));
  if(!on){chip.classList.add('on');fig.querySelectorAll('[data-part]').forEach(e=>{if(e.getAttribute('data-part')!==cls)e.classList.add('g-fade');});}
}
"""


def patch(lesson):
    mod = importlib.import_module('patch_' + lesson.replace('-', '_'))
    path = ROOT / f'data/lessons/{lesson}.html'
    html = path.read_text()
    orig_len = len(html)

    # --- jump nav ---------------------------------------------------------
    nav = '<nav class="lesson-jump">' + "".join(
        f'<a data-jump="{jid}">{label}</a>' for jid, label in mod.nav) + '</nav>'
    html, n = re.subn(r'<nav class="lesson-jump">.*?</nav>', nav, html, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{lesson}: could not find the jump nav')

    # --- figures section, placed straight after the concepts section ------
    if getattr(mod, 'figures', None):
        if 'id="figures"' in html:
            raise SystemExit(f'{lesson}: a figures section already exists')
        anchor = re.search(r'(<section id="concepts">.*?</section>\n)', html, re.S)
        if not anchor:
            raise SystemExit(f'{lesson}: could not find the concepts section')
        block = f'\n<section id="figures">\n<h2>Key Figures</h2>\n{mod.figures}\n</section>\n'
        html = html[:anchor.end()] + block + html[anchor.end():]

    # --- practice section, placed before summary (else before quiz) -------
    if getattr(mod, 'practice', None):
        if 'id="practice"' in html:
            raise SystemExit(f'{lesson}: a practice section already exists')
        target = None
        for sec in ('summary', 'quiz'):
            m = re.search(rf'\n<section id="{sec}">', html)
            if m:
                target = m
                break
        if not target:
            raise SystemExit(f'{lesson}: could not find a summary or quiz section')
        block = (f'\n<section id="practice">\n<h2>Try It Yourself</h2>\n'
                 f'{mod.practice}\n</section>\n')
        html = html[:target.start()] + block + html[target.start():]

    # --- helper functions + window exports --------------------------------
    if 'function reveal(' not in html:
        m = re.search(r'\nfunction toggleExample\(', html)
        if not m:
            raise SystemExit(f'{lesson}: no toggleExample to anchor the helpers to')
        html = html[:m.start() + 1] + REVEAL_JS + html[m.start() + 1:]
    html, n = re.subn(r'window\.toggleExample=toggleExample;',
                      'window.toggleExample=toggleExample;window.reveal=reveal;window.figHi=figHi;',
                      html, count=1)
    if n != 1:
        raise SystemExit(f'{lesson}: could not extend the window exports')

    path.write_text(html)
    print(f'patched {lesson}: {orig_len} -> {len(html)} bytes '
          f'(+{len(html)-orig_len}); figures={bool(getattr(mod,"figures",None))} '
          f'practice={bool(getattr(mod,"practice",None))}')


for arg in sys.argv[1:]:
    patch(arg)

"""Assemble a lesson page from its prose template plus its generated figures.

    python3 build.py 2-5          # tpl_2_5.html + fig_2_5.py -> data/lessons/2-5.html
    python3 build.py 2-3 2-5      # several at once
"""
import importlib
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))


def build(lesson):
    slug = lesson.replace('-', '_')
    figs = importlib.import_module(f'fig_{slug}').figs
    body = (HERE / f'tpl_{slug}.html').read_text()
    for key, svg in figs.items():
        body = body.replace('{{' + key.upper() + '}}', svg)
    if '{{' in body:
        raise SystemExit(f'{lesson}: unfilled placeholder remains')
    out = ROOT / f'data/lessons/{lesson}.html'
    out.write_text(body)
    print(f'wrote {out.relative_to(ROOT)}  {len(body)} bytes  ({len(figs)} figures)')


for arg in (sys.argv[1:] or ['2-5']):
    build(arg)

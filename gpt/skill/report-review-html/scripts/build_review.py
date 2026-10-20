#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a self-contained bilingual paragraph version editor."""
import argparse, html, json, re
from pathlib import Path

def esc(value):return html.escape(str(value),quote=True)
def pairs(p):
    parts={k:p.get(k,'').split('\n\n') for k in ['en','zh']}
    return ''.join(f'<p lang="{lang}" class="prose">{esc(parts[lang][i])}</p>' for i in range(max(map(len,parts.values()))) for lang in ['en','zh'] if i<len(parts[lang]) and parts[lang][i])

def render(d):
    ids=[b['id'] for b in d['blocks']]
    assert ids and len(ids)==len(set(ids)) and all(re.fullmatch(r'[a-zA-Z0-9_-]+',x) for x in ids)
    sections=[];toc=[]
    for b in d['blocks']:
        versions=b['versions'];assert versions
        assert len({v['id'] for v in versions})==len(versions)
        for v in versions:assert all(isinstance(v.get(k),str) for k in ['id','en','zh'])
        context=''
        for t in b.get('tables',[]):
            head=''.join('<th>'+esc(x)+'</th>' for x in t['headers'])
            rows=''.join('<tr>'+''.join('<td>'+esc(x)+'</td>' for x in row)+'</tr>' for row in t['rows'])
            context+=f'<div class="table-wrap"><table><caption>{esc(t["caption"])}</caption><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>'
        for f in b.get('figures',[]):
            assert not re.match(r'(?i)(javascript|data):',f['src'])
            context+=f'<figure><img loading="lazy" src="{esc(f["src"])}" alt="{esc(f["caption"])}"><figcaption>{esc(f["caption"])}</figcaption></figure>'
        editors=''
        for lang,label in [('en','English'),('zh','中文')]:
            editors+=f'<label for="{b["id"]}-{lang}">{label}</label><div class="edit-box"><div class="highlight highlight-{lang}" aria-hidden="true"></div><textarea id="{b["id"]}-{lang}" class="edit-{lang}" lang="{lang}" spellcheck="false" placeholder="在这里编写新版；留空则沿用左侧这一语言的内容。"></textarea></div>'
        options=''.join(f'<option value="{esc(v["id"])}"'+(' selected' if i==len(versions)-1 else '')+f'>v{i+1}</option>' for i,v in enumerate(versions))
        sections.append(f'''<section class="block" id="{b['id']}"><h2>{esc(b['title'])}</h2><div class="diff-grid"><div class="before"><div class="pane-title"><h3>修改前 · 历史版本</h3><label>版本 <select class="version-select" aria-label="{esc(b['title'])} 历史版本">{options}</select></label></div><div class="history-text">{pairs(versions[-1])}</div></div><div class="after"><h3>修改后 · 编写新版</h3>{editors}<div class="save-row"><button class="save-version" disabled>保存本段</button><span class="save-status" role="status" aria-live="polite">右侧留空，等待编写。</span></div><p class="hint">只改一种语言时，另一栏留空会沿用左侧版本。</p></div></div><div class="clean">{pairs(versions[-1])}</div>{context}<p class="evidence">依据：{esc(b.get('evidence',''))}</p></section>''')
        toc.append(f'<a href="#{b["id"]}">{esc(b["title"])}</a>')
    assets=Path(__file__).resolve().parents[1]/'assets'
    data=json.dumps(d,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(d['title'])}</title><style>{(assets/'review.css').read_text()}</style></head><body><header><a href="{esc(d['back_href'])}">← 返回目录</a><p class="eyebrow">PARAGRAPH VERSIONS</p><h1>{esc(d['title'])}</h1><p>左侧选版本查看，右侧直接编写；点击“保存本段”后，新版本进入左侧列表，右侧清空。</p><p class="notice">请直接用 GPT 原生批注提出修改意见。自行编辑的版本与未保存草稿保存在当前浏览器；不会自动改写本地文件。红色删除、绿色新增仅用于显示正在编辑的差异。</p></header><div class="toolbar"><label>视图 <select id="view"><option value="diff">前后对照</option><option value="clean">阅读稿 · 当前内容</option></select></label><span class="view-hint">阅读稿显示正在编写的内容；右侧为空时显示左侧所选版本。</span></div><div class="layout"><nav aria-label="报告目录">{''.join(toc)}</nav><main>{''.join(sections)}</main></div><p id="message" role="status" aria-live="polite"></p><script id="review-data" type="application/json">{data}</script><script>{(assets/'review.js').read_text()}</script></body></html>'''

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('input',type=Path);ap.add_argument('output',type=Path);a=ap.parse_args()
    d=json.loads(a.input.read_text());a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(render(d))
    print(f'Rendered {len(d["blocks"])} versioned paragraphs: {a.output}')

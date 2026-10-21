#!/usr/bin/env python3
"""Conversion/anchor checks; no browser rendering claims."""
import sys, tempfile, hashlib
from pathlib import Path
from types import SimpleNamespace
from html.parser import HTMLParser
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_folder_index import pdf_outline,pdf_preview,render,workbook
from html_outline import html_preview
from pypdf import PdfWriter,PdfReader
from PIL import Image
import openpyxl

class Tags(HTMLParser):
 def __init__(self,text):super().__init__();self.ids=[];self.links=[];self.feed(text)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a':self.links.append(a)

def valid(body):
 tags=Tags(body);assert len(tags.ids)==len(set(tags.ids))
 for a in tags.links:
  if a.get('href','').startswith('#'):assert a['href'][1:] in tags.ids,a
 return tags

with tempfile.TemporaryDirectory(prefix='index-outlines-') as temp:
 root=Path(temp);out=root/'preview.html'
 pdf=root/'bookmarks.pdf';writer=PdfWriter()
 for _ in range(3):writer.add_blank_page(width=150,height=150)
 first=writer.add_outline_item('第一章',0);writer.add_outline_item('小节 & <正文>',0,parent=first)
 writer.add_outline_item('第三章',2);writer.write(pdf)
 reader=PdfReader(pdf)
 entries=pdf_outline(reader,2)
 assert entries==[('page-1','第一章 / 小节 & <正文>',0),('page-2','第 2 页',0)],entries
 body,notes=pdf_preview(pdf,out,2);tags=valid(body)
 assert len(tags.links)==2 and '第三章' not in body and notes
 assert '小节 &amp; &lt;正文&gt;' in body
 one,_=pdf_preview(pdf,out,1);assert 'toc-toggle' not in one
 # Preserve legacy office pagination by using the same PDF navigation path.
 wb=openpyxl.Workbook();wb.active.title='数据 & <表>';wb.create_sheet('说明');xlsx=root/'book.xlsx';wb.save(xlsx)
 body,_=workbook(xlsx,out,100);tags=valid(body)
 assert [a['href'] for a in tags.links]==['#sheet-0','#sheet-1']
 # A multipage image has page navigation; a single image does not.
 tif=root/'multi.tiff';im=Image.new('RGB',(30,30));im.save(tif,save_all=True,append_images=[im.copy(),im.copy()])
 args=SimpleNamespace(max_pages=2,max_cells=100,max_text_bytes=200000)
 body,notes,status=render(tif,out,args,{})
 assert len(valid(body).links)==2 and notes and status=='preview'
 htmlfile=root/'source.html'
 source='<!doctype html><html><head><meta charset="utf-8"></head><body><h1 id="keep">标题</h1><h2>同名</h2><h2>同名</h2><img src="asset.png"><script>parent.injected=true</script></body></html>'
 htmlfile.write_text(source);Image.new('RGB',(2,2)).save(root/'asset.png')
 dest=root/'generated';dest.mkdir();out=dest/'preview.html'
 body=html_preview(htmlfile,out,200000);copy=(dest/'content.html').read_text()
 assert htmlfile.read_text()==source and 'sandbox=""' in body and '<base href="../source.html">' in copy
 nav=Tags(body);frame=Tags(copy)
 assert len(nav.links)==3 and 'keep' in frame.ids
 for link in nav.links:
  assert link['href'].split('#')[1] in frame.ids
  assert link['target']=='document-content' and link['data-frame']=='embedded-document'
 assert '<script>parent.injected=true</script>' in copy # Disabled by the iframe sandbox, not executed by this tool.
 htmlfile.write_text('<head><base href="assets/"></head><h1>A</h1><h2>B</h2>');html_preview(htmlfile,out,200000)
 assert '<base href="../assets/">' in (dest/'content.html').read_text()
 htmlfile.write_text('<h1>Only title</h1>');assert 'toc-toggle' not in html_preview(htmlfile,out,200000)
 print('PASS: PDF bookmarks/page fallback/truncation, worksheet anchors, multipage TIFF, sandboxed HTML heading anchors, duplicate headings, source preservation, single-page omission')

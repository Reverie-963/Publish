"""Check exported document content and image handling without running Office."""
from pathlib import Path
import sys,tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from office_web import writer_html
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);export=root/'export';export.mkdir();out=root/'preview'/'preview.html';out.parent.mkdir()
    source=root/'source.docx';source.write_bytes(b'fixture')
    (export/'image #1.png').write_bytes(b'test image')
    page=export/'source.html'
    page.write_text('''<html><head><style>body{width:800px}</style></head><body>
<h1>Title</h1><p style="position:absolute;width:900px;font-weight:bold" onclick="bad()">Selectable 中文 <strong>bold</strong></p>
<table width="900"><tr><td colspan="2">Cell</td></tr></table><ul><li>Item</li></ul>
<img src="image%20%231.png" width="900"><a href="https://example.org">Reference</a>
<script>bad()</script><iframe src="https://bad.example"></iframe><a href="javascript:bad()">Label</a></body></html>''')
    result=writer_html(page,source,out,{})
    for expected in ['Selectable 中文','<strong>bold</strong>','colspan="2"','<ul><li>Item','https://example.org','web-assets/','class="toc-toggle"']:
        assert expected in result,expected
    for forbidden in ['<script','<iframe','onclick','javascript:','position:','width="900"']:
        assert forbidden not in result,forbidden
    assert len(list((out.parent/'web-assets').glob('*')))==1
    for body in ['<p></p>','<img src="missing.png">','<img src="https://example.org/image.png">']:
        page.write_text('<html><body>'+body+'</body></html>')
        try:writer_html(page,source,out,{})
        except ValueError:pass
        else:raise AssertionError('Invalid content accepted: '+body)
print('Office web content, table/image preservation, active-content removal and explicit failure checks passed')

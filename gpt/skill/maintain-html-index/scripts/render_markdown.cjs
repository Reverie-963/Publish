'use strict';
const fs=require('fs'),path=require('path'),MarkdownIt=require('markdown-it'),katex=require('katex'),texmath=require('markdown-it-texmath');
const input=JSON.parse(fs.readFileSync(0,'utf8')),md=new MarkdownIt({html:false,highlight:require('./highlight_code.cjs').highlight}).use(texmath,{engine:katex,delimiters:['dollars','brackets'],katexOptions:{throwOnError:true,trust:false}}).use(require('./important_blocks.cjs'));
const encode=p=>p.split(path.sep).map(encodeURIComponent).join('/');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokens=md.parse(input.text===undefined?fs.readFileSync(input.source,'utf8'):input.text,{}),used=new Map([["reader-top",1],["reader-toc",1]]),headings=[],issues=[];
for(let i=0;i<tokens.length;i++)if(tokens[i].type==='heading_open'){const label=(tokens[i+1].children||[]).map(t=>t.content||'').join('');const base=label.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-')||'section';const n=used.get(base)||0;used.set(base,n+1);const id=base+(n?'-'+n:'');tokens[i].attrSet('id',id);headings.push({label,id,level:+tokens[i].tag.slice(1)});}
function visit(ts){for(const t of ts){const attr=t.type==='image'?'src':t.type==='link_open'?'href':null;if(attr){const u=t.attrGet(attr);if(u&&!/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u)){const m=u.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);let target;try{target=path.resolve(path.dirname(input.source),decodeURIComponent(m[1]));}catch{target=path.resolve(path.dirname(input.source),m[1]);}if(!fs.existsSync(target))issues.push('链接目标不存在：'+u);const out=attr==='href'&&input.mapping[target]||target;t.attrSet(attr,encode(path.relative(path.dirname(input.output),out))+(m[2]||'')+(m[3]||''));}}if(t.children)visit(t.children);}}visit(tokens);
const blocks={};let rendered='';
if(input.editable){
 const starts=tokens.map((t,i)=>t.level===0&&t.map&&t.type!=='inline'?i:-1).filter(i=>i>=0);
 let cursor=0;
 for(let n=0;n<starts.length;n++){
  const start=starts[n],end=n+1<starts.length?starts[n+1]:tokens.length,key='block-'+n;
  rendered+=md.renderer.render(tokens.slice(cursor,start),md.options,{});
  blocks[key]={lines:tokens[start].map};
  rendered+='<div data-edit-block="'+key+'">'+md.renderer.render(tokens.slice(start,end),md.options,{})+'</div>';cursor=end;
 }
 rendered+=md.renderer.render(tokens.slice(cursor),md.options,{});
}else rendered=md.renderer.render(tokens,md.options,{});
const body=rendered.replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
if(/katex-error|texmath-error/.test(body))issues.push('部分公式未能渲染，请检查原文。');
const toc=headings.length>1?'<button class="toc-toggle" aria-expanded="false" aria-controls="reader-toc">目录 →</button><aside class="toc-panel" id="reader-toc" inert><nav class="toc" aria-label="文章目录">'+headings.map(h=>'<a href="#'+encodeURIComponent(h.id)+'" style="margin-left:'+((h.level-1)*12)+'px">'+esc(h.label)+'</a>').join('')+'</nav></aside>':'';
process.stdout.write(JSON.stringify({body:toc+body,issues,blocks}));

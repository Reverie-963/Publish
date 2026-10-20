#!/usr/bin/env node
'use strict';
// Generates portable, offline reading pages from source Markdown; never edits MD.
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const MarkdownIt=require('markdown-it'), texmath=require('markdown-it-texmath'), katex=require('katex');
const args=process.argv.slice(2);const opt={files:[]};
for(let i=0;i<args.length;i++){const a=args[i];if(a==='--root')opt.root=path.resolve(args[++i]);else if(a==='--file')opt.files.push(args[++i]);else if(a==='--manifest')opt.manifest=path.resolve(args[++i]);else if(a==='--update-indexes')opt.indexes=true;else if(a==='--include-originals')opt.originals=true;else throw Error('Unknown argument: '+a);}
if(!opt.root)throw Error('Usage: node build_html_readers.cjs --root DIR [--file relative.md ...] [--update-indexes] [--manifest /temporary/report.json]');
const root=opt.root, entryName=fs.existsSync(path.join(opt.root,'00 - 文件索引.html'))?'00 - 文件索引.html':'index.html', marker='<!-- codex-md-reader v1 -->';
const skip=n=>n.startsWith('.')||['node_modules','assets','source_assets','work','99 - 归档'].includes(n)||n.endsWith('_assets');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?(skip(e.name)?[]:walk(p)):(e.isFile()?[p]:[]);});}
const all=walk(root);const files=opt.files.length?opt.files.map(p=>path.resolve(root,p)):all.filter(p=>p.endsWith('.md')&&!/(^|\/)(README|AGENTS)\.md$/.test(p)&&!p.split(path.sep).includes('文稿索引')&&(opt.originals||!p.endsWith('.original.md')||fs.existsSync(p.replace(/\.md$/,'.html'))));
const mapping=new Map(files.map(f=>[f,f.replace(/\.md$/,'.html')]));
const linkMapping=new Map(mapping);
for(const f of all.filter(f=>f.endsWith('.md'))){const html=f.replace(/\.md$/,'.html');if(!linkMapping.has(f)&&fs.existsSync(html)&&fs.readFileSync(html,'utf8').includes(marker))linkMapping.set(f,html);}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=p=>p.split(path.sep).map(s=>encodeURIComponent(s)).join('/');
const relative=(from,to)=>enc(path.relative(path.dirname(from),to));
const sourceHash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const before=new Map(files.map(f=>[f,sourceHash(f)]));
for(const [md,out] of mapping){if(!fs.existsSync(md))throw Error('Missing source: '+md);if(fs.existsSync(out)&&!fs.readFileSync(out,'utf8').includes(marker))throw Error('Refusing to overwrite unrelated HTML: '+out);}
const stat={root,documents:[],math_errors:[],missing_links:[],missing_images:[],fragment_errors:[],updated_indexes:[],dependencies:{markdown_it:require('markdown-it/package.json').version,katex:require('katex/package.json').version}};
const asset=path.join(root,'assets','html-reader');
const packageRoot=path.dirname(require.resolve('katex/package.json'));
fs.mkdirSync(asset,{recursive:true});
fs.copyFileSync(path.join(packageRoot,'dist','katex.min.css'),path.join(asset,'katex.min.css'));
fs.cpSync(path.join(packageRoot,'dist','fonts'),path.join(asset,'fonts'),{recursive:true});
fs.copyFileSync(path.join(packageRoot,'LICENSE'),path.join(asset,'KaTeX-LICENSE.txt'));
for(const name of ['reader.css','reader.js'])fs.copyFileSync(path.join(__dirname,'..','assets',name),path.join(asset,name));
const parsed=new Map();
let activeFile='',mathCount=0;
const md=new MarkdownIt({html:false,linkify:false,typographer:false}).use(texmath,{engine:katex,delimiters:['dollars','brackets']});
for(const kind of ['math_inline','math_inline_double','math_block','math_block_eqno'])md.renderer.rules[kind]=(tokens,i)=>{
 const t=tokens[i],display=kind!=='math_inline';mathCount++;
 try {const str=katex.renderToString(t.content,{displayMode:display,throwOnError:true,trust:false,strict:'ignore',output:'htmlAndMathml'});return display?'<div class="math-display">'+str+(kind==='math_block_eqno'?'<span class="eqno">('+esc(t.info)+')</span>':'')+'</div>':str;}
 catch(e){stat.math_errors.push({file:path.relative(root,activeFile),formula:t.content,error:e.message});return '<code class="math-error">'+esc(t.content)+'</code>';}
};
md.renderer.rules.safe_anchor=(tokens,i)=>'<a id="'+esc(tokens[i].content)+'"></a>';
const plain=token=>(token.children||[]).map(t=>t.type==='softbreak'?' ':t.content||'').join('');
function slug(s){return s.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s+/g,'-')||'section';}
// Parse all manuscripts first so cross-document fragments can be checked.
for(const file of files){const text=fs.readFileSync(file,'utf8');const tokens=md.parse(text,{}),headings=[],anchors=[],used=new Map([["reader-top",1],["reader-toc",1]]);
 for(const t of tokens)if(t.type==='inline'){
  const match=t.content.match(/^<a\s+(?:id|name)=["']([A-Za-z][A-Za-z0-9_.:-]*)["']\s*><\/a>$/);
  if(match&&!used.has(match[1])){anchors.push(match[1]);used.set(match[1],1);t.type='safe_anchor';t.content=match[1];t.children=null;}
 }
 for(let i=0;i<tokens.length;i++)if(tokens[i].type==='heading_open'){
  const label=plain(tokens[i+1]),base=slug(label),n=used.get(base)||0;used.set(base,n+1);const id=n?base+'-'+n:base;tokens[i].attrSet('id',id);headings.push({level:Number(tokens[i].tag.slice(1)),label,id});
 }
 parsed.set(file,{tokens,headings,anchors,title:headings.find(h=>h.level===1)?.label||path.basename(file,'.md')});
}
function resolveLink(file,u){
 if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u))return {external:true,url:u};
 const match=u.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);let p=match[1];try{p=decodeURIComponent(p);}catch{}
 const target=p?path.resolve(path.dirname(file),p):file;return {target,query:match[2]||'',fragment:match[3]||''};
}
function convertURL(file,u,image=false){const o=resolveLink(file,u);if(o.external)return u;
 if(!fs.existsSync(o.target)){(image?stat.missing_images:stat.missing_links).push({file:path.relative(root,file),url:u});return null;}
 let target=!image&&linkMapping.has(o.target)?linkMapping.get(o.target):o.target;
 if(!image&&fs.existsSync(target)&&fs.statSync(target).isDirectory()&&fs.existsSync(path.join(target,'index.html')))target=path.join(target,'index.html');
 if(o.fragment&&parsed.has(o.target)){
  let id=o.fragment.slice(1);try{id=decodeURIComponent(id);}catch{}
  if(!parsed.get(o.target).headings.some(h=>h.id===id)&&!parsed.get(o.target).anchors.includes(id))stat.fragment_errors.push({file:path.relative(root,file),url:u});
 }
 if(o.target===file&&o.fragment)return o.fragment;
 return relative(mapping.get(file)||file,target)+o.query+o.fragment;
}
function processTokens(tokens,file){for(let i=0;i<tokens.length;i++){const t=tokens[i];
 if(t.type==='image'){const u=convertURL(file,t.attrGet('src'),true);if(u)t.attrSet('src',u);t.attrSet('loading','lazy');t.attrSet('decoding','async');}
 if(t.type==='link_open'){const u=convertURL(file,t.attrGet('href'));if(u===null){t.tag='span';t.attrs=[['class','missing-link'],['title','本地文件缺失，详见报告']];let depth=1;for(let j=i+1;j<tokens.length;j++){if(tokens[j].type==='link_open')depth++;if(tokens[j].type==='link_close'&&!--depth){tokens[j].tag='span';break;}}}else t.attrSet('href',u);}
 if(t.children)processTokens(t.children,file);
}}
function toc(headings){const base={level:0,children:[]},stack=[base];for(const h of headings){while(stack.length>1&&stack.at(-1).level>=h.level)stack.pop();const node={...h,children:[]};stack.at(-1).children.push(node);stack.push(node);}
 const render=arr=>'<ul>'+arr.map(h=>'<li><a href="#'+encodeURIComponent(h.id)+'">'+esc(h.label)+'</a>'+(h.children.length?render(h.children):'')+'</li>').join('')+'</ul>';
 return render(base.children).replace('<ul>','<ul class="toc">');
}
for(const file of files){activeFile=file;mathCount=0;const out=mapping.get(file),data=parsed.get(file);processTokens(data.tokens,file);
 let body=md.renderer.render(data.tokens,md.options,{}).replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
 // Old local MD navigation remains in MD; the web reader has one body return link.
 body=body.replace(/<p>([\s\S]*?)<\/p>/g,(full,inner)=>{
  const navLinks=[...inner.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
  const rest=inner.replace(/<a href="[^"]+">[^<]*<\/a>/g,'').replace(/[\s·|｜]/g,'');
  return !rest&&navLinks.some(m=>/^(?:返回.*(?:索引|目录)|总索引|板块索引)$/.test(m[2]))?'':full;
 });
 const returnLink=fs.existsSync(path.join(root,entryName))?'<a class="return-index" href="'+relative(out,path.join(root,entryName))+'">返回总索引</a>':'';
 const headingMatch=body.match(/^\s*(<h1\b[^>]*>[\s\S]*?<\/h1>)/);
 const heading=headingMatch?headingMatch[1]:'<h1>'+esc(data.title)+'</h1>';
 if(headingMatch)body=body.slice(headingMatch[0].length);
 const readerHeader='<header class="reader-heading">'+heading+returnLink+'</header>';
 const page=`<!doctype html>\n${marker}\n<html lang="${file.endsWith('.original.md')?'en':'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="md-source-sha256" content="${before.get(file)}"><title>${esc(data.title)}</title><style>${fs.readFileSync(path.join(asset,'reader.css'),'utf8')}</style><link rel="stylesheet" href="${relative(out,path.join(asset,'katex.min.css'))}"></head><body id="reader-top"><button class="toc-toggle" type="button" aria-controls="reader-toc" aria-expanded="false" aria-label="展开目录">目录 →</button><aside id="reader-toc" class="toc-panel" aria-label="目录" inert><div class="toc-title">目录</div><nav aria-label="文稿目录">${toc(data.headings)}</nav></aside><div class="layout"><article>${readerHeader}${body}<a class="back-top" href="#reader-top">返回顶部 ↑</a></article></div><script src="${relative(out,path.join(asset,'reader.js'))}" defer></script></body></html>`;
 fs.writeFileSync(out,page);stat.documents.push({source:path.relative(root,file),html:path.relative(root,out),sha256:before.get(file),headings:data.headings.length,images:(body.match(/<img /g)||[]).length,math:mathCount});
}
// Normalize generated leaf-based indexes without changing document bodies.
if(opt.indexes)for(const file of all.filter(f=>path.basename(f)==='index.html')){
 const orig=fs.readFileSync(file,'utf8');let updated=orig;
 if(!opt.originals)updated=updated.replace(/<li>\s*<a\b[^>]*href="[^"]*\.original\.(?:html|md)(?:[?#][^"]*)?"[^>]*>[\s\S]*?<\/a>\s*<\/li>/g,'');
 updated=updated.replace(/href="([^"]+)"/g,(full,u)=>{const o=resolveLink(file,u.replace(/&amp;/g,'&'));if(!o.external&&linkMapping.has(o.target))return 'href="'+esc(relative(file,linkMapping.get(o.target))+o.query+o.fragment)+'"';return full;});
 updated=updated.replace(/(<a\b[^>]*href="[^"]+\.(?:pdf|docx?|pptx?)(?:[?#][^"]*)?"[^>]*>)(?:原件|Word 模板|PDF 原件)(<\/a>)/gi,'$1原文稿$2');
 updated=updated.replace(/(<li><a\b[^>]*>原文稿<\/a><\/li>)(<li><a\b[^>]*>中文稿<\/a><\/li>)/g,'$2$1');
 if(/class="tree"/.test(updated)){
  updated=updated.replace(/<div class="tree-controls"[^>]*>[\s\S]*?<\/div>/g,'');
  updated=updated.replace(/\.tree-controls[^{}]*\{[^}]*\}/g,'');
  const template=fs.readFileSync(path.join(__dirname,'..','assets','navigation-template.html'),'utf8');
  const actions=template.match(/<div class="index-actions"[^>]*>[\s\S]*?<\/div>/)[0];
  if(updated.includes('class="index-actions"'))updated=updated.replace(/<div class="index-actions"[^>]*>[\s\S]*?<\/div>/g,()=>actions);
  else if(/<button\b[^>]*data-tree-toggle/.test(updated))updated=updated.replace(/<button\b[^>]*data-tree-toggle[^>]*>[\s\S]*?<\/button>/g,()=>actions);
  else updated=updated.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/,heading=>'<div class="index-heading">'+heading+actions+'</div>');
  const controlStyle=template.match(/<style id="index-controls-style">[\s\S]*?<\/style>/)[0];
  updated=updated.includes('id="index-controls-style"')?updated.replace(/<style id="index-controls-style">[\s\S]*?<\/style>/,()=>controlStyle):updated.replace('</head>',()=>controlStyle+'\n</head>');
  const stateScript='<!-- codex-index-state:start -->\n<script>\n'+fs.readFileSync(path.join(__dirname,'..','assets','navigation.js'),'utf8')+'</script>\n<!-- codex-index-state:end -->';
  const oldState=/<!-- codex-index-state:start -->[\s\S]*?<!-- codex-index-state:end -->/;
  updated=oldState.test(updated)?updated.replace(oldState,()=>stateScript):updated.replace('</body>',()=>stateScript+'\n</body>');
 }
 if(updated!==orig){fs.writeFileSync(file,updated);stat.updated_indexes.push(path.relative(root,file));}
}
for(const [f,hash] of before)if(sourceHash(f)!==hash)throw Error('Source Markdown changed: '+f);
if(opt.manifest){fs.mkdirSync(path.dirname(opt.manifest),{recursive:true});fs.writeFileSync(opt.manifest,JSON.stringify(stat,null,2));}
console.log(JSON.stringify({documents:stat.documents.length,headings:stat.documents.reduce((n,d)=>n+d.headings,0),images:stat.documents.reduce((n,d)=>n+d.images,0),math:stat.documents.reduce((n,d)=>n+d.math,0),math_errors:stat.math_errors.length,missing_links:stat.missing_links,missing_images:stat.missing_images,fragment_errors:stat.fragment_errors,updated_indexes:stat.updated_indexes.length},null,2));
if(stat.math_errors.length||stat.missing_images.length||stat.fragment_errors.length)process.exitCode=1;

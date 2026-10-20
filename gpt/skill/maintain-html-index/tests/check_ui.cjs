'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]),html=fs.readFileSync(path.join(root,'00 - 文件索引.html'),'utf8');
const records=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).files;
const stateKey='course-index:v1:https://preview-test.invalid/index.html',doms=[];
function open(source=html,saved=null,blocked=false){
 const d=new JSDOM(source,{url:'https://preview-test.invalid/index.html',runScripts:'outside-only',pretendToBeVisual:true});doms.push(d);
 d.window.scrollTo=(_,y)=>{Object.defineProperty(d.window,'scrollY',{value:y,configurable:true});};
 if(saved)d.window.localStorage.setItem(stateKey,saved);
 if(blocked)for(const key of ['localStorage','sessionStorage'])Object.defineProperty(d.window,key,{get(){throw Error('storage unavailable');}});
 for(const script of d.window.document.querySelectorAll('script:not([src])'))d.window.eval(script.textContent);
 return d;
}
const tick=()=>new Promise(r=>setTimeout(r,25));
(async()=>{
 const d=open(),w=d.window,doc=w.document,branches=[...doc.querySelectorAll('.tree details')],button=doc.querySelector('[data-tree-toggle]');
 assert(branches.length>1);assert.equal(doc.querySelectorAll('button').length,1);
 assert(!doc.querySelector('aside,iframe,input,select,.cards,.viewer'));
 assert.equal(doc.querySelectorAll('.tree a.leaf').length,records.length);
 assert.deepEqual([...doc.querySelectorAll('.tree a.leaf')].map(a=>a.getAttribute('href')).sort(),records.map(r=>r.preview).sort());
 assert.equal(button.textContent.trim(),'');assert(button.querySelector('svg'));assert.equal(button.type,'button');
 assert.equal(w.getComputedStyle(button).borderTopWidth,'0px');assert.equal(w.getComputedStyle(button).boxShadow,'none');
 await tick();assert.equal(button.getAttribute('aria-label'),'全部展开');button.click();
 assert(branches.every(n=>n.open));assert.equal(button.title,'全部收起');button.click();assert(branches.every(n=>!n.open));
 branches[0].open=true;await tick();assert.equal(button.title,'全部收起');button.click();assert(branches.every(n=>!n.open));
 // Even an expanded descendant hidden inside a collapsed parent counts as open.
 const nested=branches.find(n=>n.parentElement.closest('details'));assert(nested);nested.open=true;await tick();
 assert.equal(button.title,'全部收起');button.click();assert(branches.every(n=>!n.open));assert.equal(button.title,'全部展开');
 branches[1].open=true;w.scrollTo(0,315);w.dispatchEvent(new w.Event('pagehide'));
 const restored=open(html,w.localStorage.getItem(stateKey));await tick();
 assert.deepEqual([...restored.window.document.querySelectorAll('.tree details')].map(n=>n.open),branches.map(n=>n.open));
 assert.equal(restored.window.scrollY,315);assert.equal(restored.window.document.querySelector('[data-tree-toggle]').title,'全部收起');
 const blocked=open(html,null,true);blocked.window.document.querySelector('[data-tree-toggle]').click();assert([...blocked.window.document.querySelectorAll('details')].every(n=>n.open));
 const empty=open(html.replace(/<ul class="tree"[\s\S]*?<\/main>/,'<ul class="tree"></ul></main>'));assert(empty.window.document.querySelector('[data-tree-toggle]').disabled);
 // Folder names are real standalone navigation targets; their arrows stay native summaries.
 const directoryRecords=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).directories;
 assert.equal(doc.querySelectorAll('.folder-link').length,directoryRecords.length);
 for(const dir of directoryRecords){
  const file=path.join(root,decodeURIComponent(dir.preview)),fd=new JSDOM(fs.readFileSync(file,'utf8'));doms.push(fd);
  const page=fd.window.document,parent=dir.path.includes('/')?dir.path.slice(0,dir.path.lastIndexOf('/')):'';
  const expected=parent?path.join(root,decodeURIComponent(directoryRecords.find(x=>x.path===parent).preview)):path.join(root,'00 - 文件索引.html');
  assert.equal(path.resolve(path.dirname(file),decodeURIComponent(page.querySelector('[data-parent]').getAttribute('href'))),expected);
  assert.equal(path.resolve(path.dirname(file),decodeURIComponent(page.querySelector('[data-root]').getAttribute('href'))),path.join(root,'00 - 文件索引.html'));
  assert.equal(page.querySelectorAll('a.leaf').length,records.filter(x=>x.path.startsWith(dir.path+'/')).length);
  for(const link of page.querySelectorAll('a[href]'))assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(link.getAttribute('href')))));
 }
 // Every format enters an independently styled reading page with one return link.
 for(const record of records){
  const content=fs.readFileSync(path.join(root,decodeURIComponent(record.preview)),'utf8'),r=new JSDOM(content,{runScripts:'outside-only'});doms.push(r);
  const rd=r.window.document;assert(rd.querySelector('.layout > article'));assert.equal(rd.querySelectorAll('.return-index').length,1);
  assert(!rd.querySelector('.shell,.directory,.viewer,#preview-frame'));
  assert.equal(r.window.getComputedStyle(rd.querySelector('article')).borderRadius,'0px');
  assert.equal(r.window.getComputedStyle(rd.querySelector('article')).borderTopWidth,'0px');
  assert.equal(r.window.getComputedStyle(rd.querySelector('article')).padding,'0px');
  assert.equal(r.window.getComputedStyle(rd.querySelector('article')).boxShadow,'none');
  assert.equal(r.window.getComputedStyle(rd.querySelector('.layout')).maxWidth,w.getComputedStyle(doc.querySelector('main')).maxWidth);
  assert(rd.querySelector('.reader-heading h1'));
  assert(rd.querySelector('.reader-heading .return-index'));
  assert.equal(r.window.getComputedStyle(rd.querySelector('h1')).fontSize,'21px');
  assert(rd.querySelector('style').textContent.includes('--paper:#fff'));
  if(['doc','docx','odt','rtf','xls','ods'].includes(record.type)&&record.status==='preview'){
   assert(rd.querySelector('figure.page img'));assert(!rd.querySelector('.document-flow,.print-layout'));
  }
  if(record.type==='html')assert.equal(rd.querySelector('iframe').getAttribute('sandbox'),'');
 }
 const md=records.find(x=>x.path.endsWith('说明.md'));const rd=open(fs.readFileSync(path.join(root,decodeURIComponent(md.preview)),'utf8')),rdoc=rd.window.document;
 rd.window.eval(fs.readFileSync(path.join(root,'.file-index/assets/reader.js'),'utf8'));
 assert(!rdoc.body.classList.contains('toc-open'));assert(rdoc.querySelector('.toc-panel').hasAttribute('inert'));
 rdoc.querySelector('.toc-toggle').click();assert(rdoc.body.classList.contains('toc-open'));assert(!rdoc.querySelector('.toc-panel').inert);
 rdoc.querySelector('.toc a').click();assert(rdoc.body.classList.contains('toc-open'));
 rdoc.dispatchEvent(new rd.window.KeyboardEvent('keydown',{key:'Escape'}));assert(!rdoc.body.classList.contains('toc-open'));
 assert(rdoc.body.textContent.includes('window.injected'));assert.equal(rd.window.injected,undefined);
 console.log(JSON.stringify({files:records.length,passed:['single-column tree and direct standalone links','icon-only accessible control','all collapsed / all expanded / partial / hidden child','state and scroll restore','storage unavailable','empty tree','all previews use flat layout matching the index width','article TOC closed by default / open / Escape','Markdown script remains text','original HTML sandbox','folder entry and parent/root navigation','Office page previews restored'],scope:'DOM simulation and computed CSS; not real-browser layout or playback'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>doms.forEach(d=>d.window.close()));

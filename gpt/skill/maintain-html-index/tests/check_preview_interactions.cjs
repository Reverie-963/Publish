'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os'),cp=require('child_process');
const root=path.resolve(process.argv[2]),skill=path.resolve(__dirname,'..'),records=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).files;
const doms=[];function parse(html){const d=new JSDOM(html,{url:'https://preview-test.invalid/preview.html',runScripts:'outside-only',pretendToBeVisual:true});doms.push(d);return d;}
const content=r=>fs.readFileSync(path.join(root,decodeURIComponent(r.preview)),'utf8');
try{
 for(const extension of ['c','py','m','json','yaml','txt']){
  const record=records.find(r=>r.type===extension),d=parse(content(record)),code=d.window.document.querySelector('.source-code code');
  assert(code);assert.equal(code.textContent,fs.readFileSync(path.join(root,record.path),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'));
  if(extension!=='txt')assert(code.querySelector('span[class^="hljs-"]'));else assert(!code.querySelector('span'));
 }
 const highlighter=require('../scripts/highlight_code.cjs');const snippet='const text = "<script>window.bad = 1</script>";\n';const safe=parse('<pre><code>'+highlighter.highlight(snippet,'javascript')+'</code></pre>');assert.equal(safe.window.document.querySelector('code').textContent,snippet);assert(!safe.window.document.querySelector('script'));
 const matlab='function y = f(x)\n% comment\ny = x .* 2; label = "value";\nend\n';
 assert.equal(highlighter.language('sample.m'),'matlab');assert.equal(highlighter.language('sample.M'),'matlab');assert.equal(highlighter.language('m'),'matlab');
 const mat=parse('<pre><code>'+highlighter.highlight(matlab,'m')+'</code></pre>');assert.equal(mat.window.document.querySelector('code').textContent,matlab);
 for(const token of ['keyword','comment','number','string'])assert(mat.window.document.querySelector('.hljs-'+token),'MATLAB '+token+' is colored');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'highlight-markdown-'));
 try{
  const source=path.join(tmp,'test.md');fs.writeFileSync(source,'# Code\n\n```python\nprint("hello")\n```\n');
  const parsed=JSON.parse(cp.execFileSync(process.execPath,[path.join(skill,'scripts/render_markdown.cjs')],{input:JSON.stringify({source,output:path.join(tmp,'preview.html'),mapping:{}}),encoding:'utf8'}));
  const md=parse(parsed.body);assert.equal(md.window.document.querySelector('code').textContent,'print("hello")\n');assert(md.window.document.querySelector('code span'));
 }finally{fs.rmSync(tmp,{recursive:true});}
 const js=fs.readFileSync(path.join(skill,'assets/page-zoom.js'),'utf8');
 function setup(html, prior, blocked=false){
  const d=parse(html),w=d.window;
  Object.defineProperty(w,'innerWidth',{value:1000,configurable:true});Object.defineProperty(w,'innerHeight',{value:800});
  w.scrollTo=(x,y)=>{Object.defineProperty(w,'scrollY',{value:y,configurable:true});};
  const source=w.document.querySelector('script[src$="page-zoom.js"]');assert(source,'all generated pages include page zoom');
  const key='file-index:page-scale:v1:'+new URL('.',source.src).href;
  if(prior)w.localStorage.setItem(key,String(prior));
  if(blocked)for(const name of ['localStorage','sessionStorage'])Object.defineProperty(w,name,{get(){throw Error('blocked');}});
  w.eval(js);return {d,w,doc:w.document,key};
 }
 const cases=[fs.readFileSync(path.join(root,'00 - 文件索引.html'),'utf8'),content(records.find(r=>r.type==='pdf')),content(records.find(r=>r.type==='py')),fs.readFileSync(path.join(root,decodeURIComponent(JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).directories[0].preview)),'utf8')];
 for(const html of cases){
  const {w,doc,key}=setup(html),reset=doc.querySelector('.page-scale');
  assert(!doc.querySelector('.page-scale-menu,.page-zoom-panel'));assert.deepEqual([...reset.parentElement.children].map(n=>n.dataset.scaleAction||'reset'),['out','reset','in']);if(doc.querySelector('.tree')){assert(doc.querySelector('.index-layout > .index-sidebar > .index-actions'));assert(!doc.querySelector('header .index-actions'));assert(doc.querySelector('.index-layout > main .tree'));}if(doc.querySelector('.layout')){assert(doc.querySelector('html > .page-zoom-floating'));assert(!doc.querySelector('.reader-sidebar .page-zoom'));assert(!doc.querySelector('.reader-heading .page-zoom'));}assert(!doc.querySelector('dialog,script[src$="image-zoom.js"]'));
  const act=name=>doc.querySelector('[data-scale-action="'+name+'"]').click();
  act('in');assert.equal(doc.body.style.zoom,'1.1');assert.equal(w.localStorage.getItem(key),'1.1');assert.equal(reset.textContent,'110%');w.localStorage.setItem(key,'1.25');w.dispatchEvent(new w.Event('pageshow'));assert.equal(doc.body.style.zoom,'1.25');
  reset.click();assert.equal(doc.body.style.zoom,'1');assert(!doc.querySelector('.page-zoom-panel'),'one click resets without a menu');assert.equal(reset.textContent,'100%');
  reset.click();assert.equal(doc.body.style.zoom,'1');act('out');assert.equal(doc.body.style.zoom,'0.9');
  function keypress(key,opts={}){const e=new w.KeyboardEvent('keydown',{key,metaKey:true,bubbles:true,cancelable:true,...opts});doc.dispatchEvent(e);return e;}
  assert(keypress('=').defaultPrevented);assert.equal(doc.body.style.zoom,'1');assert(keypress('+',{metaKey:false,ctrlKey:true}).defaultPrevented);assert.equal(doc.body.style.zoom,'1.1');
  assert(keypress('0').defaultPrevented);assert.equal(doc.body.style.zoom,'1');assert(!keypress('x').defaultPrevented);
  const nativeWheel=new w.WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true});doc.dispatchEvent(nativeWheel);assert(!nativeWheel.defaultPrevented);
  const beforeCommandWheel=doc.body.style.zoom;
  for(const ctrlKey of [false,true]){const commandWheel=new w.WheelEvent('wheel',{deltaY:-10,metaKey:true,ctrlKey,bubbles:true,cancelable:true});doc.dispatchEvent(commandWheel);assert(!commandWheel.defaultPrevented);assert.equal(doc.body.style.zoom,beforeCommandWheel);}
  const pinch=new w.WheelEvent('wheel',{deltaY:-10,ctrlKey:true,clientX:200,clientY:150,bubbles:true,cancelable:true});doc.dispatchEvent(pinch);assert(pinch.defaultPrevented);assert(Number(doc.body.style.zoom)>1);
  const input=doc.createElement('textarea');doc.body.append(input);const edit=new w.KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true});input.dispatchEvent(edit);assert(!edit.defaultPrevented);
  for(let i=0;i<30;i++)act('in');assert.equal(doc.body.style.zoom,'3');assert(doc.querySelector('[data-scale-action="in"]').disabled);
  for(let i=0;i<30;i++)act('out');assert.equal(doc.body.style.zoom,'0.5');assert(doc.querySelector('[data-scale-action="out"]').disabled);
  const portrait=setup(html,.99);Object.defineProperty(portrait.w,'innerWidth',{value:600,configurable:true});portrait.w.dispatchEvent(new portrait.w.Event('resize'));
  const side=portrait.doc.querySelector('.reader-sidebar,.index-sidebar'),bar=side.querySelector('.toc-toolbar,.index-actions');
  assert.equal(portrait.w.getComputedStyle(side).top,'0px','portrait sticky strip has no top gap');assert.equal(portrait.w.getComputedStyle(side).backgroundColor,portrait.w.getComputedStyle(portrait.doc.body).backgroundColor);
  assert.equal(portrait.w.getComputedStyle(bar).flexWrap,'nowrap');if(bar.querySelector('.page-zoom'))assert.equal(portrait.w.getComputedStyle(bar.querySelector('.page-zoom')).flexBasis,'auto');else assert.equal(portrait.w.getComputedStyle(portrait.doc.querySelector('.page-zoom-floating')).position,'fixed');
  // App zoom cancels at the rail only, on every surface and after restoration.
  for(const scale of [.5,.99,1,1.5,2.9,3]){
   const fixed=setup(html,scale),rail=fixed.doc.querySelector('.reader-sidebar,.index-sidebar');
   assert(rail);assert(Math.abs((Number(fixed.doc.body.style.zoom)||1)*Number(rail.style.zoom)-1)<1e-9,'navigation retains 100% effective scale');
   assert.equal(fixed.doc.body.style.getPropertyValue('--content-scale'),String(scale));
   assert(Math.abs(Number(fixed.doc.body.style.getPropertyValue('--ui-scale'))*scale-1)<1e-9);
   assert.equal(fixed.doc.querySelector('.page-scale').textContent,Math.round(scale*100)+'%');
   fixed.doc.querySelector('.page-scale').click();assert.equal(rail.style.zoom,'1');
  }
  const restored=setup(html,1.5);assert.equal(restored.doc.body.style.zoom,'1.5');assert(!restored.doc.querySelector('.page-zoom-panel'));
  const noStorage=setup(html,null,true);noStorage.doc.querySelector('[data-scale-action="in"]').click();assert.equal(noStorage.doc.body.style.zoom,'1.1');
 }
 const anchored=setup(cases[2]);anchored.w.scrollTo(0,500);
 const code=anchored.doc.querySelector('pre');anchored.doc.elementFromPoint=()=>code;
 code.getBoundingClientRect=()=>({top:600*(Number(anchored.doc.body.style.zoom)||1)-anchored.w.scrollY});
 anchored.doc.querySelector('[data-scale-action="in"]').click();assert(Math.abs(anchored.w.scrollY-590)<.01,'maintains the content point at viewport center');
 const flat=setup(cases[2]);const style=flat.w.getComputedStyle(flat.doc.querySelector('pre'));assert.equal(style.backgroundColor,'rgba(0, 0, 0, 0)');assert.equal(parseFloat(style.borderRadius),0);assert.equal(style.boxShadow,'none');
 console.log(JSON.stringify({passed:['code colors preserve source text','Markdown code highlighting and escaping','code block has no background, border or shadow','left horizontal controls on root, nested indexes and readers','portrait and 99% zoom have zero sticky offset','content scale with fixed-size navigation at 50/99/100/150/290/300 percent','direct minus / one-click percentage reset / plus controls','keyboard shortcuts, reset and bounds','Ctrl-wheel scale, Command-wheel and ordinary wheel unchanged','editable fields preserved','scale restoration and blocked storage fallback','viewport content anchor retained','no image-only viewer'],scope:'DOM simulation; real-browser layout and gesture testing not performed'},null,2));
}finally{doms.forEach(d=>d.window.close());}

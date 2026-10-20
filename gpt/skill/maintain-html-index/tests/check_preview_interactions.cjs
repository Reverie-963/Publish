'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert'),os=require('os'),cp=require('child_process');
const root=path.resolve(process.argv[2]),skill=path.resolve(__dirname,'..'),records=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).files;
const doms=[];function parse(html){const d=new JSDOM(html,{url:'https://preview-test.invalid/preview.html',runScripts:'outside-only'});doms.push(d);return d;}
const content=r=>fs.readFileSync(path.join(root,decodeURIComponent(r.preview)),'utf8');
try{
 for(const extension of ['c','py','json','yaml','txt']){
  const record=records.find(r=>r.type===extension),d=parse(content(record)),code=d.window.document.querySelector('.source-code code');
  assert(code);assert.equal(code.textContent,fs.readFileSync(path.join(root,record.path),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'));
  if(extension!=='txt')assert(code.querySelector('span[class^="hljs-"]'));else assert(!code.querySelector('span'));
 }
 const highlighter=require('../scripts/highlight_code.cjs');const snippet='const text = "<script>window.bad = 1</script>";\n';const safe=parse('<pre><code>'+highlighter.highlight(snippet,'javascript')+'</code></pre>');assert.equal(safe.window.document.querySelector('code').textContent,snippet);assert(!safe.window.document.querySelector('script'));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'highlight-markdown-'));
 try{
  const source=path.join(tmp,'test.md');fs.writeFileSync(source,'# Code\n\n```python\nprint("hello")\n```\n');
  const parsed=JSON.parse(cp.execFileSync(process.execPath,[path.join(skill,'scripts/render_markdown.cjs')],{input:JSON.stringify({source,output:path.join(tmp,'preview.html'),mapping:{}}),encoding:'utf8'}));
  const md=parse(parsed.body);assert.equal(md.window.document.querySelector('code').textContent,'print("hello")\n');assert(md.window.document.querySelector('code span'));
 }finally{fs.rmSync(tmp,{recursive:true});}
 const record=records.find(r=>r.type==='pdf'),d=parse(content(record)),w=d.window,doc=w.document,source=doc.querySelector('figure img');
 Object.defineProperties(source,{naturalWidth:{value:1800},naturalHeight:{value:1200}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.eval(fs.readFileSync(path.join(root,'.file-index/assets/image-zoom.js'),'utf8'));
 const dialog=doc.querySelector('.image-zoom'),stage=doc.querySelector('.zoom-stage'),image=doc.querySelector('.zoom-image');
 Object.defineProperties(stage,{clientWidth:{value:900,configurable:true},clientHeight:{value:600,configurable:true}});stage.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});
 assert(dialog&&!dialog.open);assert.equal(source.tabIndex,0);assert.equal(source.getAttribute('role'),'button');assert(!doc.querySelector('.reader-heading .zoom-toolbar'));
 source.focus();source.click();assert(dialog.open);assert.equal(doc.body.style.overflow,'hidden');assert(parseFloat(image.style.width)<=900&&parseFloat(image.style.height)<=600);
 const action=name=>dialog.querySelector('[data-zoom="'+name+'"]').click();
 action('actual');assert.equal(image.style.width,'1800px');assert(stage.classList.contains('can-pan'));
 const before={left:stage.scrollLeft,top:stage.scrollTop};action('in');assert.equal(image.style.width,'2250px');
 assert(Math.abs((before.left+450)-((stage.scrollLeft+450)/1.25))<.01,'zoom retains viewed horizontal point');
 assert(Math.abs((before.top+300)-((stage.scrollTop+300)/1.25))<.01,'zoom retains viewed vertical point');
 const wheel=new w.WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true});stage.dispatchEvent(wheel);assert(!wheel.defaultPrevented,'ordinary scrolling is native');
 const magnify=new w.WheelEvent('wheel',{deltaY:-10,ctrlKey:true,clientX:200,clientY:150,bubbles:true,cancelable:true});stage.dispatchEvent(magnify);assert(magnify.defaultPrevented);assert(parseFloat(image.style.width)>2250);
 const browserZoom=new w.KeyboardEvent('keydown',{key:'+',metaKey:true,bubbles:true,cancelable:true});dialog.dispatchEvent(browserZoom);assert(!browserZoom.defaultPrevented);
 function pointer(type,x,y){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerType:{value:'mouse'},pointerId:{value:1}});stage.dispatchEvent(e);}
 const start=stage.scrollLeft;pointer('pointerdown',400,200);pointer('pointermove',350,180);assert.equal(stage.scrollLeft,start+50);pointer('pointerup',350,180);assert(!stage.classList.contains('dragging'));
 action('fit');assert(parseFloat(image.style.width)<=900);assert.equal(stage.scrollLeft,0);assert.equal(stage.scrollTop,0);
 for(let i=0;i<30;i++)action('in');assert(dialog.querySelector('[data-zoom="in"]').disabled);for(let i=0;i<80;i++)action('out');assert(dialog.querySelector('[data-zoom="out"]').disabled);
 dialog.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!dialog.open);assert.equal(doc.body.style.overflow,'');assert.equal(doc.activeElement,source);
 source.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert(dialog.open);action('close');
 const plain=parse(content(records.find(r=>r.type==='txt')));plain.window.eval(fs.readFileSync(path.join(root,'.file-index/assets/image-zoom.js'),'utf8'));assert(!plain.window.document.querySelector('dialog'));
 console.log(JSON.stringify({passed:['C/Python/JSON/YAML syntax colors with unchanged text','plain text remains plain','escaped code and Markdown fenced highlighting','viewer hidden until image activation','fit and original size','zoom maintains viewed point','ordinary scrolling and browser shortcuts preserved','drag panning','zoom bounds','Escape and focus restoration','no viewer on text-only pages'],scope:'DOM simulation; real-browser appearance and gesture testing not performed'},null,2));
}finally{doms.forEach(d=>d.window.close());}

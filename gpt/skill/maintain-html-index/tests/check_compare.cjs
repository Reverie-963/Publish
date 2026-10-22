// Offline DOM integration, not a browser file-origin or visual rendering test.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]),asset=path.join(root,'.file-index/assets');
const read=n=>fs.readFileSync(path.join(asset,n),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json')));
const records=manifest.files.filter(r=>!r.external&&r.status==='preview');assert(records.length>=3);
const doc=records.find(r=>r.type==='md'&&r.path.includes('/')),other=records.find(r=>r.type==='doc'),third=records.find(r=>r.type==='pdf');
const urlFor=relative=>new URL(relative,'file://'+root+'/').href;
function load(relative,query='',store){
 const d=new JSDOM(fs.readFileSync(path.join(root,decodeURIComponent(relative)),'utf8'),{url:urlFor(relative)+query,runScripts:'outside-only',pretendToBeVisual:true});d.window.scrollTo=()=>{};
 if(store)Object.defineProperty(d.window,'localStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
 d.window.eval(read('file-catalog.js'));return d;
}
(async()=>{
 const preferences=new Map(),reader=load(doc.preview,'',preferences);reader.reconfigure({windowTop:{}});reader.window.eval(read('reader.js'));reader.window.eval(read('page-zoom.js'));reader.window.__navigations=[];reader.window.__navigate=url=>reader.window.__navigations.push(url);reader.window.eval(read('compare.js').replaceAll('location.assign(', 'window.__navigate('));
 const rd=reader.window.document,quick=rd.querySelector('.quick-toggle'),outline=rd.querySelector('.toc-toggle'),tree=rd.querySelector('.quick-panel');
 assert(quick&&outline&&tree.hidden);assert(!rd.querySelector('.quick-actions').hidden);assert.equal(quick.parentElement.firstElementChild,quick);
 assert.deepEqual([...quick.parentElement.children].filter(e=>!e.classList.contains('toc-label')).map(e=>e.className),['quick-toggle','toc-toggle','quick-actions']);
 outline.click();assert.equal(outline.getAttribute('aria-expanded'),'true');quick.click();assert(!tree.hidden);assert.equal(outline.getAttribute('aria-expanded'),'false');
 assert.equal(tree.querySelectorAll('a').length,manifest.files.filter(r=>!r.external).length);assert.equal(tree.querySelector('[aria-current="page"]').dataset.fileId,doc.id);assert(tree.querySelector('details summary'));
 const locate=rd.querySelector('.quick-locate'),expand=rd.querySelector('.quick-expand'),current=tree.querySelector('[aria-current="page"]');
 assert.equal(locate.getAttribute('aria-pressed'),'true');assert(current.closest('details').open);
 expand.click();assert([...tree.querySelectorAll('details')].every(d=>!d.open));assert.equal(expand.title,'全部展开');
 expand.click();assert([...tree.querySelectorAll('details')].every(d=>d.open));assert.equal(expand.title,'全部收起');
 // Auto reveal opens only the current path, on entry; it never fights manual collapse.
 expand.click();locate.click();quick.click();quick.click();assert(!current.closest('details').open);
 locate.click();assert(current.closest('details').open);assert.equal(locate.getAttribute('aria-pressed'),'true');
 assert([...tree.querySelectorAll('details')].filter(d=>d.open).every(d=>d.contains(current)));
 await new Promise(r=>reader.window.requestAnimationFrame(r));let listScroll=0;Object.defineProperty(tree,'scrollTop',{get:()=>listScroll,set:v=>listScroll=v,configurable:true});
 tree.getBoundingClientRect=()=>({top:80,bottom:280});current.getBoundingClientRect=()=>({top:430,bottom:450});
 locate.click();locate.click();await new Promise(r=>reader.window.requestAnimationFrame(r));assert.equal(listScroll,170,'reveal scrolls the tree only');
 outline.click();assert(tree.hidden);assert(!rd.querySelector('.quick-actions').hidden);assert.equal(outline.getAttribute('aria-expanded'),'true');quick.click();
 tree.dispatchEvent(new reader.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(tree.hidden);assert.equal(rd.activeElement,quick);
 // Drag targets appear only during a file drag; malformed drops never navigate.
 quick.click();const file=tree.querySelector('a[data-file-id="'+other.id+'"]'),data={};
 const transfer={types:['application/x-file-index-preview'],setData:(k,v)=>data[k]=v,getData:k=>data[k]||''};
 function drag(type,target,dt=transfer){const e=new reader.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:dt});target.dispatchEvent(e);return e;}
 drag('dragstart',file);await new Promise(r=>reader.window.requestAnimationFrame(r));const zones=rd.querySelector('.quick-drop-zones');assert(!zones.hidden);assert.equal(JSON.parse(data[transfer.types[0]]).id,other.id);
 assert(drag('dragover',zones.firstElementChild).defaultPrevented);assert(zones.firstElementChild.classList.contains('is-over'));
 assert(!drag('drop',zones.firstElementChild,{...transfer,getData:()=>'{"catalog":"other","id":"invalid"}'}).defaultPrevented);assert(zones.hidden);
 for(const side of ['left','right']){
  drag('dragstart',file);await new Promise(r=>reader.window.requestAnimationFrame(r));assert(drag('drop',zones.querySelector('[data-side="'+side+'"]')).defaultPrevented);
  const destination=new URL(reader.window.__navigations.at(-1)),params=new URLSearchParams(destination.hash.slice(1));
  assert(destination.pathname.endsWith('/.file-index/compare.html'));assert.equal(params.get(side),other.id);assert.equal(params.get(side==='left'?'right':'left'),doc.id);
 }
 drag('dragstart',file);await new Promise(r=>reader.window.requestAnimationFrame(r));drag('dragend',file);assert(zones.hidden);
 // Pointer dragging works even when native file-link dragging is suppressed.
 const pointer=(type,target,x,y=200,extra={})=>{const e=new reader.window.MouseEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true,button:0,...extra});Object.defineProperties(e,{pointerId:{value:7},pointerType:{value:'mouse'}});target.dispatchEvent(e);return e;};
 for(const side of ['left','right']){
  const count=reader.window.__navigations.length,x=side==='left'?300:reader.window.innerWidth-20;
  pointer('pointerdown',file,20);pointer('pointermove',rd,23);assert(zones.hidden,'small click motion does not begin dragging');
  assert(drag('dragstart',file).defaultPrevented,'pointer path suppresses native file drag');
  pointer('pointermove',rd,x);assert(!zones.hidden);assert.equal(zones.style.pointerEvents,'none');assert(zones.querySelector('[data-side="'+side+'"]').classList.contains('is-over'));
  pointer('pointerup',rd,x);assert(zones.hidden);assert.equal(reader.window.__navigations.length,count+1);
  const params=new URLSearchParams(new URL(reader.window.__navigations.at(-1)).hash.slice(1));assert.equal(params.get(side),other.id);
  const click=new reader.window.MouseEvent('click',{bubbles:true,cancelable:true});file.dispatchEvent(click);assert(click.defaultPrevented,'drag release does not also open the source link');
 }
 const count=reader.window.__navigations.length;pointer('pointerdown',file,20);pointer('pointermove',rd,700);pointer('pointercancel',rd,700);assert(zones.hidden);assert.equal(reader.window.__navigations.length,count);
 pointer('pointerdown',file,20);pointer('pointermove',rd,700);rd.dispatchEvent(new reader.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(zones.hidden);assert.equal(reader.window.__navigations.length,count);
 if(tree.hidden)quick.click();
 locate.click();if([...tree.querySelectorAll('details')].some(d=>d.open))expand.click();await new Promise(r=>reader.window.setTimeout(r,20));
 reader.window.close();
 const restored=load(doc.preview,'',preferences);restored.window.eval(read('reader.js'));restored.window.eval(read('page-zoom.js'));restored.window.eval(read('compare.js'));
 const restoredDoc=restored.window.document;assert.equal(restoredDoc.querySelector('.quick-locate').getAttribute('aria-pressed'),'false');
 assert(!restoredDoc.querySelector('.quick-panel').hidden);assert([...restoredDoc.querySelectorAll('.quick-panel details')].every(d=>!d.open));
 restoredDoc.querySelector('.quick-locate').click();assert(restoredDoc.querySelector('.quick-panel [aria-current="page"]').closest('details').open);restored.window.close();
 const pane=load(doc.preview,'?compare-pane=1');pane.window.eval(read('reader.js'));pane.window.eval(read('page-zoom.js'));pane.window.eval(read('compare.js'));assert(pane.window.document.body.classList.contains('is-compare-pane'));assert(!pane.window.document.querySelector('.quick-drop-zones'));pane.window.close();
 const pair=load('.file-index/compare.html','#left='+doc.id+'&right='+other.id);pair.window.__navigations=[];pair.window.__navigate=url=>pair.window.__navigations.push(url);pair.window.eval(read('compare.js').replaceAll('location.assign(', 'window.__navigate('));
 const d=pair.window.document,frames=[...d.querySelectorAll('iframe')],names=[...d.querySelectorAll('.compare-file')];assert(!d.querySelector('select'));
 assert.equal(frames[0].src,urlFor(doc.preview)+'?compare-pane=1');assert.equal(frames[1].src,urlFor(other.preview)+'?compare-pane=1');assert(!d.querySelector('.compare-top'));assert(!d.querySelector('#compare-return'));
 // Frame identity plus current catalog ID gate the offline bridge.
 const message=(source,data)=>pair.window.dispatchEvent(new pair.window.MessageEvent('message',{source,data}));
 const channel='file-index:compare:v1';
 message(pair.window,{channel,type:'exit',id:doc.id});assert.equal(pair.window.__navigations.length,0);
 message(pair.window,{channel,type:'ready',id:doc.id});assert(!frames[0].parentElement.classList.contains('reader-ready'));
 message(frames[0].contentWindow,{channel,type:'ready',id:other.id});assert(!frames[0].parentElement.classList.contains('reader-ready'));
 message(frames[0].contentWindow,{channel,type:'ready',id:doc.id});assert(frames[0].parentElement.classList.contains('reader-ready'));
 for(const [i,file] of [[0,doc],[1,other]]){
  message(frames[i].contentWindow,{channel,type:'exit',id:file.id});assert.equal(pair.window.__navigations.at(-1),urlFor(file.preview));
  message(frames[i].contentWindow,{channel,type:'index',id:file.id});assert.equal(pair.window.__navigations.at(-1),new URL(d.querySelector('.compare-shell').dataset.index,pair.window.location.href).href);
 }
 message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:doc.id});assert.equal(frames[1].dataset.fileId,other.id,'cannot select the peer file');
 message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:'outside'});assert.equal(frames[1].dataset.fileId,other.id);
 const left=frames[0].getAttribute('src');message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:third.id});await new Promise(r=>setTimeout(r,20));
 assert.equal(frames[1].src,urlFor(third.preview)+'?compare-pane=1');assert.equal(frames[0].getAttribute('src'),left,'changing right preserves left frame');
 pair.window.location.hash='left=../../outside&right=https://untrusted.invalid';await new Promise(r=>setTimeout(r,20));
 assert(frames.every(f=>f.src.startsWith(urlFor('.file-index/previews/'))));assert.notEqual(frames[0].src,frames[1].src);
 // A reader hosts its own real outline/zoom controls beside its plain file name.
 const child=load(doc.preview,'?compare-pane=1'),sent=[],parent={postMessage:data=>sent.push(data)};
 Object.defineProperty(child.window,'parent',{value:parent});
 child.window.eval(read('reader.js'));child.window.eval(read('page-zoom.js'));child.window.eval(read('compare.js'));
 const toolbar=child.window.document.querySelector('.toc-toolbar'),choice=toolbar.querySelector('.compare-inline-file');assert(choice);
 assert(child.window.document.documentElement.querySelector(':scope > .page-zoom-floating'));assert(toolbar.querySelector('.toc-toggle'));
 assert.equal(choice.tagName,'SPAN');assert.equal(choice.textContent,doc.path.split('/').pop());assert(!toolbar.querySelector('select')); assert(sent.some(m=>m.type==='ready'&&m.id===doc.id));
 assert.equal(child.window.getComputedStyle(child.window.document.querySelector('.reader-heading')).display,'block');
 toolbar.querySelector('.compare-exit').click();assert.equal(sent.at(-1).type,'exit');assert.equal(sent.at(-1).id,doc.id);
 child.window.document.querySelector('.return-index').click();assert.equal(sent.at(-1).type,'index');
 const bodyLink=child.window.document.createElement('a');bodyLink.href=urlFor(third.preview);child.window.document.querySelector('article').append(bodyLink);bodyLink.click();assert.equal(sent.at(-1).type,'select');assert.equal(sent.at(-1).next,third.id);bodyLink.remove();
 child.window.dispatchEvent(new child.window.MessageEvent('message',{source:parent,data:{channel,type:'peer',id:other.id}}));
 assert(sent.at(-1).type==='ready');
 const layout=child.window.document.querySelector('.layout'),side=child.window.document.querySelector('.reader-sidebar');
 assert.equal(child.window.getComputedStyle(layout).paddingTop,'0px');assert.equal(side.style.top,'0px');
 const quickChild=toolbar.querySelector('.quick-toggle');assert(quickChild);quickChild.click();
 const childFile=child.window.document.querySelector('.quick-panel a[data-file-id="'+third.id+'"]');childFile.click();assert.equal(sent.at(-1).type,'select');assert.equal(sent.at(-1).next,third.id);
 childFile.dispatchEvent(new child.window.KeyboardEvent('keydown',{key:'Enter',altKey:true,bubbles:true,cancelable:true}));assert.equal(sent.at(-1).type,'place');assert.equal(sent.at(-1).side,'left');
 const reset=child.window.document.querySelector('.page-scale');reset.click();assert.equal(reset.textContent,'100%');
 child.window.close();
 pair.window.close();
 console.log('PASS: offline catalog, file tree and sidebar modes, independent file selection, valid return link, drag targets and keyboard placement, invalid IDs confined to catalog, unified pinned toolbar and validated frame messages (DOM simulation).');
})().catch(e=>{console.error(e);process.exitCode=1;});

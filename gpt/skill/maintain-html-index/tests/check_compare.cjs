// Offline DOM integration, not a browser file-origin or visual rendering test.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]),asset=path.join(root,'.file-index/assets');
const read=n=>fs.readFileSync(path.join(asset,n),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json')));
const records=manifest.files.filter(r=>!r.external&&r.status==='preview');assert(records.length>=3);
const doc=records.find(r=>r.type==='md'),other=records.find(r=>r.type==='doc'),third=records.find(r=>r.type==='pdf');
const urlFor=relative=>new URL(relative,'file://'+root+'/').href;
function load(relative,query=''){
 const d=new JSDOM(fs.readFileSync(path.join(root,decodeURIComponent(relative)),'utf8'),{url:urlFor(relative)+query,runScripts:'outside-only',pretendToBeVisual:true});d.window.scrollTo=()=>{};
 d.window.eval(read('file-catalog.js'));return d;
}
(async()=>{
 const reader=load(doc.preview);reader.window.eval(read('reader.js'));reader.window.eval(read('page-zoom.js'));reader.window.eval(read('compare.js'));
 const control=reader.window.document.querySelector('.compare-control');assert(control);assert(control.querySelector('.compare-picker').hidden);control.querySelector('button').click();assert(!control.querySelector('.compare-picker').hidden);
 assert(![...control.querySelectorAll('option')].some(o=>o.value===doc.id));
 control.querySelector('select').dispatchEvent(new reader.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(control.querySelector('.compare-picker').hidden);reader.window.close();
 const pane=load(doc.preview,'?compare-pane=1');pane.window.eval(read('reader.js'));pane.window.eval(read('page-zoom.js'));pane.window.eval(read('compare.js'));assert(pane.window.document.body.classList.contains('is-compare-pane'));assert(!pane.window.document.querySelector('.compare-control'));pane.window.close();
 const pair=load('.file-index/compare.html','#left='+doc.id+'&right='+other.id);pair.window.eval(read('compare.js'));
 const d=pair.window.document,frames=[...d.querySelectorAll('iframe')],selects=[...d.querySelectorAll('.compare-file')];
 assert.equal(frames[0].src,urlFor(doc.preview)+'?compare-pane=1');assert.equal(frames[1].src,urlFor(other.preview)+'?compare-pane=1');assert.equal(d.querySelector('#compare-return').href,urlFor(doc.preview));
 // Frame identity plus current catalog ID gate the offline bridge.
 const message=(source,data)=>pair.window.dispatchEvent(new pair.window.MessageEvent('message',{source,data}));
 const channel='file-index:compare:v1';
 message(pair.window,{channel,type:'ready',id:doc.id});assert(!frames[0].parentElement.classList.contains('reader-ready'));
 message(frames[0].contentWindow,{channel,type:'ready',id:other.id});assert(!frames[0].parentElement.classList.contains('reader-ready'));
 message(frames[0].contentWindow,{channel,type:'ready',id:doc.id});assert(frames[0].parentElement.classList.contains('reader-ready'));
 message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:doc.id});assert.equal(selects[1].value,other.id,'cannot select the peer file');
 message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:'outside'});assert.equal(selects[1].value,other.id);
 const left=frames[0].getAttribute('src');message(frames[1].contentWindow,{channel,type:'select',id:other.id,next:third.id});await new Promise(r=>setTimeout(r,20));
 assert.equal(frames[1].src,urlFor(third.preview)+'?compare-pane=1');assert.equal(frames[0].getAttribute('src'),left,'changing right preserves left frame');
 pair.window.location.hash='left=../../outside&right=https://untrusted.invalid';await new Promise(r=>setTimeout(r,20));
 assert(frames.every(f=>f.src.startsWith(urlFor('.file-index/previews/'))));assert.notEqual(frames[0].src,frames[1].src);
 // A reader hosts its own real outline/zoom controls beside its file select.
 const child=load(doc.preview,'?compare-pane=1'),sent=[],parent={postMessage:data=>sent.push(data)};
 Object.defineProperty(child.window,'parent',{value:parent});
 child.window.eval(read('reader.js'));child.window.eval(read('page-zoom.js'));child.window.eval(read('compare.js'));
 const toolbar=child.window.document.querySelector('.toc-toolbar'),choice=toolbar.querySelector('.compare-inline-file');assert(choice);
 assert(toolbar.querySelector('.page-zoom'));assert(toolbar.querySelector('.toc-toggle'));
 assert.equal(choice.value,doc.id);assert(sent.some(m=>m.type==='ready'&&m.id===doc.id));
 child.window.dispatchEvent(new child.window.MessageEvent('message',{source:parent,data:{channel,type:'peer',id:other.id}}));
 assert([...choice.options].find(o=>o.value===other.id).disabled);
 choice.value=third.id;choice.dispatchEvent(new child.window.Event('change'));assert.equal(sent.at(-1).next,third.id);
 const layout=child.window.document.querySelector('.layout'),side=child.window.document.querySelector('.reader-sidebar');
 assert.equal(child.window.getComputedStyle(layout).paddingTop,'0px');assert.equal(side.style.top,'0px');
 const reset=toolbar.querySelector('.page-scale');reset.click();assert.equal(reset.textContent,'100%');
 child.window.close();
 pair.window.close();
 console.log('PASS: offline catalog, quiet picker, independent file selection, valid return link, no nested comparison, invalid IDs confined to catalog, unified pinned toolbar and validated frame messages (DOM simulation).');
})().catch(e=>{console.error(e);process.exitCode=1;});

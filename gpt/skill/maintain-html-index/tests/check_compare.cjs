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
 const left=frames[0].getAttribute('src');selects[1].value=third.id;selects[1].dispatchEvent(new pair.window.Event('change'));await new Promise(r=>setTimeout(r,20));
 assert.equal(frames[1].src,urlFor(third.preview)+'?compare-pane=1');assert.equal(frames[0].getAttribute('src'),left,'changing right preserves left frame');
 pair.window.location.hash='left=../../outside&right=https://untrusted.invalid';await new Promise(r=>setTimeout(r,20));
 assert(frames.every(f=>f.src.startsWith(urlFor('.file-index/previews/'))));assert.notEqual(frames[0].src,frames[1].src);
 pair.window.close();
 console.log('PASS: offline catalog, quiet picker, independent file selection, valid return link, no nested comparison, invalid IDs confined to catalog (DOM simulation).');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Control/message behavior only; browser layout and dragging require visual QA.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]),assets=path.join(root,'.file-index/assets'),store=new Map(),channel='file-index:compare:v1';
function open(hash='',blocked=false){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'.file-index/compare.html'),'utf8'),{url:'https://index.invalid/.file-index/compare.html'+hash,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 Object.defineProperty(w,'localStorage',{get(){if(blocked)throw Error('blocked');return {getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};}});
 w.eval(fs.readFileSync(path.join(assets,'file-catalog.js'),'utf8'));w.eval(fs.readFileSync(path.join(assets,'compare.js'),'utf8'));
 const frames=[...d.querySelectorAll('iframe')],messages=[];frames.forEach((f,i)=>{f.contentWindow.postMessage=data=>messages.push({i,...data});});
 const send=(i,patch,source=frames[i].contentWindow)=>w.dispatchEvent(new w.MessageEvent('message',{source,data:{channel,id:frames[i].dataset.fileId,...patch}}));
 const pointer=(type,target,x)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,button:0});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);};
 return {w,d,dom,frames,messages,send,pointer};
}
const tick=()=>new Promise(r=>setTimeout(r,40));
(async()=>{
 let p=open(),{w,d,frames,messages,send,pointer}=p;const handle=d.querySelector('.compare-handle'),ids=frames.map(f=>f.dataset.fileId);
 frames.forEach((f,i)=>send(i,{type:'ready',position:{y:0,ratio:0,width:600}}));messages.length=0;
 send(0,{type:'scroll',y:400,ratio:.4,width:600,cause:'user'});assert.equal(messages.length,0,'independent by default');send(1,{type:'toggle-sync'});assert.equal(messages.at(-1).type,'sync-scroll');assert.equal(messages.at(-1).i,1);
 send(0,{type:'toggle-sync'});assert(messages.filter(m=>m.type==='sync-state').slice(-2).every(m=>m.show&&!m.enabled),'left control disables both');send(0,{type:'toggle-sync'});assert(messages.filter(m=>m.type==='sync-state').slice(-2).every(m=>m.show&&m.enabled),'left control enables both');
 const count=messages.length;send(1,{type:'scroll',y:800,ratio:.4,width:600,cause:'sync'});assert.equal(messages.length,count,'no feedback loop');send(1,{type:'scroll',y:1000,ratio:.5,width:600,cause:'user'});assert.equal(messages.at(-1).i,0,'reverse direction works');
 const sources=frames.map(f=>f.src),windows=frames.map(f=>f.contentWindow);handle.click();await tick();assert.deepEqual(frames.map(f=>f.src),sources,'swap keeps frames loaded');assert(frames.every((f,i)=>f.contentWindow===windows[i]));assert.equal(new URLSearchParams(w.location.hash.slice(1)).get('left'),ids[1]);assert.equal(frames[1].parentElement.style.order,'0');
 d.querySelector('.compare-panes').getBoundingClientRect=()=>({width:1000,height:800});const beforeHash=w.location.hash;
 pointer('pointerdown',handle,500);pointer('pointermove',d,650);pointer('pointerup',d,650);handle.click();assert.equal(w.location.hash,beforeHash,'drag never swaps');assert(Math.abs(parseFloat(d.querySelector('.compare-panes').style.getPropertyValue('--left-size'))-.65)<.001);
 handle.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert(Math.abs(parseFloat(d.querySelector('.compare-panes').style.getPropertyValue('--left-size'))-.67)<.001);
 pointer('pointerdown',handle,500);pointer('pointermove',d,700);pointer('pointercancel',d,700);assert(Math.abs(parseFloat(d.querySelector('.compare-panes').style.getPropertyValue('--left-size'))-.67)<.001,'cancel restores ratio');
 w.dispatchEvent(new w.Event('pagehide'));const hash=w.location.hash;p.dom.window.close();p=open(hash);assert(!p.d.querySelector('.compare-sync'),'no outer control taking reading space');assert(Math.abs(parseFloat(p.d.querySelector('.compare-panes').style.getPropertyValue('--left-size'))-.67)<.001);p.send(0,{type:'ready'});assert.equal(p.messages[0].type,'restore-position');assert.equal(p.messages[0].position.y,1000,'saved position follows swapped file');assert(p.messages.some(m=>m.type==='sync-state'&&m.i===1&&m.show&&m.enabled),'right pane gets the visible enabled control');assert(p.messages.some(m=>m.type==='sync-state'&&m.i===0&&m.show&&m.enabled),'left pane gets the same visible enabled control');
 p.dom.window.close();p=open('',true);p.send(1,{type:'toggle-sync'});p.d.querySelector('.compare-handle').click();await tick();p.dom.window.close();
 console.log('PASS: bidirectional sync without echo, swap without reload, drag/cancel/keyboard resize, refresh state and blocked storage.');
})().catch(e=>{console.error(e);process.exit(1);});

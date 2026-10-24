// DOM lifecycle checks; actual file:// layout must also be checked in a browser.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert'),path=require('path');
const script=fs.readFileSync(path.join(__dirname,'../assets/reading-position.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,45));
function open(store,{name='',hash='',navigation='navigate',blocked=false}={}){
 const dom=new JSDOM('<body><article><h1 id="section">Heading</h1></article></body>',{url:'https://index.invalid/doc.html'+(name?'?compare-pane=1':'')+hash,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let y=0,height=3000;w.name=name;
 Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w,'innerHeight',{value:600});Object.defineProperty(w.document.documentElement,'scrollHeight',{get:()=>height});
 for(const kind of ['localStorage','sessionStorage'])Object.defineProperty(w,kind,{get(){if(blocked)throw Error('blocked');return {getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};}});
 w.scrollTo=(value)=>{y=Math.min(height-600,value.top);w.dispatchEvent(new w.Event('scroll'));};
 w.performance.getEntriesByType=()=>[{type:navigation}];w.eval(script);
 return {w,dom,setHeight:v=>height=v,user:v=>{w.dispatchEvent(new w.Event('wheel'));w.scrollTo({top:v});}};
}
(async()=>{
 const store=new Map();let page=open(store);page.user(850);await tick();page.w.dispatchEvent(new page.w.Event('pagehide'));page.dom.window.close();
 page=open(store);await tick();assert.equal(page.w.scrollY,850,'reload restores exact position');
 page.setHeight(900);page.w.dispatchEvent(new page.w.Event('load'));assert.equal(page.w.scrollY,300);page.setHeight(3000);page.w.dispatchEvent(new page.w.Event('load'));assert.equal(page.w.scrollY,850,'late layout gets another restoration attempt');
 page.user(120);await tick();page.w.dispatchEvent(new page.w.Event('load'));assert.equal(page.w.scrollY,120,'user scrolling cancels late restore');page.dom.window.close();
 const left=open(store,{name:'left'}),right=open(store,{name:'right'});left.user(400);right.user(1100);await tick();for(const p of [left,right]){p.w.dispatchEvent(new p.w.Event('pagehide'));p.dom.window.close();}
 for(const [name,y] of [['left',400],['right',1100]]){const p=open(store,{name});await tick();assert.equal(p.w.scrollY,y,'same document panes keep independent positions');p.dom.window.close();}
 page=open(store,{hash:'#section'});await tick();assert.equal(page.w.scrollY,0,'new explicit section wins');page.dom.window.close();
 page=open(store,{hash:'#section',navigation:'reload'});await tick();assert.equal(page.w.scrollY,850,'reload with a fragment restores last position');page.dom.window.close();
 page=open(store,{blocked:true});page.user(120);await tick();page.w.FileIndexPosition.apply({x:0,y:0,ratio:.5,width:1024});assert.equal(page.w.scrollY,1200);page.dom.window.close();
 console.log('PASS: scroll memory, delayed layout, user interruption, independent frame keys, fragments and blocked storage.');
})().catch(e=>{console.error(e);process.exit(1);});

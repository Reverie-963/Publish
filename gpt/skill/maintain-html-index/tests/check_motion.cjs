'use strict';
// Geometry and animation lifecycle simulation, not a browser rendering test.
const {JSDOM}=require('jsdom'),assert=require('assert'),fs=require('fs'),path=require('path');
const asset=name=>fs.readFileSync(path.join(__dirname,'../assets',name),'utf8');
function setup(html,{reduced=false,scale=1,width=1400}={}){
 const dom=new JSDOM(html,{url:'https://motion.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 Object.defineProperty(w,'innerWidth',{value:width,writable:true});d.body.style.zoom=String(scale);
 w.scrollTo=(_,y)=>Object.defineProperty(w,'scrollY',{value:y,configurable:true});
 const listeners=[],preference={matches:reduced,addEventListener:(type,fn)=>listeners.push(fn)};
 w.matchMedia=()=>preference;
 const calls=[];
 w.Element.prototype.animate=function(frames,options){
  const node=this,animation={node,frames,options,cancelled:false,cancel(){this.cancelled=true;if(node._motion===this)node._motion=null;},finish(){if(node._motion===this)node._motion=null;this.onfinish?.();}};
  node._motion=animation;calls.push(animation);return animation;
 };
 const rect=(left=0,top=0,height=0)=>({left,top,height,bottom:top+height,right:left+800,width:800});
 w.Element.prototype.getBoundingClientRect=function(){
  const opened=d.body.classList.contains('toc-open'),compact=w.innerWidth/scale<820;
  if(this.tagName==='ARTICLE'){
   const delta=this._motion?.frames[0].transform?.match(/translate\(([-.\d]+)px,([-.\d]+)px\)/);
   return rect(300*scale+(delta?Number(delta[1])*scale/2:0),(40+(opened&&compact?140:0))*scale+(delta?Number(delta[2])*scale/2:0));
  }
  if(this.classList.contains('reader-sidebar'))return rect(200*scale,40*scale);
  if(this.tagName==='DETAILS'){
   if(this.parentElement.closest('details:not([open])'))return rect();
   return rect(0,0,this._motion?(parseFloat(this._motion.frames[0].height)+parseFloat(this._motion.frames[1].height))/2*scale:(this.open?300:40)*scale);
  }
  return rect(0,100);
 };
 return {dom,w,d,calls,reduce(){preference.matches=true;listeners.forEach(fn=>fn());}};
}
const reader='<div class="layout"><article><h2 id="a">A</h2><h2 id="b">B</h2></article></div><button class="toc-toggle"></button><nav id="outline" class="toc-panel"><a href="#a">A</a><a href="#b">B</a></nav>';
for(const scale of [1,1.5]){
 const t=setup('<style>'+asset('reader.css')+asset('page-zoom.css')+'</style>'+reader,{scale,width:1600});t.w.eval(asset('reader.js'));
 assert.equal(t.calls.length,0,'restore must not animate');
 const toggle=t.d.querySelector('button'),layout=t.d.querySelector('.layout');layout.classList.add('has-reader-tools');
 const geometry=()=>{const s=t.w.getComputedStyle(layout);return [s.gridTemplateColumns,s.maxWidth,s.gap];};
 const closed=geometry();toggle.click();assert.deepEqual(geometry(),closed,'opening keeps rail and article geometry');
 assert(t.calls.length===1&&t.calls[0].node.classList.contains('toc-panel'),'wide outline only fades in');
 const first=t.calls[0];assert.equal(first.options.duration,200);assert.equal(toggle.getAttribute('aria-expanded'),'true');
 toggle.click();assert(first.cancelled);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.deepEqual(geometry(),closed);
 toggle.click();const next=t.calls.at(-1);t.d.dispatchEvent(new t.w.Event('page-scalechange'));assert(next.cancelled);
 toggle.click();toggle.click();const active=t.calls.at(-1);t.reduce();assert(active.cancelled);const count=t.calls.length;toggle.click();assert.equal(t.calls.length,count);
 t.dom.window.close();
}
{
 const t=setup(reader,{width:600});t.w.eval(asset('reader.js'));const toggle=t.d.querySelector('button');toggle.click();
 assert(t.calls.some(a=>a.node.tagName==='ARTICLE'&&a.frames[0].transform==='translate(0px,-140px)'));
 toggle.click();assert(t.calls.some(a=>a.node.tagName==='ARTICLE'&&a.frames[0].transform==='translate(0px,70px)'),'compact reversal starts at visible position');
 for(const a of t.calls)a.finish();assert.equal(t.d.querySelector('article').style.transform,'','no persistent positioning styles');t.dom.window.close();
}
const tree='<button data-tree-toggle></button><ul class="tree"><li><details><summary>Folder <a href="#folder">Enter</a></summary><ul><li><details><summary>Nested</summary><p>File</p></details></li></ul></details></li><li><details><summary>Other</summary><p>File</p></details></li></ul>';
{
 const t=setup(tree,{scale:1.5});t.w.eval(asset('navigation.js'));
 const branches=[...t.d.querySelectorAll('details')],button=t.d.querySelector('button');button.click();
 assert(branches.every(n=>n.open));assert.equal(t.calls.length,2,'only outer branches animate');
 assert.equal(t.calls[0].frames[0].height,'40px');assert.equal(t.calls[0].frames[1].height,'300px');
 button.click();assert(branches.every(n=>!n.open));assert(t.calls[0].cancelled);assert.equal(t.calls[2].frames[0].height,'170px');
 branches[0].querySelector('summary').click();assert(branches[0].open);assert.equal(button.title,'全部收起');
 branches[1].querySelector('summary').click();assert(branches[1].open,'nested summary toggles only nested node');
 const count=t.calls.length;t.d.querySelector('a').click();assert.equal(t.calls.length,count);assert(branches[0].open,'folder navigation does not toggle');
 t.reduce();assert(t.calls.at(-1).cancelled);button.click();assert(branches.every(n=>!n.open));assert.equal(t.calls.length,count);
 t.dom.window.close();
}
{
 const t=setup(tree,{reduced:true});t.w.eval(asset('navigation.js'));t.d.querySelector('button').click();assert.equal(t.calls.length,0);assert([...t.d.querySelectorAll('details')].every(n=>n.open));t.dom.window.close();
}
const template=asset('navigation-template.html');assert(template.includes('<script>\n'+asset('navigation.js')+'</script>'));
assert(asset('scrollbar.css').includes('scrollbar-gutter:stable'));
assert(asset('page-zoom.css').includes('@media(prefers-reduced-motion:reduce)'));
console.log('PASS: fixed wide outline geometry, compact motion, interruption, compact layout, zoom geometry, tree batches/nesting/navigation, reduced motion, template parity (simulated geometry/WAAPI).');

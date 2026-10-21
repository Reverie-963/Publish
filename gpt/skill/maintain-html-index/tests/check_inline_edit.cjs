'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const script=fs.readFileSync(path.join(__dirname,'../assets/inline-edit.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
function open(kind='md'){
 const config={id:'test',workspace:'testroot',kind,revision:'r0',endpoint:'/_edit',writeKey:'key',blocks:{a:{start:0,end:5,text:'Alpha'},b:{start:7,end:11,text:'Beta'}}};
 const d=new JSDOM('<a class="return-index">返回</a><div data-edit-block="a"><p>Alpha</p></div><div data-edit-block="b"><p>Beta</p></div><script id="edit-config" type="application/json">'+JSON.stringify(config)+'</script>',{url:'http://127.0.0.1:1234/test',runScripts:'outside-only',pretendToBeVisual:true});
 const calls=[];let revision='r0',fail=false;
 d.window.fetch=async(url,options)=>{const q=JSON.parse(options.body);calls.push(q);await tick();if(fail||q.revision!==revision)return {ok:false,json:async()=>({error:'原文件已经变化'})};revision='r'+calls.length;return {ok:true,json:async()=>({revision,text:q.text,delta:q.text.length-q.old.length,end:q.start+q.text.length,fragment:'<p>'+q.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>'})};};
 d.window.eval(script);return {d,calls,fail:()=>{fail=true;}};
}
async function input(d,node,text){node.textContent=text;node.dispatchEvent(new d.window.Event('input',{bubbles:true}));d.window.document.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,65));}
(async()=>{
 const {d,calls}=open();const doc=d.window.document,a=doc.querySelector('[data-edit-block=a]'),b=doc.querySelector('[data-edit-block=b]');
 a.click();await tick();assert.equal(a.getAttribute('contenteditable'),'plaintext-only');assert.equal(doc.querySelectorAll('button').length,0);
 a.dispatchEvent(new d.window.Event('compositionstart',{bubbles:true}));a.textContent='输入中';a.dispatchEvent(new d.window.Event('input',{bubbles:true}));doc.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await tick();assert.equal(calls.length,0);a.dispatchEvent(new d.window.Event('compositionend',{bubbles:true}));
 await input(d,a,'Alpha changed');assert.equal(calls.length,1);assert.equal(calls[0].old,'Alpha');assert.equal(doc.querySelector('.edit-status').textContent,'已保存');
 // Switching paragraphs must need only one click, even with a pending save.
 a.textContent='Latest Alpha';a.dispatchEvent(new d.window.Event('input',{bubbles:true}));b.focus();b.click();await new Promise(r=>setTimeout(r,100));
 assert.equal(b.getAttribute('contenteditable'),'plaintext-only');assert(!a.hasAttribute('contenteditable'));assert.equal(a.textContent,'Latest Alpha');
 await input(d,b,'Beta updated');assert.equal(calls.at(-1).old,'Beta');assert.equal(calls.at(-1).start,14);assert.equal(calls.at(-1).revision,'r2');
 doc.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await tick();assert(!b.hasAttribute('contenteditable'));d.window.close();
 const f=open('word'),node=f.d.window.document.querySelector('[data-edit-block=a]');node.click();await tick();f.fail();await input(f.d,node,'Unsaved text');
 assert.equal(node.textContent,'Unsaved text');assert.equal(node.getAttribute('contenteditable'),'plaintext-only');assert(f.d.window.document.querySelector('.edit-status').textContent.includes('输入已保留'));assert(f.d.window.localStorage.getItem('file-index:draft:testroot:test').includes('Unsaved text'));
 const e=new f.d.window.Event('beforeunload',{cancelable:true});f.d.window.dispatchEvent(e);assert(e.defaultPrevented);f.d.window.close();
 // CRLF metadata does not cause an endless autosave loop after normal browser input.
 const c=open();const cn=c.d.window.document.querySelector('[data-edit-block=a]');cn.click();await tick();await input(c.d,cn,'Line 1\nLine 2');await new Promise(r=>setTimeout(r,80));assert.equal(c.calls.length,1);c.d.window.close();
 // Type again while a request is in flight, then immediately switch blocks.
 const race=open(),rd=race.d.window.document,ra=rd.querySelector('[data-edit-block=a]'),rb=rd.querySelector('[data-edit-block=b]');
 ra.click();await tick();ra.textContent='First change';ra.dispatchEvent(new race.d.window.Event('input',{bubbles:true}));
 rd.dispatchEvent(new race.d.window.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));
 ra.textContent='Latest while saving';ra.dispatchEvent(new race.d.window.Event('input',{bubbles:true}));rb.focus();rb.click();
 await new Promise(r=>setTimeout(r,150));assert.equal(race.calls.length,2);assert.equal(race.calls.at(-1).text,'Latest while saving');assert.equal(ra.textContent,'Latest while saving');assert.equal(rb.getAttribute('contenteditable'),'plaintext-only');race.d.window.close();
 // A lost response retries the same operation before saving subsequent input.
 const lost=open('text'),ld=lost.d.window.document,ln=ld.querySelector('[data-edit-block=a]');let attempts=[];
 lost.d.window.fetch=async(url,options)=>{const q=JSON.parse(options.body);attempts.push(q);await tick();if(attempts.length===1)throw Error('connection lost');return {ok:true,json:async()=>({revision:'r1',text:q.text,delta:q.text.length-q.old.length,end:q.start+q.text.length,fragment:'<pre>'+q.text+'</pre>'})};};
 ln.click();await tick();await input(lost.d,ln,'Saved source');await input(lost.d,ln,'Saved source');assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);assert.equal(ld.querySelector('.edit-status').textContent,'已保存');lost.d.window.close();
 console.log('PASS: button-free direct editing, source-based autosave, one-click paragraph switching, offset updates, Escape, failure/draft retention and unload protection (DOM simulation)');
})().catch(e=>{console.error(e);process.exitCode=1;});

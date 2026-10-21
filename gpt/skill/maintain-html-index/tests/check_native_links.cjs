const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const code=fs.readFileSync(path.join(__dirname,'../assets/native-original.js'),'utf8');
const d=new JSDOM('<a href="./original.docx" data-native-open="reverie-preview://open/'+ 'a'.repeat(64)+'">打开原件</a>',{url:'file:///sample/preview.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
d.window.eval(code);const a=d.window.document.querySelector('a');
function click(options={}){const e=new d.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0,...options});a.dispatchEvent(e);return e.defaultPrevented;}
assert(click());assert.equal(a.getAttribute('href'),'./original.docx');
assert(!click({metaKey:true}));assert(!click({ctrlKey:true}));assert(!click({button:1}));
a.dataset.nativeOpen='javascript:alert(1)';assert(!click());delete a.dataset.nativeOpen;assert(!click());
d.window.close();console.log('PASS: explicit primary click only, validated local protocol, relative original link retained, ordinary and modified clicks preserved (DOM).');

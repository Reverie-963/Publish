'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]),script=fs.readFileSync(path.join(__dirname,'../assets/reader.js'),'utf8');
const records=JSON.parse(fs.readFileSync(path.join(root,'.file-index/manifest.json'))).files;
let count=0;const types=new Set();
function open(html){const dom=new JSDOM(html,{url:'https://test.invalid/preview.html',runScripts:'outside-only',pretendToBeVisual:true});dom.window.scrollTo=()=>{};dom.window.eval(script);return dom;}
for(const record of records){
 const html=fs.readFileSync(path.join(root,decodeURIComponent(record.preview)),'utf8');
 if(!html.includes('<aside class="toc-panel"'))continue;
 const dom=open(html),doc=dom.window.document,toggle=doc.querySelector('.toc-toggle'),panel=doc.querySelector('.toc-panel');
 assert(toggle&&panel);toggle.click();assert(!panel.hidden);
 for(const a of panel.querySelectorAll('a[href^="#"]')){
  const target=doc.getElementById(decodeURIComponent(a.hash.slice(1)));assert(target);
  a.addEventListener('click',e=>e.preventDefault());a.click();assert(!panel.hidden);assert.equal(a.getAttribute('aria-current'),'location');
  if(target.tagName==='DETAILS')assert(target.open,'print-layout entry opens its details');
 }
 count++;types.add(record.type);dom.window.close();
}
for(const type of ['md','doc','docx','odt','rtf','pdf','ppt','pptx','odp','xlsx','xls','ods'])assert(types.has(type),type+' needs outline in this multipage fixture');
// HTML headings target the sandbox frame, retaining one selected item and sidebar state.
const dom=open('<button class="toc-toggle"></button><aside id="reader-toc" class="toc-panel"><nav class="toc"><a href="content.html#one" target="document-content" data-frame="embedded-document">One</a><a href="content.html#two" target="document-content" data-frame="embedded-document">Two</a></nav></aside><div class="layout"><article><iframe id="embedded-document" name="document-content" sandbox="" src="content.html"></iframe></article></div>');
const doc=dom.window.document;doc.querySelector('.toc-toggle').click();const links=[...doc.querySelectorAll('.toc a')];
links[1].addEventListener('click',e=>e.preventDefault());links[1].click();assert.equal(links[1].getAttribute('aria-current'),'location');assert(!links[0].hasAttribute('aria-current'));assert(!doc.querySelector('.toc-panel').hidden);assert.equal(doc.querySelector('iframe').getAttribute('sandbox'),'');dom.window.close();
console.log(JSON.stringify({outlinePreviews:count,types:[...types],passed:'valid anchors, shared sidebar navigation, print-layout expansion, sandbox frame heading targets',scope:'DOM simulation, not browser rendering'},null,2));

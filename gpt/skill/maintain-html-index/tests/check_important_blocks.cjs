'use strict';
const assert=require('assert'),cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const skill=path.resolve(__dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'important-block-test-'));
const sample='# 提示样式测试（虚构内容）\n\n> [!IMPORTANT]\n> **需要你确认**\n>\n> 请从两个互斥方案中选择一个；当前尚未执行。\n>\n> <script>window.bad=true</script>\n\n## 入口\n\n正文仅在这里说明。\n\n> 普通引用保持原样。\n';
try{
 const source=path.join(root,'example.md');fs.writeFileSync(source,sample);
 for(const editable of [false,true]){
  const result=JSON.parse(cp.execFileSync(process.execPath,[path.join(skill,'scripts/render_markdown.cjs')],{input:JSON.stringify({source,output:path.join(root,'preview.html'),mapping:{},editable}),encoding:'utf8'}));
  assert.equal((result.body.match(/class="callout-important"/g)||[]).length,1);assert(!result.body.includes('[!IMPORTANT]'));
  assert(result.body.includes('<strong>需要你确认</strong>'));assert(result.body.includes('&lt;script&gt;window.bad=true&lt;/script&gt;'));assert(!result.body.includes('<script>'));
  assert(result.body.includes('<blockquote>\n<p>普通引用保持原样。'));
  if(editable){const quote=Object.values(result.blocks).find(b=>b.lines[0]===2);assert(quote&&quote.lines[1]===8,'quoted source range retained for source editing');}
 }
 cp.execFileSync(process.execPath,[path.join(skill,'scripts/build_html_readers.cjs'),'--root',root,'--file','example.md'],{stdio:'pipe'});
 const legacy=fs.readFileSync(path.join(root,'example.html'),'utf8');assert(legacy.includes('class="callout-important"'));assert(legacy.includes('#b42318'));assert(legacy.includes('#ffb4ac'));
 assert.equal(fs.readFileSync(source,'utf8'),sample,'formatting never rewrites source');
 console.log('PASS: prominent alerts in both readers, light/dark CSS, ordinary quotes, escaped scripts, editable source ranges and source preservation.');
}finally{fs.rmSync(root,{recursive:true,force:true});}

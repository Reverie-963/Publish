'use strict';
const hljs=require('highlight.js'),path=require('path');
const aliases={'.py':'python','.c':'c','.h':'c','.cpp':'cpp','.m':'matlab','.js':'javascript','.ts':'typescript','.css':'css','.sh':'bash','.tex':'latex','.json':'json','.yaml':'yaml','.yml':'yaml','.xml':'xml','.ini':'ini','.toml':'ini'};
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function language(hint){const name=aliases[path.extname(hint).toLowerCase()]||(hint.toLowerCase()==='m'?'matlab':hint.toLowerCase());return hljs.getLanguage(name)?name:'';}
function highlight(code,hint=''){const lang=language(hint);return lang?hljs.highlight(code,{language:lang,ignoreIllegals:true}).value:escape(code);}
module.exports={highlight,language};
if(require.main===module){const input=JSON.parse(require('fs').readFileSync(0,'utf8'));const lang=language(input.filename||input.language||'');process.stdout.write('<pre class="source-code"><code class="hljs'+(lang?' language-'+escape(lang):'')+'">'+highlight(input.code,lang)+'</code></pre>');}

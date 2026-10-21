const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const source='/token/'+encodeURIComponent('文件 #1.md'),config={id:'one',source,endpoint:'/token/_open',writeKey:'secret'};
 const d=new JSDOM('<a href="'+source+'" target="_blank">打开原件</a><script id="native-config" type="application/json">'+JSON.stringify(config)+'</script>',{url:'http://127.0.0.1:1234/token/preview.html',runScripts:'outside-only'});
 let saved=false,calls=[];
 d.window.fileIndexFinishEditing=async()=>saved;
 d.window.fetch=async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({opened:true})};};
 d.window.eval(fs.readFileSync(path.join(__dirname,'../assets/native-open.js'),'utf8'));
 const link=d.window.document.querySelector('a'),tick=()=>new Promise(r=>setTimeout(r,20));
 assert.equal(link.textContent,'在本机应用打开');assert.equal(d.window.document.querySelectorAll('button').length,0);
 link.click();await tick();assert.equal(calls.length,0);
 saved=true;link.click();await tick();assert.equal(calls.length,1);assert.equal(calls[0].url,config.endpoint);assert.equal(calls[0].headers['X-Edit-Key'],'secret');assert.deepEqual(JSON.parse(calls[0].body),{id:'one'});
 d.window.close();console.log('PASS: existing source link, Unicode path, save-before-open and failure guard (DOM simulation)');
})().catch(e=>{console.error(e);process.exitCode=1;});

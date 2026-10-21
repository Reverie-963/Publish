// Local service only. Never reload while a paragraph, selection or form is in use.
(()=>{
 const node=document.getElementById('sync-config');if(!node)return;
 const config=JSON.parse(node.textContent),key='file-index:sync-scroll:'+location.pathname;
 let timer=null,checking=false,stopped=false;
 try{const y=JSON.parse(sessionStorage.getItem(key));sessionStorage.removeItem(key);if(Number.isFinite(y)&&y>=0)window.addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const old=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';scrollTo(0,y);document.documentElement.style.scrollBehavior=old;})),{once:true});}catch(_){}
 const busy=()=>window.fileIndexEditingBusy?.()||document.activeElement?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||String(window.getSelection?.()||'').length>0||[...document.querySelectorAll('audio,video')].some(media=>!media.paused);
 function note(text){
  let status=document.getElementById('sync-status');
  if(!text){status?.remove();return;}
  if(!status){status=document.createElement('span');status.id='sync-status';status.role='status';status.style.cssText='display:block;font-size:13px;color:var(--muted);margin-top:8px';(document.querySelector('.reader-heading,main header')||document.body).append(status);}
  status.textContent=text;
 }
 async function check(){
  clearTimeout(timer);if(stopped||checking)return;
  checking=true;
  try{
   if(document.visibilityState==='hidden')return;
   const response=await fetch(config.endpoint,{cache:'no-store'});if(!response.ok)throw Error('offline');const state=await response.json();
   if(state.state==='error'){note('自动同步暂未完成，正在重试。');return;}
   note('');
   if(state.state==='ready'&&state.version!==config.version&&!busy()){
    try{sessionStorage.setItem(key,JSON.stringify(scrollY));}catch(_){}
    location.reload();
   }
  }catch(_){note('自动同步服务未连接，当前内容保留。');}
  finally{checking=false;if(!stopped)timer=setTimeout(check,2000);}
 }
 document.addEventListener('visibilitychange',check);
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});
 window.addEventListener('pageshow',()=>{stopped=false;clearTimeout(timer);timer=setTimeout(check,2000);});
 timer=setTimeout(check,2000);
})();

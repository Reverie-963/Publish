// Shared offline scroll memory. Each document and comparison frame owns its state.
(()=>{
 if(window.FileIndexPosition)return;
 const key='file-index:position:v1:'+location.href.split(/[?#]/)[0]+(new URLSearchParams(location.search).get('compare-pane')==='1'?':'+(window.name||'pane'):':single');
 const stores=[];
 for(const name of ['localStorage','sessionStorage'])try{const store=window[name];store.getItem(key);stores.push(store);}catch(_){}
 const valid=s=>s&&Number.isFinite(s.y)&&s.y>=0&&Number.isFinite(s.ratio)&&s.ratio>=0&&s.ratio<=1;
 const read=()=>{for(const store of stores)try{const value=JSON.parse(store.getItem(key));if(valid(value))return value;}catch(_){}return null;};
 const extent=()=>Math.max(0,(document.scrollingElement||document.documentElement).scrollHeight-innerHeight);
 const snapshot=()=>({x:scrollX,y:scrollY,ratio:extent()?Math.min(1,Math.max(0,scrollY/extent())):0,width:innerWidth});
 let pending=null,frame=0,timer=0,expiry=0,expected=null,observer=null;
 try{history.scrollRestoration='manual';}catch(_){}
 function save(){if(pending)return;const state=JSON.stringify(snapshot());for(const store of stores)try{store.setItem(key,state);}catch(_){}}
 function emit(cause){document.dispatchEvent(new CustomEvent('reading-positionchange',{detail:{...snapshot(),cause}}));}
 function apply(state,cause='restore',relative=false){
  if(!valid(state))return;
  const y=Math.min(extent(),Math.max(0,relative||state.width&&state.width!==innerWidth?state.ratio*extent():state.y));
  expected={y,cause};window.scrollTo({left:Number.isFinite(state.x)?state.x:0,top:y,behavior:'instant'});
  emit(cause);
 }
 function stop(){pending=null;clearTimeout(expiry);observer?.disconnect();observer=null;}
 function retry(){if(pending)apply(pending);}
 function restore(state){
  if(!valid(state))return;stop();pending=state;
  requestAnimationFrame(()=>{retry();requestAnimationFrame(retry);});
  if(window.ResizeObserver){observer=new ResizeObserver(retry);observer.observe(document.body);}
  expiry=setTimeout(()=>{retry();stop();save();},4000);
 }
 function changed(){
  frame=0;const cause=expected&&Math.abs(scrollY-expected.y)<2?expected.cause:'user';
  if(cause==='user')stop();
  emit(cause);clearTimeout(timer);timer=setTimeout(save,120);
 }
 window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(changed);},{passive:true});
 const intent=()=>{stop();expected=null;};
 for(const event of ['wheel','touchstart','pointerdown'])window.addEventListener(event,intent,{passive:true});
 document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))intent();});
 document.addEventListener('click',e=>{if(e.target.closest('a[href*="#"]'))intent();});
 window.addEventListener('hashchange',intent);
 window.addEventListener('load',retry);
 const layoutChanged=()=>requestAnimationFrame(()=>{if(pending){retry();return;}expected={y:scrollY,cause:'layout'};emit('layout');save();});
 window.addEventListener('resize',layoutChanged);document.addEventListener('page-scalechange',layoutChanged);
 document.fonts?.ready.then(retry).catch(()=>{});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);if(pending)stop();save();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 window.addEventListener('pageshow',e=>{if(e.persisted){stop();emit('restore');}});
 window.FileIndexPosition={snapshot,restore,save,apply:(state)=>{stop();apply(state,'sync',true);save();}};
 // Explicit section links take precedence over remembered reading positions.
 const navigation=performance.getEntriesByType?.('navigation')[0]?.type;
 if(!location.hash||navigation==='reload'||navigation==='back_forward')restore(read());
})();

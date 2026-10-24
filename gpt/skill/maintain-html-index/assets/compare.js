// Offline comparison: only catalogued generated readers; no server or file fetch.
(()=>{
 const script=document.currentScript?.src||document.querySelector('script[src$="compare.js"]')?.src;if(!script)return;
 const root=new URL('../../',script),compareURL=new URL('../compare.html',script);
 const files=(window.FILE_INDEX_CATALOG||[]).filter(f=>/^\.file-index\/previews\/(?:[a-f0-9]{16}|link-\d+)\/preview\.html$/.test(f.preview));
 const urlFor=f=>new URL(f.preview,root);
 const inPane=new URLSearchParams(location.search).get('compare-pane')==='1';
 const indexId='@index';
 const svg=paths=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
 function documentActions(host){
  const links=document.querySelector('.reader-links');if(!links)return;
  const group=document.createElement('div');group.className='document-actions';
  for(const [selector,label,icon] of [
   ['.return-index','返回总索引','<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>'],
   ['.original-link','打开原件','<path d="M14 3h7v7M21 3l-11 11M10 5H4v15h15v-6"/>']
  ]){const link=links.querySelector(selector);if(!link)continue;link.classList.add('document-action');link.title=label;link.setAttribute('aria-label',label);link.innerHTML=svg(icon);group.append(link);}
  const layout=document.querySelector('.layout');
  if(inPane||!layout){host.append(group);}else{
   layout.append(group);
   const align=()=>{group.style.top=host.parentElement.style.top||'0px';};
   window.addEventListener('resize',align);document.addEventListener('page-scalechange',align);align();
  }
  links.remove();layout?.classList.add('has-document-actions');
 }

 const dragType='application/x-file-index-preview';
 const validId=id=>files.some(f=>f.id===id);
 function dropZones(accept){
  const overlay=document.createElement('div');overlay.className='quick-drop-zones';overlay.hidden=true;
  for(const side of ['left','right']){const zone=document.createElement('div');zone.className='quick-drop-zone';zone.dataset.side=side;zone.textContent=side==='left'?'放到左侧对照':'放到右侧对照';overlay.append(zone);}
  // Outside the zoomed body: drag targets keep their actual viewport positions.
  document.documentElement.append(overlay);
  const hide=()=>{overlay.hidden=true;overlay.style.pointerEvents='';overlay.querySelectorAll('.is-over').forEach(n=>n.classList.remove('is-over'));};
  const read=e=>{try{const value=JSON.parse(e.dataTransfer.getData(dragType));return value.catalog===root.href&&validId(value.id)?value.id:null;}catch(_){return null;}};
  overlay.addEventListener('dragover',e=>{if(!Array.from(e.dataTransfer?.types||[]).includes(dragType))return;e.preventDefault();e.dataTransfer.dropEffect='copy';const zone=e.target.closest('.quick-drop-zone');overlay.querySelectorAll('.quick-drop-zone').forEach(n=>n.classList.toggle('is-over',n===zone));});
  overlay.addEventListener('drop',e=>{const id=read(e),side=e.target.closest('.quick-drop-zone')?.dataset.side;hide();if(!id||!side)return;e.preventDefault();accept(side,id);});
  window.addEventListener('dragend',hide);window.addEventListener('drop',hide);window.addEventListener('blur',hide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  return {show:(pointer=false)=>{overlay.hidden=false;overlay.style.pointerEvents=pointer?'none':'';},hide,mark:x=>{overlay.querySelectorAll('.quick-drop-zone').forEach(n=>n.classList.toggle('is-over',n.dataset.side===(x<innerWidth/2?'left':'right')));}};
 }
 function quickAccess(current,host,actions){
  const sidebar=host.parentElement,outline=sidebar.querySelector('.toc-panel'),outlineToggle=host.querySelector('.toc-toggle');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='quick-toggle';toggle.title='快速访问';toggle.setAttribute('aria-label','快速访问');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','quick-access-panel');
  toggle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7V5.5h6l2 2h9v12h-17Z"/><path d="M3.5 10h17"/></svg>';
  host.prepend(toggle);document.querySelector('.layout')?.classList.add('has-quick-access');
  const panel=document.createElement('nav');panel.id='quick-access-panel';panel.className='quick-panel';panel.hidden=true;panel.inert=true;panel.setAttribute('aria-label','快速访问文件');
  const hint=document.createElement('p');hint.className='quick-hint';hint.textContent='点击切换 · 拖到左右对照';panel.append(hint);sidebar.append(panel);
  const key='file-index:quick-access:v1:'+root.href;
  const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{};}catch(_){return {};}};
  const write=patch=>{try{localStorage.setItem(key,JSON.stringify({...read(),...patch}));}catch(_){}};
  const state=read(),tree=new Map();let autoReveal=state.autoReveal!==false;
  const controls=document.createElement('div');controls.className='quick-actions';
  const locate=document.createElement('button'),expand=document.createElement('button');
  const icon=paths=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  locate.type=expand.type='button';locate.className='quick-locate';expand.className='quick-expand';
  locate.setAttribute('aria-label','自动定位当前文件');locate.setAttribute('aria-pressed',String(autoReveal));
  locate.title='自动定位当前文件';locate.innerHTML=icon('<path d="M4 3h16M4 21h16"/><rect x="4" y="7" width="16" height="10" rx="1.5"/>');
  expand.innerHTML=icon('<path class="quick-chevron-top" d="m7 7 5 4 5-4"/><path class="quick-chevron-bottom" d="m7 17 5-4 5 4"/>');
  controls.append(locate,expand);(outlineToggle||toggle).after(controls);
  function syncExpand(){const branches=[...panel.querySelectorAll('details')],any=branches.some(d=>d.open);expand.disabled=!branches.length;expand.dataset.action=any?'collapse':'expand';expand.title=any?'全部收起':'全部展开';expand.setAttribute('aria-label',expand.title);}
  let revision=0;
  const motions=new Map(),preference=window.matchMedia?.('(prefers-reduced-motion: reduce)'),article=document.querySelector('.layout > article');
  const canAnimate=()=>!preference?.matches&&typeof panel.animate==='function';
  function stopMotion(){revision++;for(const a of motions.values())a.cancel();motions.clear();}
  function glide(node,frames){const a=node.animate(frames,{duration:200,easing:'cubic-bezier(.2,.7,.2,1)'});motions.set(node,a);a.onfinish=()=>{if(motions.get(node)===a)motions.delete(node);};}
  function articlePosition(){return canAnimate()?article?.getBoundingClientRect():null;}
  function settleArticle(before){if(!before||!article||!canAnimate())return;const after=article.getBoundingClientRect(),scale=Number(document.body.style.zoom)||1,dy=(before.top-after.top)/scale;if(Math.abs(dy)>.5)glide(article,[{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}]);}
  function changeBranches(nodes,show){
   const outer=nodes.filter(n=>!nodes.some(p=>p!==n&&p.contains(n))),scale=(Number(document.body.style.zoom)||1)*(Number(sidebar.style.zoom)||1);
   const previous=canAnimate()&&!panel.hidden?outer.map(n=>[n,n.getBoundingClientRect().height/scale]):[];
   for(const [n,a] of motions)if(n.tagName==='DETAILS'){a.cancel();motions.delete(n);}for(const n of nodes)n.open=show;syncExpand();
   for(const [n,height] of previous){const next=n.getBoundingClientRect().height/scale;if(Math.abs(next-height)>.5)glide(n,[{height:height+'px',overflow:'clip',boxSizing:'border-box'},{height:next+'px',overflow:'clip',boxSizing:'border-box'}]);}
  }
  preference?.addEventListener?.('change',stopMotion);window.addEventListener('resize',stopMotion);document.addEventListener('page-scalechange',stopMotion);window.addEventListener('pagehide',stopMotion);
  function reveal(){
   const link=panel.querySelector('[aria-current="page"]');if(!link)return;
   for(let node=link.parentElement;node&&node!==panel;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
   syncExpand();
   requestAnimationFrame(()=>{if(panel.hidden)return;const item=link.getBoundingClientRect(),box=panel.getBoundingClientRect();
    // Scroll this list only, never the document or its containing frame.
    if(item.top<box.top)panel.scrollTop+=item.top-box.top;
    else if(item.bottom>box.bottom)panel.scrollTop+=item.bottom-box.bottom;
   });
  }
  locate.addEventListener('click',()=>{autoReveal=!autoReveal;locate.setAttribute('aria-pressed',String(autoReveal));write({autoReveal});if(autoReveal){if(panel.hidden)open(true);else reveal();}});
  expand.addEventListener('click',()=>{if(panel.hidden)open(true,true,false);const branches=[...panel.querySelectorAll('details')];changeBranches(branches,!branches.some(d=>d.open));});
  for(const file of files){const parts=file.label.split('/'),name=parts.pop();let branch=tree;for(const part of parts){if(!branch.has(part))branch.set(part,{children:new Map()});const item=branch.get(part);if(!item.children)item.children=new Map();branch=item.children;}branch.set(name,{...branch.get(name),file});}
  let pointer=null,suppressClick=false,nativeFrame=0;
  for(const type of ['dragend','drop','blur','pagehide'])window.addEventListener(type,()=>cancelAnimationFrame(nativeFrame));
  function finishPointer(cancel=false,event){
   if(!pointer)return;const p=pointer;pointer=null;
   if(p.active){suppressClick=true;actions.dragEnd();if(p.link.hasPointerCapture?.(p.id))p.link.releasePointerCapture(p.id);
    if(!cancel&&event&&event.clientX>=0&&event.clientX<=innerWidth&&event.clientY>=0&&event.clientY<=innerHeight)actions.pointerDrop(event.clientX,p.file.id);
   }
  }
  if(actions.pointerDrop){
   panel.addEventListener('pointerdown',e=>{suppressClick=false;if(e.button!==0||e.pointerType==='touch'||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;const link=e.target.closest('a[data-file-id]'),file=files.find(f=>f.id===link?.dataset.fileId);if(file)pointer={id:e.pointerId,link,file,x:e.clientX,y:e.clientY,active:false};});
   document.addEventListener('pointermove',e=>{if(!pointer||e.pointerId!==pointer.id)return;if(!pointer.active){if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<6)return;pointer.active=true;try{pointer.link.setPointerCapture(e.pointerId);}catch(_){}actions.dragStart(pointer.file.id,true);}
    e.preventDefault();actions.pointerMove(e.clientX);
   },{passive:false});
   document.addEventListener('pointerup',e=>{if(pointer?.id===e.pointerId)finishPointer(false,e);});
   document.addEventListener('pointercancel',()=>finishPointer(true));
   panel.addEventListener('lostpointercapture',()=>finishPointer(true));
   panel.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
   window.addEventListener('blur',()=>finishPointer(true));window.addEventListener('pagehide',()=>finishPointer(true));
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pointer){e.preventDefault();finishPointer(true);}});
  }
  function render(branch,prefix=''){
   const ul=document.createElement('ul');
   for(const [name,item] of branch){const li=document.createElement('li');ul.append(li);const path=prefix+name;
    if(item.children){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=name;details.dataset.path=path;details.open=state.folders?.[path]??(autoReveal&&current.label.startsWith(path+'/'));details.append(summary,render(item.children,path+'/'));li.append(details);
     summary.addEventListener('click',e=>{e.preventDefault();changeBranches([details],!details.open);});
     details.addEventListener('toggle',()=>{const folders={...read().folders,[path]:details.open};write({folders});syncExpand();});
    }
    if(item.file){const file=item.file,a=document.createElement('a');a.href=urlFor(file).href;a.textContent=name;a.draggable=true;a.dataset.fileId=file.id;a.title=file.label+' · Shift+Enter 右侧对照 · Alt+Enter 左侧对照';if(file.id===current.id)a.setAttribute('aria-current','page');li.append(a);
     a.addEventListener('click',e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(actions.switchFile){e.preventDefault();actions.switchFile(file.id);}});
     a.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.shiftKey||e.altKey)){e.preventDefault();actions.compare(e.altKey?'left':'right',file.id);}});
     a.addEventListener('dragstart',e=>{if(pointer){e.preventDefault();return;}if(!e.dataTransfer)return;e.dataTransfer.setData(dragType,JSON.stringify({catalog:root.href,id:file.id}));e.dataTransfer.setData('text/plain',file.label);e.dataTransfer.effectAllowed='copy';cancelAnimationFrame(nativeFrame);nativeFrame=requestAnimationFrame(()=>actions.dragStart(file.id));});
     a.addEventListener('dragend',()=>{cancelAnimationFrame(nativeFrame);actions.dragEnd();});
    }
   }
   return ul;
  }
  panel.append(render(tree));syncExpand();
  function open(show,remember=true,auto=true,animate=remember){
   revision++;const changed=panel.hidden===show,before=animate&&changed?articlePosition():null;stopMotion();
   if(show&&outlineToggle?.getAttribute('aria-expanded')==='true')outlineToggle.click();
   panel.hidden=!show;panel.inert=!show;document.body.classList.toggle('quick-open',show);toggle.setAttribute('aria-expanded',String(show));
   if(remember)write({mode:show?'quick':'closed'});
   if(show&&auto&&autoReveal)reveal();
   if(animate&&changed&&canAnimate()){settleArticle(before);if(show)glide(panel,[{opacity:0},{opacity:1}]);}
  }
  toggle.addEventListener('click',()=>open(panel.hidden));
  outlineToggle?.addEventListener('click',event=>{
   const wasQuick=!panel.hidden,before=wasQuick?articlePosition():null;
   if(wasQuick)event.quickSidebarTransition=true;
   open(false,false);write({mode:outlineToggle.getAttribute('aria-expanded')==='true'?'closed':'outline'});
   const pending=revision;if(wasQuick)queueMicrotask(()=>{if(pending!==revision)return;settleArticle(before);if(!outline.hidden&&canAnimate())glide(outline,[{opacity:0},{opacity:1}]);});
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();open(false);toggle.focus({preventScroll:true});}});
  function fit(){const scale=Number(document.body.style.zoom)||1,compact=inPane||innerWidth/scale<1100;panel.style.maxHeight=Math.max(100,innerHeight*(compact ? .36 : 1)-(compact?0:110))+'px';}
  window.addEventListener('resize',fit);document.addEventListener('page-scalechange',fit);fit();
  if(!inPane&&state.mode==='quick')open(true,false);
  window.addEventListener('pageshow',()=>{if(!inPane&&read().mode==='quick')open(true,false);});
 }
 // Keep the real controls and file name in one sticky row inside each reader.
 // Messages only carry catalog IDs; file:// origins cannot share DOM access.
 const channel='file-index:compare:v1';
 if(inPane){
  document.body.classList.add('is-compare-pane');
  const isIndex=!!document.querySelector('.tree'),current=isIndex?{id:indexId,label:'总索引'}:files.find(f=>urlFor(f).pathname===location.pathname),host=document.querySelector('.toc-toolbar,.index-actions');
  if(current&&host&&window.parent!==window){
   const name=document.createElement('span');name.className='compare-inline-file';name.textContent=current.label.split('/').pop();name.title=current.label;host.append(name);
   const send=(type,extra={})=>window.parent.postMessage({channel,type,id:current.id,...extra},'*');
   if(!isIndex)documentActions(host);
   // The outer page owns the setting; only the visual right pane shows its control.
   const sync=document.createElement('button');sync.type='button';sync.className='compare-sync';sync.hidden=true;
   sync.innerHTML=svg('<path d="m10 13 4-2M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>');
   sync.addEventListener('click',()=>send('toggle-sync'));
   const documentLinks=host.querySelector('.document-actions');
   if(documentLinks)documentLinks.prepend(sync);else host.append(sync);
   const exit=document.createElement('button');exit.type='button';exit.className='compare-exit';exit.title='单独查看此文件';exit.setAttribute('aria-label','返回单文件');
   exit.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6-6 6 6 6M4 12h16"/></svg>';
   exit.addEventListener('click',()=>send('exit'));host.append(exit);
   document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');if(!link)return;
    if(link.classList.contains('return-index')){event.preventDefault();send('index');return;}
    // Document links must retain pane mode, just like the quick-access tree.
    const url=new URL(link.href),next=files.find(f=>urlFor(f).pathname===url.pathname&&urlFor(f).protocol===url.protocol&&urlFor(f).host===url.host);
    if(next&&next.id!==current.id){event.preventDefault();send('select',{next:next.id});return;}
    if(isIndex&&url.protocol===root.protocol&&url.host===root.host&&url.pathname.startsWith(root.pathname+'.file-index/folders/')&&/\/[^/]+\/index\.html$/.test(url.pathname)){
     event.preventDefault();url.searchParams.set('compare-pane','1');location.assign(url.href);
    }else if(isIndex&&link.closest('nav')&&url.protocol===root.protocol&&url.host===root.host&&url.pathname.startsWith(root.pathname)){
     event.preventDefault();send('index');
    }
   });
   document.addEventListener('reading-positionchange',event=>send('scroll',event.detail));
   window.addEventListener('message',event=>{
    const data=event.data;if(event.source!==window.parent||data?.channel!==channel)return;
    if(data.type==='peer')send('ready',{position:window.FileIndexPosition?.snapshot()});
    if(data.id!==current.id)return;
    if(data.type==='sync-state'){
     sync.hidden=data.show!==true;sync.setAttribute('aria-pressed',String(data.enabled===true));
     sync.title=data.enabled?'关闭同步滚动':'开启同步滚动';sync.setAttribute('aria-label',sync.title);
    }
    if(data.type==='restore-position')window.FileIndexPosition?.restore(data.position);
    if(data.type==='sync-scroll')window.FileIndexPosition?.apply(data.position);
   });
   if(!isIndex)quickAccess(current,host,{
    switchFile:next=>send('select',{next}),compare:(side,next)=>send('place',{side,next}),
    dragStart:next=>send('drag-start',{next}),dragEnd:()=>send('drag-end')
   });
   send('ready',{position:window.FileIndexPosition?.snapshot()});
  }
  window.dispatchEvent(new Event('resize'));return;
 }
 if(document.body.classList.contains('compare-page')){
  const names=[...document.querySelectorAll('.compare-file')],selected=['',''],frames=[...document.querySelectorAll('.compare-pane iframe')],indexURL=new URL(document.querySelector('.compare-shell').dataset.index,location.href);
  if(files.length<2){document.querySelector('.compare-panes').innerHTML='<p class="compare-empty">至少需要两个可用文件才能对照。</p>';return;}
  const panes=document.querySelector('.compare-panes'),settingsKey='file-index:compare-layout:v1:'+root.href;
  let saved={};try{saved=JSON.parse(localStorage.getItem(settingsKey))||{};}catch(_){}
  const validPosition=p=>p&&Number.isFinite(p.y)&&p.y>=0&&Number.isFinite(p.ratio)&&p.ratio>=0&&p.ratio<=1;
  let ratio=Number.isFinite(saved.ratio)?Math.max(.2,Math.min(.8,saved.ratio)):.5,synced=saved.synced===true,lastActive=0,positions=[null,null],saveTimer=0;
  const persist=()=>{try{localStorage.setItem(settingsKey,JSON.stringify({ratio,synced,selected,positions}));}catch(_){}};
  const queueSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(persist,120);};
  const post=(i,type,extra={})=>frames[i].contentWindow?.postMessage({channel,type,id:selected[i],...extra},'*');
  const paintSync=()=>frames.forEach((_,i)=>post(i,'sync-state',{show:i===1,enabled:synced}));
  const toggleSync=()=>{synced=!synced;paintSync();if(synced&&positions[lastActive])post(1-lastActive,'sync-scroll',{position:positions[lastActive]});persist();};
  const divider=document.createElement('div');divider.className='compare-divider';
  const handle=document.createElement('button');handle.type='button';handle.className='compare-handle';handle.innerHTML=svg('<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>');divider.append(handle);panes.append(divider);
  const stacked=()=>window.matchMedia?.('(max-width:760px)').matches||innerWidth<=760;
  function paintRatio(){panes.style.setProperty('--left-size',ratio+'fr');panes.style.setProperty('--right-size',(1-ratio)+'fr');panes.style.setProperty('--split-position',ratio*100+'%');const vertical=stacked();handle.title=(vertical?'点击上下换位；按住上下拖动调整比例':'点击左右换位；按住左右拖动调整比例')+' · '+Math.round(ratio*100)+'% / '+Math.round((1-ratio)*100)+'%';handle.setAttribute('aria-label',handle.title);handle.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home Enter Space');}
  function orderFrames(){frames.forEach((frame,i)=>{frame.parentElement.style.order=String(i*2);frame.parentElement.setAttribute('aria-label',i===0?'左侧文件':'右侧文件');});}
  function swap(){frames.reverse();names.reverse();selected.reverse();positions.reverse();lastActive=1-lastActive;orderFrames();update();persist();}
  let drag=null,suppressClick=false;
  const finish=(cancel=false)=>{if(!drag)return;const old=drag;drag=null;if(cancel&&old.moved)ratio=old.ratio;suppressClick=old.moved||cancel;document.body.classList.remove('compare-resizing');if(handle.hasPointerCapture?.(old.id))handle.releasePointerCapture(old.id);paintRatio();persist();};
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;suppressClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,ratio,moved:false};try{handle.setPointerCapture(e.pointerId);}catch(_){}});
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const vertical=stacked(),delta=vertical?e.clientY-drag.y:e.clientX-drag.x;if(!drag.moved&&Math.abs(delta)<5)return;drag.moved=true;document.body.classList.add('compare-resizing');e.preventDefault();const rect=panes.getBoundingClientRect(),size=vertical?rect.height:rect.width;ratio=Math.max(.2,Math.min(.8,drag.ratio+delta/Math.max(1,size)));paintRatio();},{passive:false});
  document.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finish();});
  document.addEventListener('pointercancel',()=>finish(true));handle.addEventListener('lostpointercapture',()=>finish(true));window.addEventListener('blur',()=>finish(true));
  handle.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}swap();});
  handle.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();finish(true);return;}const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];if(direction||e.key==='Home'){e.preventDefault();ratio=e.key==='Home'?.5:Math.max(.2,Math.min(.8,ratio+direction*(e.shiftKey?.1:.02)));paintRatio();persist();}});
  window.addEventListener('resize',()=>{finish(true);paintRatio();});window.addEventListener('pagehide',persist);paintRatio();orderFrames();
  const initialParams=new URLSearchParams(location.hash.slice(1));
  if(Array.isArray(saved.selected)&&saved.selected.length===2&&saved.selected.every((id,i)=>id===initialParams.get(i?'right':'left'))&&Array.isArray(saved.positions)&&saved.positions.length===2)positions=saved.positions.map(p=>validPosition(p)?p:null);
  const indexFile={id:indexId,label:'总索引'};
  const destination=f=>f.id===indexId?new URL(indexURL):urlFor(f);
  const resolve=id=>id===indexId?indexFile:files.find(f=>f.id===id);
  function load(){const params=new URLSearchParams(location.hash.slice(1));const left=resolve(params.get('left'))||files[0],right=resolve(params.get('right'))||files.find(f=>f.id!==left.id);
   [left,right].forEach((f,i)=>{selected[i]=f.id;names[i].textContent=f.label.split('/').pop();names[i].title=f.label;const url=destination(f);url.searchParams.set('compare-pane','1');if(frames[i].dataset.fileId!==f.id||!frames[i].getAttribute('src')){frames[i].parentElement.classList.remove('reader-ready');if(frames[i].dataset.fileId&&frames[i].dataset.fileId!==f.id)positions[i]=null;frames[i].name='file-index-pane-'+i;frames[i].dataset.fileId=f.id;frames[i].src=url.href;}frames[i].title=f.label;});
  }
  const update=()=>{location.hash=new URLSearchParams({left:selected[0],right:selected[1]}).toString();queueSave();};
  const place=(side,id)=>{
   const i=side==='left'?0:1;if(!validId(id))return;
   if(selected[1-i]===id)selected[1-i]=selected[i];
   selected[i]=id;update();
  };
  const zones=dropZones(place);
  const peer=i=>frames[i].contentWindow?.postMessage({channel,type:'peer',id:selected[1-i]},'*');
  frames.forEach(frame=>frame.addEventListener('load',()=>peer(frames.indexOf(frame))));
  window.addEventListener('message',event=>{
   const i=frames.findIndex(frame=>frame.contentWindow===event.source),data=event.data;
   if(i<0||data?.channel!==channel||data.id!==frames[i].dataset.fileId)return;
   if(data.type==='exit'){location.assign(destination(resolve(selected[i])).href);
   }else if(data.type==='index'){if(selected[i]===indexId){const url=new URL(indexURL);url.searchParams.set('compare-pane','1');frames[i].src=url.href;}else{selected[i]=indexId;update();}
   }else if(data.type==='ready'){
    // First handshake also supplies the other pane's choice; no polling.
    const first=!frames[i].parentElement.classList.contains('reader-ready');
    frames[i].parentElement.classList.add('reader-ready');
    if(first){if(validPosition(positions[i]))post(i,'restore-position',{position:positions[i]});else if(validPosition(data.position))positions[i]=data.position;peer(i);}
    paintSync();
   }else if(data.type==='toggle-sync'&&i===1){toggleSync();
   }else if(data.type==='scroll'&&validPosition(data)){
    positions[i]={x:data.x,y:data.y,ratio:data.ratio,width:data.width};queueSave();
    if(data.cause==='user'){lastActive=i;if(synced)post(1-i,'sync-scroll',{position:positions[i]});}
   }else if(data.type==='drag-start'&&validId(data.next)){zones.show();
   }else if(data.type==='drag-end'){zones.hide();
   }else if(data.type==='place'&&['left','right'].includes(data.side)&&validId(data.next)){place(data.side,data.next);
   }else if(data.type==='select'&&files.some(f=>f.id===data.next)){
    selected[i]=data.next;update();peer(1-i);
   }
  });
  window.addEventListener('hashchange',()=>{load();frames.forEach((_,i)=>peer(i));});load();return;
 }
 const current=files.find(f=>urlFor(f).pathname===location.pathname),host=document.querySelector('.toc-toolbar');
 if(!current||!host||!files.length)return;
 const compare=(side,id)=>{
  if(!validId(id)||id===current.id)return;
  compareURL.hash=new URLSearchParams({left:side==='left'?id:current.id,right:side==='right'?id:current.id}).toString();location.assign(compareURL.href);
 };
 documentActions(host);
 const zones=dropZones(compare);
 quickAccess(current,host,{compare,dragStart:(_,pointer=false)=>zones.show(pointer),dragEnd:zones.hide,pointerMove:zones.mark,pointerDrop:(x,id)=>compare(x<innerWidth/2?'left':'right',id)});
})();

// Offline comparison: only catalogued generated readers; no server or file fetch.
(()=>{
 const script=document.currentScript?.src||document.querySelector('script[src$="compare.js"]')?.src;if(!script)return;
 const root=new URL('../../',script),compareURL=new URL('../compare.html',script);
 const files=(window.FILE_INDEX_CATALOG||[]).filter(f=>/^\.file-index\/previews\/(?:[a-f0-9]{16}|link-\d+)\/preview\.html$/.test(f.preview));
 const urlFor=f=>new URL(f.preview,root);
 const inPane=window!==window.top||new URLSearchParams(location.search).get('compare-pane')==='1';
 const fill=(select,omit)=>{select.replaceChildren();for(const f of files)if(f.id!==omit){const option=document.createElement('option');option.value=f.id;option.textContent=f.label;select.append(option);}};
 const dragType='application/x-file-index-preview';
 const validId=id=>files.some(f=>f.id===id);
 function dropZones(accept){
  const overlay=document.createElement('div');overlay.className='quick-drop-zones';overlay.hidden=true;
  for(const side of ['left','right']){const zone=document.createElement('div');zone.className='quick-drop-zone';zone.dataset.side=side;zone.textContent=side==='left'?'放到左侧对照':'放到右侧对照';overlay.append(zone);}
  // Outside the zoomed body: drag targets keep their actual viewport positions.
  document.documentElement.append(overlay);
  const hide=()=>{overlay.hidden=true;overlay.querySelectorAll('.is-over').forEach(n=>n.classList.remove('is-over'));};
  const read=e=>{try{const value=JSON.parse(e.dataTransfer.getData(dragType));return value.catalog===root.href&&validId(value.id)?value.id:null;}catch(_){return null;}};
  overlay.addEventListener('dragover',e=>{if(!Array.from(e.dataTransfer?.types||[]).includes(dragType))return;e.preventDefault();e.dataTransfer.dropEffect='copy';const zone=e.target.closest('.quick-drop-zone');overlay.querySelectorAll('.quick-drop-zone').forEach(n=>n.classList.toggle('is-over',n===zone));});
  overlay.addEventListener('drop',e=>{const id=read(e),side=e.target.closest('.quick-drop-zone')?.dataset.side;hide();if(!id||!side)return;e.preventDefault();accept(side,id);});
  window.addEventListener('dragend',hide);window.addEventListener('drop',hide);window.addEventListener('blur',hide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  return {show:()=>{overlay.hidden=false;},hide};
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
  const state=read(),tree=new Map();
  for(const file of files){const parts=file.label.split('/'),name=parts.pop();let branch=tree;for(const part of parts){if(!branch.has(part))branch.set(part,{children:new Map()});const item=branch.get(part);if(!item.children)item.children=new Map();branch=item.children;}branch.set(name,{...branch.get(name),file});}
  function render(branch,prefix=''){
   const ul=document.createElement('ul');
   for(const [name,item] of branch){const li=document.createElement('li');ul.append(li);const path=prefix+name;
    if(item.children){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=name;details.dataset.path=path;details.open=state.folders?.[path]??current.label.startsWith(path+'/');details.append(summary,render(item.children,path+'/'));li.append(details);
     details.addEventListener('toggle',()=>{const folders={...read().folders,[path]:details.open};write({folders});});
    }
    if(item.file){const file=item.file,a=document.createElement('a');a.href=urlFor(file).href;a.textContent=name;a.draggable=true;a.dataset.fileId=file.id;a.title=file.label+' · Shift+Enter 右侧对照 · Alt+Enter 左侧对照';if(file.id===current.id)a.setAttribute('aria-current','page');li.append(a);
     a.addEventListener('click',e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(actions.switchFile){e.preventDefault();actions.switchFile(file.id);}});
     a.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.shiftKey||e.altKey)){e.preventDefault();actions.compare(e.altKey?'left':'right',file.id);}});
     a.addEventListener('dragstart',e=>{if(!e.dataTransfer)return;e.dataTransfer.setData(dragType,JSON.stringify({catalog:root.href,id:file.id}));e.dataTransfer.effectAllowed='copy';actions.dragStart(file.id);});
     a.addEventListener('dragend',()=>actions.dragEnd());
    }
   }
   return ul;
  }
  panel.append(render(tree));
  function open(show,remember=true){
   if(show&&outlineToggle?.getAttribute('aria-expanded')==='true')outlineToggle.click();
   panel.hidden=!show;panel.inert=!show;document.body.classList.toggle('quick-open',show);toggle.setAttribute('aria-expanded',String(show));
   if(remember)write({mode:show?'quick':'closed'});
  }
  toggle.addEventListener('click',()=>open(panel.hidden));
  outlineToggle?.addEventListener('click',()=>{open(false,false);write({mode:outlineToggle.getAttribute('aria-expanded')==='true'?'closed':'outline'});},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();open(false);toggle.focus({preventScroll:true});}});
  function fit(){const scale=Number(document.body.style.zoom)||1,compact=inPane||innerWidth/scale<1100;panel.style.maxHeight=Math.max(100,innerHeight*(compact ? .36 : 1)-(compact?0:110))+'px';}
  window.addEventListener('resize',fit);document.addEventListener('page-scalechange',fit);fit();
  if(!inPane&&state.mode==='quick')open(true,false);
  window.addEventListener('pageshow',()=>{if(!inPane&&read().mode==='quick')open(true,false);});
 }
 // Keep the real controls and file selector in one sticky row inside each reader.
 // Messages only carry catalog IDs; file:// origins cannot share DOM access.
 const channel='file-index:compare:v1';
 if(inPane){
  document.body.classList.add('is-compare-pane');
  const current=files.find(f=>urlFor(f).pathname===location.pathname),host=document.querySelector('.toc-toolbar');
  if(current&&host&&window.parent!==window){
   const select=document.createElement('select');select.className='compare-inline-file';select.setAttribute('aria-label','选择对照文件');fill(select);select.value=current.id;host.append(select);
   const send=(type,extra={})=>window.parent.postMessage({channel,type,id:current.id,...extra},'*');
   window.addEventListener('message',event=>{
    const data=event.data;if(event.source!==window.parent||data?.channel!==channel||data.type!=='peer')return;
    for(const option of select.options)option.disabled=option.value===data.id;
    send('ready');
   });
   select.addEventListener('change',()=>{const selected=select.selectedOptions[0];if(selected&&!selected.disabled&&files.some(f=>f.id===select.value))send('select',{next:select.value});});
   quickAccess(current,host,{
    switchFile:next=>send('select',{next}),compare:(side,next)=>send('place',{side,next}),
    dragStart:next=>send('drag-start',{next}),dragEnd:()=>send('drag-end')
   });
   send('ready');
  }
  window.dispatchEvent(new Event('resize'));return;
 }
 if(document.body.classList.contains('compare-page')){
  const selects=[...document.querySelectorAll('.compare-file')],frames=[...document.querySelectorAll('.compare-pane iframe')],back=document.getElementById('compare-return');
  if(files.length<2){document.querySelector('.compare-panes').innerHTML='<p class="compare-empty">至少需要两个可用文件才能对照。</p>';return;}
  selects.forEach(select=>fill(select));
  function load(){const params=new URLSearchParams(location.hash.slice(1));let left=files.find(f=>f.id===params.get('left'))||files[0],right=files.find(f=>f.id===params.get('right')&&f.id!==left.id)||files.find(f=>f.id!==left.id);
   [left,right].forEach((f,i)=>{selects[i].value=f.id;for(const option of selects[i].options)option.disabled=option.value===(i?left:right).id;const url=urlFor(f);url.searchParams.set('compare-pane','1');if(frames[i].getAttribute('src')!==url.href){frames[i].parentElement.classList.remove('reader-ready');frames[i].dataset.fileId=f.id;frames[i].src=url.href;}frames[i].title=f.label;});back.href=urlFor(left).href;
  }
  selects.forEach(select=>select.addEventListener('change',()=>{location.hash=new URLSearchParams({left:selects[0].value,right:selects[1].value}).toString();}));
  const place=(side,id)=>{
   const i=side==='left'?0:1;if(!validId(id))return;
   if(selects[1-i].value===id)selects[1-i].value=selects[i].value;
   selects[i].value=id;selects[i].dispatchEvent(new Event('change'));
  };
  const zones=dropZones(place);
  const peer=i=>frames[i].contentWindow?.postMessage({channel,type:'peer',id:selects[1-i].value},'*');
  frames.forEach((frame,i)=>frame.addEventListener('load',()=>peer(i)));
  window.addEventListener('message',event=>{
   const i=frames.findIndex(frame=>frame.contentWindow===event.source),data=event.data;
   if(i<0||data?.channel!==channel||data.id!==frames[i].dataset.fileId)return;
   if(data.type==='ready'){
    // First handshake also supplies the other pane's choice; no polling.
    const first=!frames[i].parentElement.classList.contains('reader-ready');
    frames[i].parentElement.classList.add('reader-ready');if(first)peer(i);
   }else if(data.type==='drag-start'&&validId(data.next)){zones.show();
   }else if(data.type==='drag-end'){zones.hide();
   }else if(data.type==='place'&&['left','right'].includes(data.side)&&validId(data.next)){place(data.side,data.next);
   }else if(data.type==='select'&&data.next!==selects[1-i].value&&files.some(f=>f.id===data.next)){
    selects[i].value=data.next;selects[i].dispatchEvent(new Event('change'));peer(1-i);
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
 const zones=dropZones(compare);
 quickAccess(current,host,{compare,dragStart:()=>zones.show(),dragEnd:zones.hide});
})();

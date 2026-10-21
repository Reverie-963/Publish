// Offline comparison: only catalogued generated readers; no server or file fetch.
(()=>{
 const script=document.currentScript?.src||document.querySelector('script[src$="compare.js"]')?.src;if(!script)return;
 const root=new URL('../../',script),compareURL=new URL('../compare.html',script);
 const files=(window.FILE_INDEX_CATALOG||[]).filter(f=>/^\.file-index\/previews\/(?:[a-f0-9]{16}|link-\d+)\/preview\.html$/.test(f.preview));
 const urlFor=f=>new URL(f.preview,root);
 const inPane=window!==window.top||new URLSearchParams(location.search).get('compare-pane')==='1';
 const fill=(select,omit)=>{select.replaceChildren();for(const f of files)if(f.id!==omit){const option=document.createElement('option');option.value=f.id;option.textContent=f.label;select.append(option);}};
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
  const peer=i=>frames[i].contentWindow?.postMessage({channel,type:'peer',id:selects[1-i].value},'*');
  frames.forEach((frame,i)=>frame.addEventListener('load',()=>peer(i)));
  window.addEventListener('message',event=>{
   const i=frames.findIndex(frame=>frame.contentWindow===event.source),data=event.data;
   if(i<0||data?.channel!==channel||data.id!==frames[i].dataset.fileId)return;
   if(data.type==='ready'){
    // First handshake also supplies the other pane's choice; no polling.
    const first=!frames[i].parentElement.classList.contains('reader-ready');
    frames[i].parentElement.classList.add('reader-ready');if(first)peer(i);
   }else if(data.type==='select'&&data.next!==selects[1-i].value&&files.some(f=>f.id===data.next)){
    selects[i].value=data.next;selects[i].dispatchEvent(new Event('change'));peer(1-i);
   }
  });
  window.addEventListener('hashchange',()=>{load();frames.forEach((_,i)=>peer(i));});load();return;
 }
 const current=files.find(f=>urlFor(f).pathname===location.pathname),host=document.querySelector('.toc-toolbar');
 if(!current||files.length<2||!host)return;
 const control=document.createElement('div');control.className='compare-control';
 control.innerHTML='<button type="button" class="compare-toggle" aria-label="双文件对照" title="双文件对照" aria-expanded="false" aria-controls="compare-picker"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M12 4v16"/></svg></button><div id="compare-picker" class="compare-picker" hidden><label for="compare-file">选择另一个文件</label><select id="compare-file"></select></div>';
 host.append(control);const toggle=control.querySelector('button'),picker=control.querySelector('.compare-picker'),select=control.querySelector('select');fill(select,current.id);select.prepend(new Option('选择文件…',''));select.value='';
 const open=show=>{picker.hidden=!show;toggle.setAttribute('aria-expanded',String(show));if(show)select.focus();};
 toggle.addEventListener('click',()=>open(picker.hidden));select.addEventListener('change',()=>{if(!files.some(f=>f.id===select.value&&f.id!==current.id))return;compareURL.hash=new URLSearchParams({left:current.id,right:select.value}).toString();location.assign(compareURL.href);});
 document.addEventListener('click',e=>{if(!control.contains(e.target))open(false);});control.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();open(false);toggle.focus();}});
})();

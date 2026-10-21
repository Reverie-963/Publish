// Offline comparison: only catalogued generated readers; no server or file fetch.
(()=>{
 const script=document.currentScript?.src||document.querySelector('script[src$="compare.js"]')?.src;if(!script)return;
 const root=new URL('../../',script),compareURL=new URL('../compare.html',script);
 const files=(window.FILE_INDEX_CATALOG||[]).filter(f=>/^\.file-index\/previews\/(?:[a-f0-9]{16}|link-\d+)\/preview\.html$/.test(f.preview));
 const urlFor=f=>new URL(f.preview,root);
 const inPane=window!==window.top||new URLSearchParams(location.search).get('compare-pane')==='1';
 if(inPane){document.body.classList.add('is-compare-pane');return;}
 const fill=(select,omit)=>{select.replaceChildren();for(const f of files)if(f.id!==omit){const option=document.createElement('option');option.value=f.id;option.textContent=f.label;select.append(option);}};
 if(document.body.classList.contains('compare-page')){
  const selects=[...document.querySelectorAll('.compare-file')],frames=[...document.querySelectorAll('.compare-pane iframe')],back=document.getElementById('compare-return');
  if(files.length<2){document.querySelector('.compare-panes').innerHTML='<p class="compare-empty">至少需要两个可用文件才能对照。</p>';return;}
  selects.forEach(select=>fill(select));
  function load(){const params=new URLSearchParams(location.hash.slice(1));let left=files.find(f=>f.id===params.get('left'))||files[0],right=files.find(f=>f.id===params.get('right')&&f.id!==left.id)||files.find(f=>f.id!==left.id);
   [left,right].forEach((f,i)=>{selects[i].value=f.id;for(const option of selects[i].options)option.disabled=option.value===(i?left:right).id;const url=urlFor(f);url.searchParams.set('compare-pane','1');if(frames[i].getAttribute('src')!==url.href)frames[i].src=url.href;frames[i].title=f.label;});back.href=urlFor(left).href;
  }
  selects.forEach(select=>select.addEventListener('change',()=>{location.hash=new URLSearchParams({left:selects[0].value,right:selects[1].value}).toString();}));
  document.querySelector('.compare-close').addEventListener('click',()=>location.assign(back.href));window.addEventListener('hashchange',load);load();return;
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

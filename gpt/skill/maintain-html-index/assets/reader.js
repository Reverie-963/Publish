// Collapsible, quiet outline beside the article; its icon stays reachable.
(() => {
  const toggle = document.querySelector('.toc-toggle'), panel = document.querySelector('.toc-panel');
  const layout = document.querySelector('.layout');
  if (!toggle || !panel || !layout) return;
  const entries = Array.from(panel.querySelectorAll('a[href]')).map(link => {
    try { return {link,target:document.getElementById(link.dataset.frame||decodeURIComponent(link.hash.slice(1)))}; } catch (_) { return {link,target:null}; }
  }).filter(entry => entry.target);
  if (entries.length <= 1) { toggle.remove(); panel.remove(); return; }
  const sidebar=document.createElement('div');sidebar.className='reader-sidebar';
  const toolbar=document.createElement('div');toolbar.className='toc-toolbar';
  const label=document.createElement('span');label.className='toc-label';label.textContent='目录';
  toolbar.append(toggle,label);sidebar.append(toolbar,panel);layout.prepend(sidebar);layout.classList.add('has-toc');
  toggle.type='button';toggle.setAttribute('aria-controls',panel.id);
  toggle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h12M4 18h8"/></svg>';
  const script=document.currentScript?.src||document.querySelector('script[src$="reader.js"]')?.src;
  const storageKey='file-index:outline:v2:'+(script?new URL('.',script).href:location.pathname);
  const stores=[];
  for(const name of ['localStorage','sessionStorage']){try{const store=window[name];store.getItem(storageKey);stores.push(store);}catch(_){}}
  let compact=null,active=null,frame=0,selectedFrameLink=null;
  const zoom=()=>Number(document.body.style.zoom)||1;
  function currentHeading(){let target=entries[0].target;for(const entry of entries)if(!entry.target.closest('details:not([open])')&&entry.target.getBoundingClientRect().top<=(compact?64:48)*zoom())target=entry.target;return target;}
  function markCurrent(target,reveal=false){
    const changed=active!==target;active=target;
    entries.forEach(entry=>{if(entry.target===target&&(!entry.link.dataset.frame||entry.link===(selectedFrameLink||entries[0].link)))entry.link.setAttribute('aria-current','location');else entry.link.removeAttribute('aria-current');});
    if(panel.hidden||(!changed&&!reveal))return;
    const link=panel.querySelector('a[aria-current]');if(!link)return;
    const box=panel.getBoundingClientRect(),item=link.getBoundingClientRect();
    if(item.top<box.top)panel.scrollTop+=(item.top-box.top)/zoom();
    else if(item.bottom>box.bottom)panel.scrollTop+=(item.bottom-box.bottom)/zoom();
  }
  function setOpen(open,remember=false,focus=false){
    const anchor=remember?currentHeading():null,before=anchor?.getBoundingClientRect().top;
    document.body.classList.toggle('toc-open',open);panel.hidden=!open;panel.inert=!open;
    toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'收起文稿目录':'展开文稿目录');toggle.title=open?'收起文稿目录 · Esc':'展开文稿目录';
    if(remember){
      for(const store of stores){try{store.setItem(storageKey+(compact?':compact':':wide'),String(open));}catch(_){}}
      const shift=anchor.getBoundingClientRect().top-before;
      if(Math.abs(shift)>1){const old=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';window.scrollTo(window.scrollX,Math.max(0,window.scrollY+shift));document.documentElement.style.scrollBehavior=old;}
    }
    markCurrent(currentHeading(),true);if(focus)toggle.focus({preventScroll:true});
  }
  function savedOpen(){for(const store of stores){try{const value=store.getItem(storageKey+(compact?':compact':':wide'));if(value==='true'||value==='false')return value==='true';}catch(_){}}return false;}
  function fit(){
    const next=window.innerWidth/zoom()<820,changed=compact!==next;compact=next;
    layout.classList.toggle('toc-compact',compact);
    sidebar.style.top=(compact?0:24)+'px';
    panel.style.maxHeight=Math.max(80,window.innerHeight/zoom()*(compact ? 0.3 : 1)-(compact?0:96))+'px';
    if(changed)setOpen(savedOpen());
  }
  fit();
  toggle.addEventListener('click',()=>setOpen(panel.hidden,true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden&&!document.querySelector('.page-zoom-panel:not([hidden])')){event.preventDefault();setOpen(false,true,true);}});
  panel.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
    const entry=entries.find(entry=>entry.link===link);if(!entry)return;
    if(link.dataset.frame){selectedFrameLink=link;markCurrent(entry.target);return;}
    for(let parent=entry.target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    markCurrent(entry.target);entry.target.setAttribute('tabindex','-1');entry.target.focus({preventScroll:true});
    // Native anchor scrolling and history; the outline remains open.
  });
  function track(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;markCurrent(currentHeading());});}
  window.addEventListener('scroll',track,{passive:true});window.addEventListener('hashchange',track);
  window.addEventListener('resize',fit);document.addEventListener('page-scalechange',fit);
  window.addEventListener('pageshow',()=>{fit();setOpen(savedOpen());});
})();

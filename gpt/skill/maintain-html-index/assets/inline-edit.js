// Direct paragraph editing; the local service commits source text, never rendered HTML.
(()=>{
 const config=JSON.parse(document.getElementById('edit-config').textContent);
 const status=document.createElement('span');status.className='edit-status';status.role='status';status.setAttribute('aria-live','polite');
 document.querySelector('.return-index').after(status);
 const key='file-index:draft:'+config.workspace+':'+config.id;
 let active=null,timer=null,saving=null,closing=null,failed=false,composing=false;
 window.fileIndexEditingBusy=()=>Boolean(active||saving||closing||failed||composing);
 const norm=text=>text.replace(/\r\n/g,'\n');
 const textOf=node=>norm(node.innerText===undefined?node.textContent:node.innerText);
 function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
 function draft(){if(!active)return;try{localStorage.setItem(key,JSON.stringify({revision:config.revision,block:active.id,meta:config.blocks[active.id],text:textOf(active.node)}));}catch(_){}}
 function clearDraft(){try{localStorage.removeItem(key);}catch(_){}}
 function dirty(){return active&&textOf(active.node)!==norm(config.blocks[active.id].text);}
 function schedule(){if(!active)return;failed=false;draft();message('未保存');clearTimeout(timer);if(!composing)timer=setTimeout(save,900);}
 async function save(){
  clearTimeout(timer);if(composing)return false;if(saving)return saving;if(!active||!dirty())return true;
  const current=active,block=config.blocks[current.id],value=textOf(current.node),end=block.end;
  message('保存中…');
  saving=(async()=>{
   try{
    const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Edit-Key':config.writeKey},body:JSON.stringify({id:config.id,revision:config.revision,block:current.id,old:block.text,start:block.start,end:block.end,text:value})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败');
    config.revision=result.revision;block.text=result.text;current.fragment=result.fragment;
    if(config.kind==='md'){
     for(const [id,other]of Object.entries(config.blocks))if(id!==current.id&&other.start>=end){other.start+=result.delta;other.end+=result.delta;}
     block.end=result.end;current.fragment=result.fragment;
    }
    failed=false;message('已保存');
    if(textOf(current.node)===value){clearDraft();}else draft();
    return true;
   }catch(error){failed=true;message(error.message+'（输入已保留）',true);draft();return false;}
   finally{saving=null;}
  })();
  const ok=await saving;if(ok&&dirty())return save();return ok;
 }
 function restore(current){
  const block=config.blocks[current.id];
  current.node.removeAttribute('contenteditable');current.node.classList.remove('editing');current.node.removeAttribute('role');current.node.removeAttribute('aria-label');
  if(config.kind==='md'&&current.fragment!==undefined){
   const previous=current.headingIds;current.node.innerHTML=current.fragment;
   [...current.node.querySelectorAll('h1,h2,h3,h4,h5,h6')].forEach((h,i)=>{if(previous[i])h.id=previous[i];const link=[...document.querySelectorAll('.toc a')].find(a=>decodeURIComponent(a.hash.slice(1))===h.id);if(link)link.textContent=h.textContent;});
  }else if(config.kind==='word'){
   // Preserve styled runs in the reading view until the next load whenever unchanged.
   if(current.fragment!==undefined)current.node.innerHTML=current.fragment;
   else if(block.text===current.initial)current.node.innerHTML=current.html;
   else {current.node.textContent=block.text;current.node.style.whiteSpace='pre-wrap';}
   const link=document.querySelector('.toc a[href="#'+current.id+'"]');if(link)link.textContent=block.text;
  }else current.node.innerHTML=current.html;
 }
 function close(){if(closing)return closing;if(!active)return Promise.resolve(true);const current=active;closing=(async()=>{if(!await save())return false;if(active!==current)return false;restore(current);active=null;return true;})().finally(()=>{closing=null;});return closing;}
 function begin(node,draftText){
  const id=node.dataset.editBlock,block=config.blocks[id];if(!block)return;
  active={id,node,html:node.innerHTML,initial:block.text,headingIds:[...node.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(n=>n.id)};
  node.textContent=draftText===undefined?block.text:draftText;node.setAttribute('contenteditable','plaintext-only');node.classList.add('editing');node.role='textbox';node.setAttribute('aria-label',config.kind==='md'?'编辑 Markdown 段落':'编辑 Word 段落');node.focus();
  const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(node);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
 }
 document.querySelectorAll('[data-edit-block]').forEach(node=>{node.tabIndex=0;node.title='点击文字编辑 · 自动保存 · Esc 返回阅读';});
 document.addEventListener('click',async event=>{
  const node=event.target.closest('[data-edit-block]');if(!node||event.target.closest('a,img')||node===active?.node)return;
  if(await close())begin(node);
 });
 document.addEventListener('focusin',event=>{const node=event.target.closest('[data-edit-block]');if(node&&!active)begin(node);});
 document.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});
 document.addEventListener('compositionend',()=>{composing=false;if(active)schedule();});
 document.addEventListener('input',event=>{if(event.target.closest('[data-edit-block]')===active?.node)schedule();});
 document.addEventListener('focusout',event=>{if(active&&event.target===active.node)setTimeout(()=>{if(active&&!active.node.contains(document.activeElement))close();},0);});
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}
  if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();close();}
 },true);
 // Plain paste: no pasted scripts, hidden markup or external formatting enters the source.
 document.addEventListener('paste',event=>{if(!active||!active.node.contains(event.target))return;event.preventDefault();const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(event.clipboardData.getData('text/plain'));range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);schedule();});
 window.addEventListener('beforeunload',event=>{if(dirty()||saving||failed){draft();event.preventDefault();event.returnValue='';}});
 try{
  const pending=JSON.parse(localStorage.getItem(key)||'null');
  if(pending){const node=document.querySelector('[data-edit-block="'+pending.block+'"]');if(node){begin(node,pending.text);if(pending.revision!==config.revision){config.revision=pending.revision;failed=true;message('原文件已经变化，草稿已恢复供复制；未覆盖原件',true);}else {config.blocks[pending.block]=pending.meta;schedule();}}}
 }catch(_){}
})();

'use strict';
(() => {
  const data=JSON.parse(document.getElementById('review-data').textContent);
  const $=id=>document.getElementById(id);
  const key='report-versions:v2:'+data.id;
  const message=text=>{$('message').textContent=text;};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const emptyDraft=()=>({en:'',zh:''});
  let state={};let durable=true;let savedRecord=null;
  try{savedRecord=JSON.parse(localStorage.getItem(key)||'null');}catch(e){message('无法恢复浏览器记录；当前显示文件中的版本。');}
  function validVersion(v){return v && ['id','en','zh'].every(k=>typeof v[k]==='string') && v.id && v.en.length<200000 && v.zh.length<200000;}
  for(const b of data.blocks){
    const saved=savedRecord?.schema===2 && savedRecord.documentId===data.id ? savedRecord.blocks?.[b.id]:null;
    const valid=saved && Array.isArray(saved.versions) && saved.versions.length && saved.versions.every(validVersion) && new Set(saved.versions.map(v=>v.id)).size===saved.versions.length && saved.draft && ['en','zh'].every(k=>typeof saved.draft[k]==='string');
    const versions=valid?copy(saved.versions):copy(b.versions);
    let selected=valid && versions.some(v=>v.id===saved.selected)?saved.selected:versions.at(-1).id;
    let draft=valid?copy(saved.draft):emptyDraft();
    // Existing browser edits become the starting v1; old decisions and notes are not used.
    if(!valid && data.legacy_revision){try{const legacy=JSON.parse(localStorage.getItem('report-review:'+data.id+':'+data.legacy_revision)||'null');const old=legacy?.documentId===data.id && legacy?.revision===data.legacy_revision ? legacy.blocks?.[b.id]:null;if(old && typeof old.en==='string' && typeof old.zh==='string' && (old.en||old.zh)){versions[0]={...versions[0],en:old.en,zh:old.zh};}}catch(e){}}
    // New source revisions append immutable IDs; local history and drafts survive regeneration.
    for(const v of b.versions)if(!versions.some(x=>x.id===v.id)){versions.push(copy(v));if(!draft.en && !draft.zh)selected=v.id;}
    state[b.id]={versions,selected,draft};
  }
  function persist(){try{localStorage.setItem(key,JSON.stringify({schema:2,documentId:data.id,blocks:state}));durable=true;return true;}catch(e){durable=false;message('浏览器存储不可用；本次内容仅在当前页面，关闭会丢失。请用原生批注把内容发给我。');return false;}}
  function selected(s){return s.versions.find(v=>v.id===s.selected)||s.versions.at(-1);}
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parts(old,current){
    // Preserve exact text; highlight the changed span between shared prefix/suffix tokens.
    const tokens=t=>t.match(/[\u3400-\u9fff]|\w+|\s+|[^\w\s]/gu)||[];
    const a=tokens(old),b=tokens(current);let head=0,tail=0;
    while(head<a.length && head<b.length && a[head]===b[head])head++;
    while(tail<a.length-head && tail<b.length-head && a[a.length-1-tail]===b[b.length-1-tail])tail++;
    const side=(x,tag)=>escape(x.slice(0,head).join(''))+(x.length-head-tail?'<'+tag+'>'+escape(x.slice(head,x.length-tail).join(''))+'</'+tag+'>':'')+escape(tail?x.slice(x.length-tail).join(''):'');
    return [side(a,'del'),side(b,'ins')];
  }
  function renderPairs(container,base,next,side,highlight){
    container.replaceChildren();const a={},b={};for(const lang of ['en','zh']){a[lang]=base[lang].split('\n\n');b[lang]=next[lang].split('\n\n');}
    for(let i=0;i<Math.max(...Object.values(side==='before'?a:b).map(p=>p.length));i++)for(const lang of ['en','zh']){
      const value=(side==='before'?a:b)[lang][i]||'';if(!value)continue;
      const p=document.createElement('p');p.lang=lang;p.className='prose';
      if(highlight)p.innerHTML=parts(a[lang][i]||'',b[lang][i]||'')[side==='before'?0:1];else p.textContent=value;
      container.appendChild(p);
    }
  }
  function proposed(s){const v=selected(s);return {en:s.draft.en.trim()?s.draft.en:v.en,zh:s.draft.zh.trim()?s.draft.zh:v.zh};}
  function render(id,controls=false){
    const el=$(id),s=state[id],v=selected(s),next=proposed(s);
    const hasDraft=Boolean(s.draft.en.trim()||s.draft.zh.trim());
    const changed=next.en!==v.en||next.zh!==v.zh;
    if(controls){const select=el.querySelector('.version-select');select.replaceChildren();s.versions.forEach((v,i)=>{const option=document.createElement('option');option.value=v.id;option.textContent='v'+(i+1);select.appendChild(option);});select.value=s.selected;for(const lang of ['en','zh'])el.querySelector('.edit-'+lang).value=s.draft[lang];}
    renderPairs(el.querySelector('.history-text'),v,next,'before',hasDraft&&changed);
    renderPairs(el.querySelector('.clean'),v,next,'after',false);
    for(const lang of ['en','zh']){const overlay=el.querySelector('.highlight-'+lang),input=el.querySelector('.edit-'+lang);overlay.innerHTML=s.draft[lang]?parts(v[lang],s.draft[lang])[1]+'\n':'';overlay.scrollTop=input.scrollTop;overlay.scrollLeft=input.scrollLeft;}
    el.querySelector('.save-version').disabled=!hasDraft||!changed;
    el.querySelector('.save-status').textContent=hasDraft?(changed?'草稿尚未保存为版本。':'内容与所选版本相同。'):'右侧留空，等待编写。';
  }
  for(const b of data.blocks){const el=$(b.id);
    for(const lang of ['en','zh']){
      const input=el.querySelector('.edit-'+lang);
      input.addEventListener('input',()=>{state[b.id].draft[lang]=input.value;persist();render(b.id);});
      input.addEventListener('scroll',()=>{const overlay=el.querySelector('.highlight-'+lang);overlay.scrollTop=input.scrollTop;overlay.scrollLeft=input.scrollLeft;});
    }
    el.querySelector('.version-select').addEventListener('change',e=>{state[b.id].selected=e.target.value;persist();render(b.id);});
    el.querySelector('.save-version').addEventListener('click',()=>{
      const s=state[b.id],v=selected(s),next=proposed(s);if((next.en===v.en&&next.zh===v.zh)||(!s.draft.en.trim()&&!s.draft.zh.trim()))return;
      const id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      s.versions.push({id,en:next.en,zh:next.zh,parentId:v.id,createdAt:new Date().toISOString()});s.selected=id;s.draft=emptyDraft();
      const ok=persist();render(b.id,true);
      el.querySelector('.save-status').textContent=ok?'已保存为 v'+s.versions.length+'，可在左侧查看。':'已生成当前页面版本，但浏览器未能持久保存。';
    });
    render(b.id,true);
  }
  document.body.classList.add('js-ready');
  persist();
  $('view').addEventListener('change',e=>document.body.classList.toggle('clean-mode',e.target.value==='clean'));
})();

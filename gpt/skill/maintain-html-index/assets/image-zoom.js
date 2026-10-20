// Image-only viewer; ordinary page scrolling and browser zoom shortcuts remain native.
(() => {
  const sources=[...document.querySelectorAll('article img')].filter(image=>!image.closest('a'));
  if(!sources.length)return;
  const svg=path=>'<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
  const tool=(action,label,icon)=>'<button type="button" class="zoom-tool" data-zoom="'+action+'" title="'+label+'" aria-label="'+label+'">'+svg(icon)+'</button>';
  const dialog=document.createElement('dialog');dialog.className='image-zoom';dialog.setAttribute('aria-label','图片放大预览');
  dialog.innerHTML='<div class="zoom-toolbar"><span class="zoom-title"></span>'+tool('out','缩小（−）','M5 12h14')+'<button type="button" class="zoom-tool zoom-percent" data-zoom="actual" title="原始大小（1）" aria-label="原始大小">100%</button>'+tool('in','放大（+）','M5 12h14 M12 5v14')+tool('fit','适应窗口（0）','M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5')+tool('close','关闭（Esc）','m6 6 12 12 M18 6 6 18')+'</div><div class="zoom-stage"><div class="zoom-canvas"><img class="zoom-image" alt="" draggable="false"></div></div>';
  document.body.append(dialog);
  const stage=dialog.querySelector('.zoom-stage'),canvas=dialog.querySelector('.zoom-canvas'),image=dialog.querySelector('.zoom-image'),percent=dialog.querySelector('.zoom-percent');
  const minimum=.05,maximum=6;let scale=1,naturalW=0,naturalH=0,fitMode=true,active=null,oldOverflow='',drag=null,ready=false;
  const dimensions=()=>({w:stage.clientWidth||window.innerWidth,h:stage.clientHeight||Math.max(100,window.innerHeight-54)});
  const fitScale=()=>{const {w,h}=dimensions();return Math.max(minimum,Math.min(1,(w-32)/naturalW,(h-32)/naturalH));};
  function resize(next,anchor){
    if(!ready)return;
    const {w,h}=dimensions(),point=anchor||{x:w/2,y:h/2};
    const oldW=Math.max(w,naturalW*scale),oldH=Math.max(h,naturalH*scale);
    const x=(stage.scrollLeft+point.x-(oldW-naturalW*scale)/2)/scale,y=(stage.scrollTop+point.y-(oldH-naturalH*scale)/2)/scale;
    scale=Math.max(minimum,Math.min(maximum,next));
    const iw=naturalW*scale,ih=naturalH*scale,cw=Math.max(w,iw),ch=Math.max(h,ih);
    canvas.style.width=cw+'px';canvas.style.height=ch+'px';image.style.width=iw+'px';image.style.height=ih+'px';image.style.left=(cw-iw)/2+'px';image.style.top=(ch-ih)/2+'px';
    stage.scrollLeft=Math.max(0,Math.min(cw-w,(cw-iw)/2+x*scale-point.x));stage.scrollTop=Math.max(0,Math.min(ch-h,(ch-ih)/2+y*scale-point.y));
    stage.classList.toggle('can-pan',iw>w||ih>h);percent.textContent=Math.round(scale*100)+'%';percent.setAttribute('aria-label','当前 '+Math.round(scale*100)+'%，点击恢复原始大小');
    dialog.querySelector('[data-zoom="out"]').disabled=scale<=minimum;dialog.querySelector('[data-zoom="in"]').disabled=scale>=maximum;
  }
  function fit(){fitMode=true;resize(fitScale());stage.scrollLeft=0;stage.scrollTop=0;}
  function close(){if(!dialog.open)return;if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');cleanup();}}
  function cleanup(){document.body.style.overflow=oldOverflow;drag=null;stage.classList.remove('dragging');active?.focus({preventScroll:true});}
  function initialize(){if(ready||!image.naturalWidth)return;naturalW=image.naturalWidth;naturalH=image.naturalHeight;ready=true;scale=1;fit();}
  function open(source){
    active=source;ready=false;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.querySelector('.zoom-title').textContent=document.title+' · '+(source.alt||'图片');image.alt=source.alt||'图片';image.onload=initialize;
    image.src=source.currentSrc||source.src;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    if(source.naturalWidth){naturalW=source.naturalWidth;naturalH=source.naturalHeight;ready=true;scale=1;fit();}else initialize();
    dialog.querySelector('[data-zoom="close"]').focus();
  }
  sources.forEach(source=>{source.dataset.zoomable='';source.tabIndex=0;source.setAttribute('role','button');source.setAttribute('aria-haspopup','dialog');source.setAttribute('aria-label','放大查看：'+(source.alt||'图片'));source.addEventListener('click',()=>open(source));source.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(source);}});});
  dialog.addEventListener('click',event=>{const action=event.target.closest('[data-zoom]')?.dataset.zoom;if(!action)return;if(action==='close')return close();if(action==='fit')return fit();fitMode=false;resize(action==='actual'?1:scale*(action==='in'?1.25:.8));});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',cleanup);
  dialog.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const action={'+':'in','=':'in','-':'out','0':'fit','1':'actual',Escape:'close'}[event.key];if(action){event.preventDefault();dialog.querySelector('[data-zoom="'+action+'"]').click();}});
  stage.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;if(!ready)return;event.preventDefault();const rect=stage.getBoundingClientRect();fitMode=false;resize(scale*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.01),{x:event.clientX-rect.left,y:event.clientY-rect.top});},{passive:false});
  stage.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'||event.button!==0||!stage.classList.contains('can-pan'))return;event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop};stage.setPointerCapture?.(event.pointerId);stage.classList.add('dragging');});
  stage.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;stage.scrollLeft=drag.left+drag.x-event.clientX;stage.scrollTop=drag.top+drag.y-event.clientY;});
  function release(){drag=null;stage.classList.remove('dragging');}
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
  window.addEventListener('resize',()=>{if(dialog.open&&ready){if(fitMode)fit();else resize(scale);}});
})();

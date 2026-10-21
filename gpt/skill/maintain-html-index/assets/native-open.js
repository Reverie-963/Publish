// Use the existing source link; never run scripts or shell commands from files.
(()=>{
 const config=JSON.parse(document.getElementById('native-config').textContent);
 for(const link of document.querySelectorAll('a[href]')){
  if(new URL(link.href).pathname!==config.source)continue;
  link.textContent='在本机应用打开';link.removeAttribute('target');
  link.addEventListener('click',async event=>{
   event.preventDefault();if(window.fileIndexFinishEditing&&!await window.fileIndexFinishEditing())return;
   let status=document.querySelector('.native-status');
   if(!status){status=document.createElement('span');status.className='native-status';status.role='status';status.style.cssText='font-size:12px;color:var(--muted);margin-left:12px';link.after(status);}
   try{
    const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Edit-Key':config.writeKey},body:JSON.stringify({id:config.id})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'无法打开原件');
    status.textContent='已请求打开，保存原件后预览自动更新';
   }catch(error){status.textContent=error.message;}
  });
 }
})();

(() => {
'use strict';
const $=id=>document.getElementById(id);
const e={dropZone:$('dropZone'),fileInput:$('fileInput'),chooseBtn:$('chooseBtn'),controls:$('controls'),targetPreset:$('targetPreset'),customTargetWrap:$('customTargetWrap'),customTarget:$('customTarget'),format:$('format'),maxWidth:$('maxWidth'),quality:$('quality'),qualityValue:$('qualityValue'),settingsNotice:$('settingsNotice'),fileList:$('fileList'),fileCount:$('fileCount'),clearBtn:$('clearBtn'),compressBtn:$('compressBtn'),downloadAllBtn:$('downloadAllBtn'),progressWrap:$('progressWrap'),progressText:$('progressText'),progressPercent:$('progressPercent'),progressBar:$('progressBar'),results:$('results'),resultList:$('resultList'),startOverBtn:$('startOverBtn'),year:$('year')};
const state={files:[],results:[]};
const fmt=n=>n<1024?Math.round(n)+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
const ext=t=>t==='image/png'?'png':t==='image/jpeg'?'jpg':t==='image/avif'?'avif':'webp';
const target=()=>e.targetPreset.value==='custom'?Math.max(1024,Number(e.customTarget.value||1)*1024):Number(e.targetPreset.value);
const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function progress(done,total,text){const p=total?Math.round(done/total*100):0;e.progressText.textContent=text;e.progressPercent.textContent=p+'%';e.progressBar.style.width=p+'%'}
function renderFiles(){
 e.fileCount.textContent=state.files.length+' image'+(state.files.length===1?'':'s');
 e.fileList.replaceChildren();
 if(!state.files.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No images selected yet.';e.fileList.appendChild(empty)}
 state.files.forEach((x,i)=>{
  const row=document.createElement('div');row.className='file-row';
  const img=document.createElement('img');img.className='thumb';img.alt='';img.src=x.url;
  const meta=document.createElement('div');meta.className='file-meta';
  const strong=document.createElement('strong');strong.textContent=x.file.name;strong.title=x.file.name;
  const span=document.createElement('span');span.textContent=fmt(x.file.size)+' · '+(x.file.type||'image');
  meta.append(strong,span);
  const btn=document.createElement('button');btn.className='remove-btn';btn.type='button';btn.dataset.remove=String(i);btn.textContent='Remove';
  row.append(img,meta,btn);e.fileList.appendChild(row);
 });
 e.controls.hidden=!state.files.length;e.compressBtn.disabled=!state.files.length;
}
function addFiles(list){
 const maxBytes=25*1024*1024;
 const incoming=Array.from(list).filter(f=>/^image\/(jpeg|png|webp|avif)$/.test(f.type)&&f.size<=maxBytes);
 const seen=new Set(state.files.map(x=>x.file.name+'|'+x.file.size+'|'+x.file.lastModified));
 incoming.forEach(file=>{const k=file.name+'|'+file.size+'|'+file.lastModified;if(!seen.has(k)){state.files.push({file,url:URL.createObjectURL(file)});seen.add(k)}});
 if(incoming.length<list.length)e.settingsNotice.textContent='Some files were skipped. Use JPG, PNG, WebP or AVIF images up to 25 MB each.';
 renderFiles();
}
function clearResults(){state.results.forEach(x=>x.url&&URL.revokeObjectURL(x.url));state.results=[];e.results.hidden=true;e.resultList.innerHTML='';e.downloadAllBtn.disabled=true}
function clearAll(){state.files.forEach(x=>URL.revokeObjectURL(x.url));state.files=[];clearResults();e.fileInput.value='';e.progressWrap.hidden=true;renderFiles()}
async function loadImage(file){
 const u=URL.createObjectURL(file);
 try{return await new Promise((res,rej)=>{
  const i=new Image();
  i.onload=()=>{const pixels=i.naturalWidth*i.naturalHeight;if(pixels>100000000){i.src='';rej(new Error('This image is too large to process safely in your browser.'));return}res(i)};
  i.onerror=()=>rej(new Error('This image could not be decoded by the browser.'));
  i.src=u;
 })}finally{URL.revokeObjectURL(u)}
}
function makeCanvas(img,maxWidth,jpeg){let w=img.naturalWidth,h=img.naturalHeight;if(!w||!h)throw new Error('Invalid image dimensions.');if(maxWidth&&w>maxWidth){const s=maxWidth/w;w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s))}const cap=16384;if(w>cap){const s=cap/w;w=cap;h=Math.max(1,Math.round(h*s))}if(h>cap){const s=cap/h;h=cap;w=Math.max(1,Math.round(w*s))}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable.');if(jpeg){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)}ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);return c}
const blob=(c,t,q)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('The browser could not encode this image.')),t,q));
async function encode(c,type,targetBytes,initial){if(type==='image/png')return {blob:await blob(c,type),quality:null};let lo=.05,hi=Math.min(1,initial),best=null;for(let i=0;i<9;i++){const q=(lo+hi)/2,b=await blob(c,type,q);if(b.size<=targetBytes){best={blob:b,quality:q};lo=q}else hi=q}const b=await blob(c,type,best?best.quality:lo);return {blob:b,quality:best?best.quality:lo}}
async function compressOne(item){
 const file=item.file,t=target(),mw=Number(e.maxWidth.value)||0,q=Number(e.quality.value)/100;
 const img=await loadImage(file);
 if(e.format.value==='auto'&&!mw&&file.size<=t)return {blob:file,type:file.type||'image/jpeg',original:file.size,target:t,targetReached:true,width:img.naturalWidth,height:img.naturalHeight,name:file.name};
 let type=e.format.value==='auto'?'image/webp':e.format.value;
 let c=makeCanvas(img,mw,type==='image/jpeg'),out=await encode(c,type,t,q),tries=0;
 while(out.blob.size>t&&c.width>320&&tries<8){const s=.88,n=document.createElement('canvas');n.width=Math.max(320,Math.floor(c.width*s));n.height=Math.max(1,Math.floor(c.height*s));const x=n.getContext('2d');if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,n.width,n.height)}x.imageSmoothingQuality='high';x.drawImage(c,0,0,n.width,n.height);c=n;out=await encode(c,type,t,q);tries++}
 if(out.blob.size>t&&e.format.value==='auto'&&type==='image/webp'){type='image/jpeg';c=makeCanvas(img,Math.max(320,c.width),true);out=await encode(c,type,t,q)}
 return {blob:out.blob,type,original:file.size,target:t,targetReached:out.blob.size<=t,width:c.width,height:c.height,name:file.name.replace(/\.[^.]+$/,'')+'.'+ext(type)}
}
function renderResults(){
 e.results.hidden=false;e.resultList.replaceChildren();
 state.results.forEach((r,i)=>{
  const row=document.createElement('div');row.className='result-row';
  if(r.error){
   const badge=document.createElement('div');badge.className='result-badge';badge.textContent='!';
   const meta=document.createElement('div');meta.className='result-meta';
   const strong=document.createElement('strong');strong.textContent=r.name;
   const span=document.createElement('span');span.textContent=r.error;
   meta.append(strong,span);row.append(badge,meta);e.resultList.appendChild(row);return;
  }
  const img=document.createElement('img');img.className='thumb';img.alt='';img.src=r.url;
  const meta=document.createElement('div');meta.className='result-meta';
  const strong=document.createElement('strong');strong.textContent=r.name;
  const span=document.createElement('span');const saved=Math.max(0,Math.round((1-r.blob.size/r.original)*100));
  span.textContent=fmt(r.blob.size)+' · '+(r.targetReached?saved+'% smaller · under target':'target not reached · best effort')+' · '+r.width+'×'+r.height;
  meta.append(strong,span);
  const actions=document.createElement('div');actions.className='result-actions';
  const badge=document.createElement('span');badge.className='result-badge';badge.textContent=r.targetReached?'Under target':'Best effort';
  const btn=document.createElement('button');btn.className='btn secondary';btn.type='button';btn.dataset.download=String(i);btn.textContent='Download';
  actions.append(badge,btn);row.append(img,meta,actions);e.resultList.appendChild(row);
 });
}
async function compressAll(){clearResults();e.compressBtn.disabled=true;e.progressWrap.hidden=false;for(let i=0;i<state.files.length;i++){const item=state.files[i];progress(i,state.files.length,'Compressing '+item.file.name+'…');try{const r=await compressOne(item);r.url=URL.createObjectURL(r.blob);state.results.push(r)}catch(err){state.results.push({error:err.message,name:item.file.name})}renderResults();progress(i+1,state.files.length,'Finished '+(i+1)+' of '+state.files.length);await new Promise(r=>setTimeout(r,0))}e.compressBtn.disabled=false;e.downloadAllBtn.disabled=!state.results.some(x=>x.blob)}
function safeName(name){
 const base=String(name||'image').normalize('NFKC').replace(/[\\/<>:"|?*\x00-\x1F\x7F]/g,'_').replace(/\s+/g,' ').trim().replace(/^\.+|\.+$/g,'').slice(0,120);
 return base||'image';
}
function download(r){if(!r.blob)return;const a=document.createElement('a');a.href=r.url;a.download=safeName(r.name);document.body.appendChild(a);a.click();a.remove()}
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function downloadAll(){const enc=new TextEncoder(),entries=[];const used=new Set();for(const r of state.results.filter(x=>x.blob)){let name=safeName(r.name),base=name,extn='';const dot=name.lastIndexOf('.');if(dot>0){base=name.slice(0,dot);extn=name.slice(dot)}let n=2;while(used.has(name)){name=base+'-'+n+extn;n++}used.add(name);entries.push({name,data:new Uint8Array(await r.blob.arrayBuffer())});}const chunks=[],central=[];let off=0;for(const z of entries){const name=enc.encode(z.name),c=crc32(z.data),local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(z.data.length),...u32(z.data.length),...u16(name.length),...u16(0),...name,...z.data]);chunks.push(local);central.push({name,c,size:z.data.length,off});off+=local.length}const start=off;for(const z of central){const c=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(z.c),...u32(z.size),...u32(z.size),...u16(z.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(z.off),...z.name]);chunks.push(c);off+=c.length}chunks.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(off-start),...u32(start),...u16(0)]));const url=URL.createObjectURL(new Blob(chunks,{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='sizemint-compressed-images.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
e.chooseBtn.onclick=()=>e.fileInput.click();e.dropZone.onclick=x=>{if(!x.target.closest('button'))e.fileInput.click()};e.dropZone.onkeydown=x=>{if(x.key==='Enter'||x.key===' '){x.preventDefault();e.fileInput.click()}};e.fileInput.onchange=x=>addFiles(x.target.files);['dragenter','dragover'].forEach(x=>e.dropZone.addEventListener(x,y=>{y.preventDefault();e.dropZone.classList.add('dragover')}));['dragleave','drop'].forEach(x=>e.dropZone.addEventListener(x,y=>{y.preventDefault();e.dropZone.classList.remove('dragover')}));e.dropZone.ondrop=x=>addFiles(x.dataTransfer.files);e.targetPreset.onchange=()=>e.customTargetWrap.hidden=e.targetPreset.value!=='custom';e.quality.oninput=()=>e.qualityValue.textContent=e.quality.value+'%';e.fileList.onclick=x=>{const b=x.target.closest('[data-remove]');if(!b)return;const i=+b.dataset.remove;URL.revokeObjectURL(state.files[i].url);state.files.splice(i,1);renderFiles()};e.clearBtn.onclick=clearAll;e.compressBtn.onclick=compressAll;e.downloadAllBtn.onclick=downloadAll;e.resultList.onclick=x=>{const b=x.target.closest('[data-download]');if(b)download(state.results[+b.dataset.download])};e.startOverBtn.onclick=clearAll;renderFiles();
})();
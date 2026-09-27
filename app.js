(() => {
'use strict';
const $=id=>document.getElementById(id);
const e={accessGate:$('accessGate'),accessIcon:$('accessIcon'),accessTitle:$('accessTitle'),accessText:$('accessText'),accessStatus:$('accessStatus'),accessHelp:$('accessHelp'),accessRetry:$('accessRetry'),dropZone:$('dropZone'),fileInput:$('fileInput'),chooseBtn:$('chooseBtn'),controls:$('controls'),targetPreset:$('targetPreset'),customTargetWrap:$('customTargetWrap'),customTarget:$('customTarget'),format:$('format'),maxWidth:$('maxWidth'),quality:$('quality'),qualityValue:$('qualityValue'),settingsNotice:$('settingsNotice'),fileList:$('fileList'),fileCount:$('fileCount'),clearBtn:$('clearBtn'),compressBtn:$('compressBtn'),downloadAllBtn:$('downloadAllBtn'),progressWrap:$('progressWrap'),progressText:$('progressText'),progressPercent:$('progressPercent'),progressBar:$('progressBar'),progressRing:$('progressRing'),progressStage:$('progressStage'),resultGate:$('resultGate'),gateCountdown:$('gateCountdown'),gateMessage:$('gateMessage'),viewResultBtn:$('viewResultBtn'),results:$('results'),adNotice:$('adNotice'),adProbe:$('adProbe'),resultList:$('resultList'),startOverBtn:$('startOverBtn'),year:$('year')};
const state={files:[],results:[],processing:false};
const MAX_DIMENSION=16384,MIN_DIMENSION=16;
const fmt=n=>n<1024?Math.round(n)+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
const ext=t=>t==='image/png'?'png':t==='image/jpeg'?'jpg':t==='image/avif'?'avif':'webp';
const target=()=>e.targetPreset.value==='custom'?Math.max(1024,Number(e.customTarget.value||1)*1024):Number(e.targetPreset.value);
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
function clearResults(){state.results.forEach(x=>x.url&&URL.revokeObjectURL(x.url));state.results=[];e.results.hidden=true;e.resultList.replaceChildren();e.downloadAllBtn.disabled=true}
function clearAll(){state.files.forEach(x=>URL.revokeObjectURL(x.url));state.files=[];clearResults();if(e.resultGate)e.resultGate.hidden=true;if(e.viewResultBtn)e.viewResultBtn.disabled=true;e.fileInput.value='';e.progressWrap.hidden=true;renderFiles()}
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
async function encode(c,type,targetBytes,initial){
 if(type==='image/png'){const b=await blob(c,type);return {blob:b,quality:null,fits:b.size<=targetBytes}}
 let lo=.05,hi=Math.min(1,initial),best=null;
 const first=await blob(c,type,hi);
 if(first.size<=targetBytes)return {blob:first,quality:hi,fits:true};
 for(let i=0;i<11;i++){const q=(lo+hi)/2,b=await blob(c,type,q);if(b.size<=targetBytes){best={blob:b,quality:q,fits:true};lo=q}else hi=q}
 const b=best?best.blob:await blob(c,type,lo);
 return {blob:b,quality:best?best.quality:lo,fits:b.size<=targetBytes}
}
function dimensions(img,maxWidth,scale=1){
 let w=img.naturalWidth,h=img.naturalHeight;
 if(maxWidth&&w>maxWidth){const s=maxWidth/w;w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s))}
 w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
 if(w>MAX_DIMENSION){const s=MAX_DIMENSION/w;w=MAX_DIMENSION;h=Math.max(1,Math.round(h*s))}
 if(h>MAX_DIMENSION){const s=MAX_DIMENSION/h;h=MAX_DIMENSION;w=Math.max(1,Math.round(w*s))}
 return {w,h}
}
function candidateCanvas(img,maxWidth,type,scale){const d=dimensions(img,maxWidth,scale),c=document.createElement('canvas');c.width=d.w;c.height=d.h;const x=c.getContext('2d');if(!x)throw new Error('Canvas is unavailable.');if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(img,0,0,c.width,c.height);return {c,w:d.w,h:d.h}}
async function fitTarget(img,type,targetBytes,maxWidth,quality){
 let best=candidateCanvas(img,maxWidth,type,1),out=await encode(best.c,type,targetBytes,quality);
 if(out.fits)return {...out,width:best.w,height:best.h};
 const minimum=candidateCanvas(img,maxWidth,type,.02),minOut=await encode(minimum.c,type,targetBytes,quality);
 if(!minOut.fits)return {...out,width:best.w,height:best.h,fits:false};
 let low=.02,high=1,fitting={...minOut,width:minimum.w,height:minimum.h};
 for(let i=0;i<12;i++){
  const scale=(low+high)/2,cur=candidateCanvas(img,maxWidth,type,scale),curOut=await encode(cur.c,type,targetBytes,quality);
  if(curOut.fits){fitting={...curOut,width:cur.w,height:cur.h};low=scale}else high=scale;
 }
 return fitting
}
async function compressOne(item){
 const file=item.file,t=target(),mw=Math.min(12000,Math.max(0,Number(e.maxWidth.value)||0)),q=Number(e.quality.value)/100;
 const img=await loadImage(file);
 if(e.format.value==='auto'&&!mw&&file.size<=t&&/^image\/(jpeg|png|webp)$/.test(file.type))return {blob:file,type:file.type,original:file.size,target:t,targetReached:true,width:img.naturalWidth,height:img.naturalHeight,name:file.name};
 const types=e.format.value==='auto'?['image/webp','image/jpeg']:[e.format.value];
 let last=null;
 for(const type of types){
  try{const out=await fitTarget(img,type,t,mw,q);last={...out,type};if(out.fits)break}catch(err){last={error:err.message,type}}
 }
 if(!last||last.error)throw new Error(last?.error||'The image could not be compressed.');
 return {blob:last.blob,type:last.type,original:file.size,target:t,targetReached:last.fits,width:last.width,height:last.height,name:file.name.replace(/\.[^.]+$/,'')+'.'+ext(last.type)}
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
function startLoadingAnimation(){
 const stages=['Reading image locally…','Analyzing dimensions…','Finding a target-size match…','Trying compression quality…','Reducing dimensions if needed…','Checking the result…','Preparing the download…','Almost there…','Final verification…','Finishing…'];
 const started=performance.now();let timer;
 const tick=()=>{const s=Math.min(9.99,(performance.now()-started)/1000);if(e.progressStage)e.progressStage.textContent=stages[Math.min(9,Math.floor(s))];if(e.progressRing)e.progressRing.style.setProperty('--loading',Math.min(100,s*10)+'%');if(state.processing)timer=setTimeout(tick,120)};tick();
 return()=>{clearTimeout(timer);if(e.progressRing)e.progressRing.style.setProperty('--loading','100%')}
}
async function waitForResultGate(){
 if(!e.resultGate||!e.viewResultBtn)return;
 e.resultGate.hidden=false;e.results.hidden=true;e.viewResultBtn.disabled=true;
 let remaining=10;e.gateCountdown.textContent=String(remaining);
 await new Promise(resolve=>{const id=setInterval(()=>{remaining-=1;e.gateCountdown.textContent=String(Math.max(0,remaining));if(remaining<=0){clearInterval(id);resolve()}},1000)});
 e.viewResultBtn.disabled=false;e.gateMessage.textContent='Your result is ready. Click below to view and download it.';
}
async function compressAll(){
 if(state.processing||!state.files.length)return;
 state.processing=true;clearResults();e.compressBtn.disabled=true;e.progressWrap.hidden=false;
 const stopAnimation=startLoadingAnimation();
 for(let i=0;i<state.files.length;i++){const item=state.files[i];progress(i,state.files.length,'Compressing '+item.file.name+'…');try{const r=await compressOne(item);r.url=URL.createObjectURL(r.blob);state.results.push(r)}catch(err){state.results.push({error:err.message,name:item.file.name})}renderResults();progress(i+1,state.files.length,'Finished '+(i+1)+' of '+state.files.length);await new Promise(r=>setTimeout(r,0))}
 state.processing=false;stopAnimation();e.compressBtn.disabled=!state.files.length;e.clearBtn.disabled=false;e.downloadAllBtn.disabled=!state.results.some(x=>x.blob);if(e.progressStage)e.progressStage.textContent='Compression complete — your result is ready';
 await waitForResultGate();
}

function safeName(name){
 const base=String(name||'image').normalize('NFKC').replace(/[\\/<>:"|?*\x00-\x1F\x7F]/g,'_').replace(/\s+/g,' ').trim().replace(/^\.+|\.+$/g,'').slice(0,120);
 return base||'image';
}
function download(r){if(!r.blob)return;const a=document.createElement('a');a.href=r.url;a.download=safeName(r.name);document.body.appendChild(a);a.click();a.remove()}
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function downloadAll(){const enc=new TextEncoder(),entries=[];const used=new Set();for(const r of state.results.filter(x=>x.blob)){let name=safeName(r.name),base=name,extn='';const dot=name.lastIndexOf('.');if(dot>0){base=name.slice(0,dot);extn=name.slice(dot)}let n=2;while(used.has(name)){name=base+'-'+n+extn;n++}used.add(name);entries.push({name,data:new Uint8Array(await r.blob.arrayBuffer())});}const chunks=[],central=[];let off=0;for(const z of entries){const name=enc.encode(z.name),c=crc32(z.data),local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(z.data.length),...u32(z.data.length),...u16(name.length),...u16(0),...name,...z.data]);chunks.push(local);central.push({name,c,size:z.data.length,off});off+=local.length}const start=off;for(const z of central){const c=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(z.c),...u32(z.size),...u32(z.size),...u16(z.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(z.off),...z.name]);chunks.push(c);off+=c.length}chunks.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(off-start),...u32(start),...u16(0)]));const url=URL.createObjectURL(new Blob(chunks,{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='sizemint-compressed-images.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function setAccess(blocked){
 document.body.classList.toggle('access-blocked',blocked);
 if(!e.accessGate)return;
 e.accessGate.classList.toggle('blocked',blocked);
 if(blocked){
  e.accessIcon.textContent='!';
  e.accessTitle.textContent='Ad blocker detected';
  e.accessText.textContent='Please allow advertising for SizeMint before using the compressor.';
  e.accessStatus.replaceChildren();
  const dot=document.createElement('i'),label=document.createElement('span');label.textContent='Access blocked';e.accessStatus.append(dot,label);
  e.accessHelp.hidden=false;e.accessRetry.hidden=false;
 }else{
  e.accessIcon.textContent='✓';
  e.accessTitle.textContent='You’re good to go';
  e.accessText.textContent='Advertising check passed. Welcome to SizeMint.';
  e.accessStatus.replaceChildren();
  const dot=document.createElement('i'),label=document.createElement('span');label.textContent='Access granted';e.accessStatus.append(dot,label);
  e.accessHelp.hidden=true;e.accessRetry.hidden=true;
  setTimeout(()=>{e.accessGate.hidden=true;document.body.classList.remove('access-checking')},500);
 }
}
function checkAdBlocker(){
 if(!e.accessGate||!e.adProbe){setAccess(false);return}
 e.accessGate.hidden=false;e.accessRetry.hidden=true;e.accessHelp.hidden=true;
 e.accessTitle.textContent='Checking your browser…';
 e.accessText.textContent='Testing the advertising area and blocker signals before opening the compressor.';
 const status=e.accessStatus.querySelector('span');if(status)status.textContent='Running check';
 setTimeout(()=>{
  const s=getComputedStyle(e.adProbe);
  const blocked=s.display==='none'||s.visibility==='hidden'||e.adProbe.offsetHeight===0||e.adProbe.offsetWidth===0;
  const bait=document.querySelectorAll('.ad-probe,.adsbox,.ad-container');
  const hidden=[...bait].filter(x=>{const q=getComputedStyle(x);return q.display==='none'||q.visibility==='hidden'||x.offsetHeight===0}).length;
  setAccess(blocked||hidden>=2);
 },650);
}
e.chooseBtn.onclick=()=>e.fileInput.click();e.dropZone.onclick=x=>{if(!x.target.closest('button'))e.fileInput.click()};e.dropZone.onkeydown=x=>{if(x.key==='Enter'||x.key===' '){x.preventDefault();e.fileInput.click()}};e.fileInput.onchange=x=>addFiles(x.target.files);['dragenter','dragover'].forEach(x=>e.dropZone.addEventListener(x,y=>{y.preventDefault();e.dropZone.classList.add('dragover')}));['dragleave','drop'].forEach(x=>e.dropZone.addEventListener(x,y=>{y.preventDefault();e.dropZone.classList.remove('dragover')}));e.dropZone.ondrop=x=>addFiles(x.dataTransfer.files);e.targetPreset.onchange=()=>e.customTargetWrap.hidden=e.targetPreset.value!=='custom';e.quality.oninput=()=>e.qualityValue.textContent=e.quality.value+'%';e.fileList.onclick=x=>{const b=x.target.closest('[data-remove]');if(!b)return;const i=+b.dataset.remove;URL.revokeObjectURL(state.files[i].url);state.files.splice(i,1);renderFiles()};e.clearBtn.onclick=clearAll;e.compressBtn.onclick=compressAll;e.downloadAllBtn.onclick=downloadAll;e.resultList.onclick=x=>{const b=x.target.closest('[data-download]');if(b)download(state.results[+b.dataset.download])};e.startOverBtn.onclick=clearAll;e.viewResultBtn.onclick=()=>{e.resultGate.hidden=true;e.results.hidden=false;e.results.scrollIntoView({behavior:'smooth',block:'start'})};renderFiles();
e.accessRetry.onclick=checkAdBlocker;checkAdBlocker();
})();
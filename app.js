const $ = s => document.querySelector(s);
const fileInput = $("#fileInput"), dropzone = $("#dropzone"), browseBtn = $("#browseBtn");
const compressBtn = $("#compressBtn"), clearBtn = $("#clearBtn"), results = $("#results"), status = $("#status");
const targetPreset = $("#targetPreset"), targetCustom = $("#targetCustom"), targetUnit = $("#targetUnit");
const quality = $("#quality"), qualityValue = $("#qualityValue");
let files = [];
$("#year").textContent = new Date().getFullYear();
browseBtn.onclick = () => fileInput.click();
dropzone.onclick = e => { if (!e.target.closest("button")) fileInput.click(); };
dropzone.onkeydown = e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); };
fileInput.onchange = e => addFiles([...e.target.files]);
["dragenter","dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", e => addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))));
targetPreset.onchange = () => { const custom = targetPreset.value === "custom"; targetCustom.disabled = !custom; targetUnit.disabled = !custom; };
quality.oninput = () => qualityValue.textContent = quality.value;
clearBtn.onclick = () => { files=[]; results.innerHTML=""; status.textContent=""; fileInput.value=""; updateButtons(); };
function addFiles(incoming) { files = [...files, ...incoming.filter(f => f.type.startsWith("image/"))]; updateButtons(); status.textContent = `${files.length} image${files.length===1?"":"s"} selected.`; }
function updateButtons() { compressBtn.disabled = !files.length; clearBtn.disabled = !files.length; }
function targetBytes() { if (targetPreset.value !== "custom") return Number(targetPreset.value); const n = Number(targetCustom.value); if (!n || n <= 0) return 0; return n * (targetUnit.value === "MB" ? 1048576 : 1024); }
function extFor(type) { return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"; }
function outputType(original) { const v = $("#format").value; return v === "auto" ? (original.type === "image/png" ? "image/webp" : "image/jpeg") : v; }
function loadImage(file) { return new Promise((resolve,reject)=>{ const url=URL.createObjectURL(file), img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img)}; img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read image"))}; img.src=url; }); }
function canvasBlob(canvas,type,q) { return new Promise(resolve=>canvas.toBlob(resolve,type,q)); }
async function encodeAt(img,type,q,maxWidth) { let w=img.naturalWidth,h=img.naturalHeight; if(maxWidth&&w>maxWidth){h=Math.round(h*maxWidth/w);w=maxWidth;} const canvas=document.createElement("canvas"); canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);}ctx.drawImage(img,0,0,w,h);const blob=await canvasBlob(canvas,type,q);return {blob,w,h}; }
async function compressFile(file) { const target=targetBytes();if(!target)throw new Error("Choose a valid target size.");const type=outputType(file),maxWidth=Number($("#maxWidth").value)||0;const img=await loadImage(file);let q=Number(quality.value)/100,best=null,width=maxWidth||img.naturalWidth;for(let pass=0;pass<7;pass++){const out=await encodeAt(img,type,q,width);if(!best||Math.abs(out.blob.size-target)<Math.abs(best.blob.size-target))best=out;if(out.blob.size<=target)return out;if(type==="image/png"){width=Math.max(240,Math.floor(width*0.82));}else{q=Math.max(0.12,q-0.12);if(q<=0.2&&out.blob.size>target)width=Math.max(240,Math.floor(width*0.82));}}return best; }
compressBtn.onclick = async () => { compressBtn.disabled=true;results.innerHTML="";status.textContent="Compressing...";for(const file of files){try{const out=await compressFile(file);const card=document.createElement("article");card.className="result";const saved=Math.max(0,100-(out.blob.size/file.size*100));const name=file.name.replace(/\.[^.]+$/,"")+"."+extFor(out.blob.type);const url=URL.createObjectURL(out.blob);card.innerHTML=`<div><strong>${escapeHtml(file.name)}</strong><br><span>${fmt(file.size)} → ${fmt(out.blob.size)} (${saved.toFixed(1)}% smaller)</span></div><a class="download" download="${escapeAttr(name)}" href="${url}">Download</a>`;results.appendChild(card);}catch(e){const p=document.createElement("p");p.className="error";p.textContent=`${file.name}: ${e.message}`;results.appendChild(p);}}status.textContent="Done. Your files were processed locally.";compressBtn.disabled=false; };
function fmt(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return s.replace(/["\\]/g,"_")}
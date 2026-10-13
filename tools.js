/* SizeMint shared tools — format detection, format metadata, canvas helpers.
   Loaded before page scripts. No dependencies. All processing stays local. */
(function(){
'use strict';

/* Detect the real image format from file signature (magic bytes),
   falling back to file.type and then the file extension. */
async function detectFormat(file){
  try{
    const buf=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const sig=(...b)=>b.length<=buf.length&&b.every((v,i)=>buf[i]===v);
    if(sig(0xFF,0xD8,0xFF))return{mime:'image/jpeg',label:'JPEG'};
    if(sig(0x89,0x50,0x4E,0x47))return{mime:'image/png',label:'PNG'};
    if(sig(0x47,0x49,0x46,0x38))return{mime:'image/gif',label:'GIF'};
    if(sig(0x42,0x4D))return{mime:'image/bmp',label:'BMP'};
    if(buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46&&
       buf[8]===0x57&&buf[9]===0x45&&buf[10]===0x42&&buf[11]===0x50)
      return{mime:'image/webp',label:'WebP'};
    if(buf[4]===0x66&&buf[5]===0x74&&buf[6]===0x79&&buf[7]===0x70){
      const brand=String.fromCharCode(buf[8],buf[9],buf[10],buf[11]);
      if(brand==='avif')return{mime:'image/avif',label:'AVIF'};
      if(brand==='heic'||brand==='heix')return{mime:'image/heic',label:'HEIC'};
    }
  }catch(err){/* fall through to type/extension */}
  const t=file.type||'';
  if(t==='image/jpeg')return{mime:t,label:'JPEG'};
  if(t==='image/png')return{mime:t,label:'PNG'};
  if(t==='image/webp')return{mime:t,label:'WebP'};
  if(t==='image/avif')return{mime:t,label:'AVIF'};
  if(t==='image/gif')return{mime:t,label:'GIF'};
  if(t==='image/bmp')return{mime:t,label:'BMP'};
  const m=/\.([a-z0-9]+)$/i.exec(file.name||'');
  const e=(m&&m[1]||'').toLowerCase();
  if(e==='jpg'||e==='jpeg')return{mime:'image/jpeg',label:'JPEG'};
  if(e==='png')return{mime:'image/png',label:'PNG'};
  if(e==='webp')return{mime:'image/webp',label:'WebP'};
  if(e==='avif')return{mime:'image/avif',label:'AVIF'};
  if(e==='gif')return{mime:'image/gif',label:'GIF'};
  if(e==='bmp')return{mime:'image/bmp',label:'BMP'};
  return{mime:t,label:'Image'};
}

/* Output formats a browser can actually encode. */
const FORMATS={
  'image/jpeg':{label:'JPG', ext:'jpg',  blurb:'Best for photos. Small files, works everywhere.'},
  'image/png': {label:'PNG', ext:'png',  blurb:'Lossless. Keeps transparency. Larger files.'},
  'image/webp':{label:'WebP',ext:'webp', blurb:'Modern format. Much smaller than JPG or PNG.'},
  'image/avif':{label:'AVIF',ext:'avif', blurb:'Smallest files. Newer browser support.'}
};

function avifEncodable(){
  try{
    const c=document.createElement('canvas');c.width=1;c.height=1;
    return c.toDataURL('image/avif').startsWith('data:image/avif');
  }catch(err){return false}
}

/* Smart default output + one-line guidance for a detected input. */
function recommendOutput(detectedMime){
  const avif=avifEncodable();
  switch(detectedMime){
    case 'image/png':
      return{format:'image/webp', note:'PNG detected — WebP is usually much smaller for the same look. Keep PNG if you need transparency.'};
    case 'image/jpeg':
      return{format:'image/webp', note:'Photo detected — WebP gives smaller files than JPG at the same quality.'};
    case 'image/webp':
      return{format:'image/jpeg', note:'WebP detected — already efficient. JPG is the safer choice for maximum compatibility.'};
    case 'image/avif':
      return{format:avif?'image/avif':'image/webp', note:'AVIF detected — already very efficient.'};
    case 'image/gif':
      return{format:'image/webp', note:'GIF detected — it will be converted from its first frame (animation is not preserved).'};
    case 'image/bmp':
      return{format:'image/webp', note:'BMP detected — converting will shrink it dramatically.'};
    case 'image/heic':
      return{format:'image/jpeg', note:'HEIC detected — most browsers cannot decode it, so conversion may fail. Try JPG output.'};
    default:
      return{format:'image/webp', note:'WebP is the best all-round choice for small files.'};
  }
}

function loadImage(file){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(u);
      if(img.naturalWidth*img.naturalHeight>100000000){rej(new Error('This image is too large to process safely in your browser.'));return}
      if(!img.naturalWidth||!img.naturalHeight){rej(new Error('Invalid image dimensions.'));return}
      res(img);
    };
    img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('This image could not be decoded by the browser.'))};
    img.src=u;
  });
}

function drawToCanvas(img,w,h,fillWhite){
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));
  const x=c.getContext('2d');if(!x)throw new Error('Canvas is unavailable.');
  if(fillWhite){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  x.drawImage(img,0,0,c.width,c.height);
  return c;
}

function canvasToBlob(canvas,type,quality){
  return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('The browser could not encode this image.')),type,quality));
}

function downloadBlob(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

function fmtBytes(n){
  if(n<1024)return Math.round(n)+' B';
  if(n<1048576)return (n/1024).toFixed(1)+' KB';
  return (n/1048576).toFixed(2)+' MB';
}

function safeName(name){
  const base=String(name||'image').normalize('NFKC').replace(/[\\/<>:"|?*\x00-\x1F\x7F]/g,'_').replace(/\s+/g,' ').trim().replace(/^\.+|\.+$/g,'').slice(0,120);
  return base||'image';
}

window.SMTools={detectFormat,FORMATS,avifEncodable,recommendOutput,loadImage,drawToCanvas,canvasToBlob,downloadBlob,fmtBytes,safeName};
})();

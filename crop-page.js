/* SizeMint Crop Image tool — drag to select a region, download PNG or JPG. */
(function(){
'use strict';

var T = window.SMTools;
var noticeEl = document.getElementById('notice');
function note(msg){
  if(!noticeEl) return;
  noticeEl.hidden = false;
  noticeEl.textContent = msg;
}
if(!T){
  note('The image tools library failed to load. Please reload the page and try again.');
  return;
}

var MAX_BYTES = 25 * 1024 * 1024;
var MAX_DISPLAY = 920;
var MIN_NATURAL = 16;

var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var chooseBtn = document.getElementById('chooseBtn');
var cropUI = document.getElementById('cropUI');
var cropStage = document.getElementById('cropStage');
var cropCanvas = document.getElementById('cropCanvas');
var cropRect = document.getElementById('cropRect');
var presetRow = document.getElementById('presetRow');
var fileLabel = document.getElementById('fileLabel');
var dlPng = document.getElementById('dlPng');
var dlJpg = document.getElementById('dlJpg');
var newImageBtn = document.getElementById('newImageBtn');

var img = null;          // loaded Image
var fileName = 'image';
var scale = 1;           // natural px per display px
var rect = null;         // {x,y,w,h} in display px
var aspect = null;       // number (w/h) or null for free
var drawing = false, moving = false;
var startX = 0, startY = 0, moveDX = 0, moveDY = 0;

function baseName(name){
  var b = String(name || 'image');
  var i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

function displayW(){ return cropCanvas.width; }
function displayH(){ return cropCanvas.height; }

function toDisplay(e){
  var r = cropCanvas.getBoundingClientRect();
  var x = (e.clientX - r.left) * (cropCanvas.width / Math.max(1, r.width));
  var y = (e.clientY - r.top) * (cropCanvas.height / Math.max(1, r.height));
  return {
    x: Math.min(Math.max(0, x), displayW()),
    y: Math.min(Math.max(0, y), displayH())
  };
}

function insideRect(p){
  return rect && p.x >= rect.x && p.x <= rect.x + rect.w &&
         p.y >= rect.y && p.y <= rect.y + rect.h;
}

function paintRect(){
  if(!rect || rect.w < 1 || rect.h < 1){
    cropRect.style.display = 'none';
    return;
  }
  cropRect.style.display = 'block';
  cropRect.style.left = (rect.x / displayW() * 100) + '%';
  cropRect.style.top = (rect.y / displayH() * 100) + '%';
  cropRect.style.width = (rect.w / displayW() * 100) + '%';
  cropRect.style.height = (rect.h / displayH() * 100) + '%';
}

function constrainDrag(sx, sy, cx, cy){
  var W = displayW(), H = displayH();
  var dx = cx - sx, dy = cy - sy;
  var w = Math.abs(dx), h = Math.abs(dy);
  if(aspect){
    w = Math.abs(dx);
    h = w / aspect;
    // keep within stage vertically; shrink w if needed
    if(sy + (dy < 0 ? -h : h) > H) h = dy < 0 ? sy : H - sy;
    if(sy + (dy < 0 ? -h : h) < 0) h = dy < 0 ? sy : H - sy;
    if(h < 0) h = 0;
    w = h * aspect;
    // keep within stage horizontally
    if(sx + (dx < 0 ? -w : w) > W) w = dx < 0 ? sx : W - sx;
    if(sx + (dx < 0 ? -w : w) < 0) w = dx < 0 ? sx : W - sx;
    if(w < 0) w = 0;
    h = w / aspect;
  }
  var x = dx < 0 ? sx - w : sx;
  var y = dy < 0 ? sy - h : sy;
  x = Math.min(Math.max(0, x), W);
  y = Math.min(Math.max(0, y), H);
  w = Math.min(w, W - x);
  h = Math.min(h, H - y);
  return { x: x, y: y, w: Math.max(0, w), h: Math.max(0, h) };
}

cropStage.addEventListener('pointerdown', function(e){
  if(!img) return;
  e.preventDefault();
  try{ cropStage.setPointerCapture(e.pointerId); }catch(err){}
  var p = toDisplay(e);
  if(insideRect(p)){
    moving = true;
    moveDX = p.x - rect.x;
    moveDY = p.y - rect.y;
  }else{
    drawing = true;
    startX = p.x;
    startY = p.y;
    rect = { x: p.x, y: p.y, w: 0, h: 0 };
  }
  paintRect();
});

cropStage.addEventListener('pointermove', function(e){
  if(!img) return;
  var p = toDisplay(e);
  if(drawing){
    rect = constrainDrag(startX, startY, p.x, p.y);
    paintRect();
  }else if(moving && rect){
    rect.x = Math.min(Math.max(0, p.x - moveDX), displayW() - rect.w);
    rect.y = Math.min(Math.max(0, p.y - moveDY), displayH() - rect.h);
    paintRect();
  }
});

function endGesture(){
  drawing = false;
  moving = false;
  if(rect && (rect.w < 2 || rect.h < 2)) rect = null;
  paintRect();
}
cropStage.addEventListener('pointerup', endGesture);
cropStage.addEventListener('pointercancel', endGesture);

presetRow.addEventListener('click', function(e){
  var btn = e.target.closest('.preset-btn');
  if(!btn) return;
  var all = presetRow.querySelectorAll('.preset-btn');
  Array.prototype.forEach.call(all, function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var a = btn.getAttribute('data-aspect');
  aspect = (a === 'free' || !a) ? null : parseFloat(a);
  if(rect && aspect){
    var h = rect.w / aspect;
    if(rect.y + h > displayH()) h = displayH() - rect.y;
    rect.h = Math.max(0, h);
    paintRect();
  }
});

function loadFile(f){
  var isImg = /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name || '');
  if(!isImg){ note('"' + f.name + '" is not a supported image file.'); return; }
  if(f.size > MAX_BYTES){ note('"' + f.name + '" is larger than the 25 MB limit.'); return; }
  noticeEl.hidden = true;
  T.loadImage(f).then(function(loaded){
    img = loaded;
    fileName = f.name;
    dropZone.hidden = true;
    cropUI.hidden = false;
    var stageW = cropStage.clientWidth || MAX_DISPLAY;
    var dw = Math.min(img.naturalWidth, stageW, MAX_DISPLAY);
    dw = Math.max(1, Math.round(dw));
    var dh = Math.max(1, Math.round(img.naturalHeight * dw / img.naturalWidth));
    cropCanvas.width = dw;
    cropCanvas.height = dh;
    scale = img.naturalWidth / dw;
    var ctx = cropCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dw, dh);
    rect = null;
    paintRect();
    fileLabel.textContent = f.name + ' · ' + img.naturalWidth + '×' + img.naturalHeight;
    cropUI.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }).catch(function(err){
    note('Could not read "' + f.name + '": ' + (err && err.message ? err.message : 'unknown error'));
  });
}

function download(type){
  if(!img) return;
  var sx, sy, sw, sh;
  if(rect && rect.w >= 1 && rect.h >= 1){
    sx = Math.round(rect.x * scale);
    sy = Math.round(rect.y * scale);
    sw = Math.round(rect.w * scale);
    sh = Math.round(rect.h * scale);
    sx = Math.min(sx, img.naturalWidth - 1);
    sy = Math.min(sy, img.naturalHeight - 1);
    sw = Math.min(sw, img.naturalWidth - sx);
    sh = Math.min(sh, img.naturalHeight - sy);
    if(sw < MIN_NATURAL || sh < MIN_NATURAL){
      note('That crop area is smaller than 16×16 pixels — drag a larger rectangle.');
      return;
    }
  }else{
    sx = 0; sy = 0; sw = img.naturalWidth; sh = img.naturalHeight;
  }
  try{
    var c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    var ctx = c.getContext('2d');
    if(type === 'image/jpeg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sw, sh); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    T.canvasToBlob(c, type, 0.92).then(function(blob){
      var ext = type === 'image/jpeg' ? 'jpg' : 'png';
      T.downloadBlob(blob, T.safeName(baseName(fileName)) + '-cropped.' + ext);
    }).catch(function(err){
      note('Could not encode the crop: ' + (err && err.message ? err.message : 'unknown error'));
    });
  }catch(err){
    note('Could not crop the image: ' + (err && err.message ? err.message : 'unknown error'));
  }
}

function resetAll(){
  img = null;
  rect = null;
  fileName = 'image';
  cropUI.hidden = true;
  dropZone.hidden = false;
  noticeEl.hidden = true;
  fileInput.value = '';
}

dropZone.addEventListener('click', function(e){
  if(e.target.closest('button') && e.target.id !== 'chooseBtn') return;
  fileInput.click();
});
dropZone.addEventListener('keydown', function(e){
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); fileInput.click(); }
});
chooseBtn.addEventListener('click', function(e){ e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', function(){
  if(fileInput.files && fileInput.files.length){
    if(fileInput.files.length > 1) note('You dropped ' + fileInput.files.length + ' images — crop works on one at a time, using the first.');
    loadFile(fileInput.files[0]);
  }
  fileInput.value = '';
});
['dragenter', 'dragover'].forEach(function(ev){
  dropZone.addEventListener(ev, function(e){ e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function(ev){
  dropZone.addEventListener(ev, function(e){ e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function(e){
  if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){
    if(e.dataTransfer.files.length > 1) note('You dropped ' + e.dataTransfer.files.length + ' images — crop works on one at a time, using the first.');
    loadFile(e.dataTransfer.files[0]);
  }
});
dlPng.addEventListener('click', function(){ download('image/png'); });
dlJpg.addEventListener('click', function(){ download('image/jpeg'); });
newImageBtn.addEventListener('click', resetAll);
})();

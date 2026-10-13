/* SizeMint Resize Image tool — resize by pixels or percent, locally. */
(function(){
'use strict';

var T = window.SMTools;
var noticeEl = document.getElementById('notice');
function note(msg){
  if(!noticeEl) return;
  noticeEl.hidden = false;
  noticeEl.textContent = msg;
  if(typeof controls !== 'undefined' && controls) controls.hidden = false;
}
if(!T){
  note('The image tools library failed to load. Please reload the page and try again.');
  return;
}

var MAX_BYTES = 25 * 1024 * 1024;
var MIN_DIM = 16;
var MAX_DIM = 16384;

var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var chooseBtn = document.getElementById('chooseBtn');
var controls = document.getElementById('controls');
var fileEntries = document.getElementById('fileEntries');
var fileCount = document.getElementById('fileCount');
var clearBtn = document.getElementById('clearBtn');
var widthInput = document.getElementById('widthInput');
var heightInput = document.getElementById('heightInput');
var unitSelect = document.getElementById('unitSelect');
var lockAspect = document.getElementById('lockAspect');
var allowEnlarge = document.getElementById('allowEnlarge');
var unitHint = document.getElementById('unitHint');
var resizeBtn = document.getElementById('resizeBtn');
var results = document.getElementById('results');
var resultList = document.getElementById('resultList');
var startOverBtn = document.getElementById('startOverBtn');

var entries = [];

function baseName(name){
  var b = String(name || 'image');
  var i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

function clampDim(v){
  v = Math.round(v);
  if(!isFinite(v)) return null;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, v));
}

function updateUnitHint(){
  if(unitSelect.value === 'pct'){
    unitHint.textContent = 'Percent mode: enter a percentage in the Width field (50 = half size). Height is ignored.';
  }else{
    unitHint.textContent = 'Pixel mode: enter width, height, or both. Empty fields keep the original dimension.';
  }
}

function updateUI(){
  var n = entries.length;
  fileCount.textContent = n + (n === 1 ? ' image' : ' images');
  resizeBtn.disabled = n === 0;
  controls.hidden = n === 0;
}

function renderEntry(entry){
  var row = document.createElement('div');
  row.className = 'file-row';
  var thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.alt = '';
  entry.url = URL.createObjectURL(entry.file);
  thumb.src = entry.url;
  var meta = document.createElement('div');
  meta.className = 'file-meta';
  var strong = document.createElement('strong');
  strong.textContent = entry.file.name;
  var span = document.createElement('span');
  span.textContent = T.fmtBytes(entry.file.size);
  var badge = document.createElement('span');
  badge.className = 'detect-badge';
  badge.textContent = 'Reading…';
  span.appendChild(document.createTextNode(' '));
  span.appendChild(badge);
  meta.appendChild(strong);
  meta.appendChild(span);
  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = 'Remove';
  removeBtn.setAttribute('aria-label', 'Remove ' + entry.file.name);
  removeBtn.addEventListener('click', function(){ removeEntry(entry); });
  row.appendChild(thumb);
  row.appendChild(meta);
  row.appendChild(removeBtn);
  fileEntries.appendChild(row);
  entry.row = row;

  T.detectFormat(entry.file).then(function(d){
    entry.detected = d;
    return T.loadImage(entry.file);
  }).then(function(img){
    entry.img = img;
    badge.textContent = (entry.detected ? entry.detected.label : 'Image') +
      ' · ' + img.naturalWidth + '×' + img.naturalHeight;
  }).catch(function(err){
    badge.textContent = 'Unreadable';
    note('Could not read "' + entry.file.name + '": ' + (err && err.message ? err.message : 'unknown error'));
  });
}

function removeEntry(entry){
  var i = entries.indexOf(entry);
  if(i < 0) return;
  entries.splice(i, 1);
  if(entry.url) URL.revokeObjectURL(entry.url);
  if(entry.row && entry.row.parentNode) entry.row.parentNode.removeChild(entry.row);
  updateUI();
}

function clearAll(){
  entries.slice().forEach(removeEntry);
  resultList.innerHTML = '';
  results.hidden = true;
  noticeEl.hidden = true;
}

function addFiles(list){
  Array.prototype.forEach.call(list, function(f){
    var isImg = /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name || '');
    if(!isImg){ note('Skipped "' + f.name + '": not a supported image file.'); return; }
    if(f.size > MAX_BYTES){ note('Skipped "' + f.name + '": larger than the 25 MB limit.'); return; }
    if(f.size === 0){ note('Skipped "' + f.name + '": the file is empty.'); return; }
    var entry = { file: f, detected: null, img: null, url: null, row: null };
    entries.push(entry);
    renderEntry(entry);
  });
  updateUI();
}

function targetDims(nw, nh){
  var unit = unitSelect.value;
  var tw = parseFloat(widthInput.value);
  var th = parseFloat(heightInput.value);
  var enlarge = allowEnlarge.checked;
  var w, h;

  if(unit === 'pct'){
    var pct = (tw > 0 ? tw : (th > 0 ? th : 100)) / 100;
    var s = enlarge ? pct : Math.min(pct, 1);
    w = nw * s;
    h = nh * s;
  }else{
    var hasW = tw > 0, hasH = th > 0;
    if(lockAspect.checked){
      var s2;
      if(hasW && hasH) s2 = Math.min(tw / nw, th / nh);
      else if(hasW) s2 = tw / nw;
      else if(hasH) s2 = th / nh;
      else s2 = 1;
      if(!enlarge) s2 = Math.min(s2, 1);
      w = nw * s2;
      h = nh * s2;
    }else{
      w = hasW ? tw : nw;
      h = hasH ? th : nh;
      if(!enlarge){ w = Math.min(w, nw); h = Math.min(h, nh); }
    }
  }
  w = clampDim(w);
  h = clampDim(h);
  return { w: w, h: h };
}

function resultRow(entry, blob, outMime, nw, nh, w, h){
  var meta = T.FORMATS[outMime];
  var newName = T.safeName(baseName(entry.file.name)) + '-' + w + 'x' + h + '.' + meta.ext;
  var row = document.createElement('div');
  row.className = 'result-row';
  var thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.alt = '';
  thumb.src = URL.createObjectURL(blob);
  var rm = document.createElement('div');
  rm.className = 'result-meta';
  var strong = document.createElement('strong');
  strong.textContent = newName;
  var span = document.createElement('span');
  span.textContent = nw + '×' + nh + ' → ' + w + '×' + h + ' · ' + meta.label + ' · ' + T.fmtBytes(blob.size);
  rm.appendChild(strong);
  rm.appendChild(span);
  var actions = document.createElement('div');
  actions.className = 'result-actions';
  var badge = document.createElement('span');
  badge.className = 'result-badge';
  badge.textContent = 'Done';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn secondary';
  btn.textContent = 'Download';
  btn.addEventListener('click', function(){ T.downloadBlob(blob, newName); });
  actions.appendChild(badge);
  actions.appendChild(btn);
  row.appendChild(thumb);
  row.appendChild(rm);
  row.appendChild(actions);
  resultList.appendChild(row);
}

function resizeAll(){
  var ready = entries.filter(function(e){ return e.img; });
  if(!ready.length){
    note('No readable images yet — please wait a moment and try again.');
    return;
  }
  resizeBtn.disabled = true;
  noticeEl.hidden = true;
  resultList.innerHTML = '';
  results.hidden = true;
  var chain = Promise.resolve();
  ready.forEach(function(entry){
    chain = chain.then(function(){
      var nw = entry.img.naturalWidth, nh = entry.img.naturalHeight;
      var t = targetDims(nw, nh);
      var w = t.w, h = t.h;
      if(!w || !h){ note('Could not compute dimensions for "' + entry.file.name + '".'); return; }
      var mime = entry.detected ? entry.detected.mime : '';
      var outMime = T.FORMATS[mime] ? mime : 'image/png';
      var q = (outMime === 'image/png') ? undefined : 0.92;
      try{
        var canvas = T.drawToCanvas(entry.img, w, h, outMime === 'image/jpeg');
        return T.canvasToBlob(canvas, outMime, q).then(function(blob){
          resultRow(entry, blob, outMime, nw, nh, w, h);
        });
      }catch(err){
        note('Could not resize "' + entry.file.name + '": ' + (err && err.message ? err.message : 'unknown error'));
        return Promise.resolve();
      }
    });
  });
  chain.then(function(){
    results.hidden = false;
    resizeBtn.disabled = entries.length === 0;
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
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
  addFiles(fileInput.files);
  fileInput.value = '';
});
['dragenter', 'dragover'].forEach(function(ev){
  dropZone.addEventListener(ev, function(e){ e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function(ev){
  dropZone.addEventListener(ev, function(e){ e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function(e){
  if(e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
});
unitSelect.addEventListener('change', updateUnitHint);
clearBtn.addEventListener('click', clearAll);
resizeBtn.addEventListener('click', resizeAll);
startOverBtn.addEventListener('click', clearAll);

updateUnitHint();
updateUI();
})();

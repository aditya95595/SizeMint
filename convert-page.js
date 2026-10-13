/* SizeMint Convert Format tool — detect input format, pick output, encode locally. */
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
var ORDER = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var chooseBtn = document.getElementById('chooseBtn');
var controls = document.getElementById('controls');
var fileEntries = document.getElementById('fileEntries');
var fileCount = document.getElementById('fileCount');
var clearBtn = document.getElementById('clearBtn');
var quality = document.getElementById('quality');
var qualityValue = document.getElementById('qualityValue');
var convertBtn = document.getElementById('convertBtn');
var results = document.getElementById('results');
var resultList = document.getElementById('resultList');
var startOverBtn = document.getElementById('startOverBtn');

var entries = [];
var uid = 0;
var AVIF_OK = T.avifEncodable();

function baseName(name){
  var b = String(name || 'image');
  var i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

function updateQualityLabel(){
  var v = parseInt(quality.value, 10) || 90;
  qualityValue.textContent = v + '%';
  var min = parseInt(quality.min, 10) || 1;
  var max = parseInt(quality.max, 10) || 100;
  var pct = ((v - min) / (max - min)) * 100;
  quality.style.setProperty('--fill', pct.toFixed(1) + '%');
}

function updateUI(){
  var n = entries.length;
  fileCount.textContent = n + (n === 1 ? ' image' : ' images');
  convertBtn.disabled = n === 0;
  controls.hidden = n === 0;
}

function buildPills(entry, idx){
  var wrap = document.createElement('div');
  wrap.className = 'format-pills';
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Output format for ' + entry.file.name);
  ORDER.forEach(function(mime){
    var meta = T.FORMATS[mime];
    var label = document.createElement('label');
    label.className = 'format-pill';
    if(mime === 'image/avif' && !AVIF_OK) label.hidden = true;
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'fmt-' + idx;
    input.value = mime;
    if(mime === 'image/webp') input.checked = true;
    input.addEventListener('change', function(){ entry.format = mime; });
    var card = document.createElement('span');
    card.className = 'pill-card';
    var strong = document.createElement('strong');
    strong.textContent = meta.label;
    var small = document.createElement('small');
    small.textContent = meta.blurb;
    card.appendChild(strong);
    card.appendChild(small);
    var rec = document.createElement('span');
    rec.className = 'rec';
    rec.textContent = 'Recommended';
    rec.hidden = true;
    card.appendChild(rec);
    label.appendChild(input);
    label.appendChild(card);
    wrap.appendChild(label);
    entry['pill_' + mime] = { input: input, rec: rec };
  });
  return wrap;
}

function markRecommended(entry, mime, noteText){
  ORDER.forEach(function(m){
    var p = entry['pill_' + m];
    if(!p) return;
    var isRec = (m === mime);
    p.rec.hidden = !isRec;
    if(isRec) p.input.checked = true;
  });
  entry.format = mime;
  if(entry.recNote) entry.recNote.textContent = noteText || '';
}

function renderEntry(entry){
  var idx = uid++;
  var box = document.createElement('div');
  box.className = 'entry';

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
  badge.textContent = 'Detecting…';
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
  box.appendChild(row);

  box.appendChild(buildPills(entry, idx));

  var recNote = document.createElement('p');
  recNote.className = 'pill-note';
  box.appendChild(recNote);
  entry.recNote = recNote;

  fileEntries.appendChild(box);
  entry.box = box;

  T.detectFormat(entry.file).then(function(d){
    entry.detected = d;
    badge.textContent = d.label;
    var rec = T.recommendOutput(d.mime);
    markRecommended(entry, rec.format, rec.note);
  }).catch(function(){
    badge.textContent = 'Image';
    markRecommended(entry, 'image/webp', '');
  });
}

function removeEntry(entry){
  var i = entries.indexOf(entry);
  if(i < 0) return;
  entries.splice(i, 1);
  if(entry.url) URL.revokeObjectURL(entry.url);
  if(entry.box && entry.box.parentNode) entry.box.parentNode.removeChild(entry.box);
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
    var entry = { file: f, detected: null, format: 'image/webp', url: null, box: null, recNote: null };
    entries.push(entry);
    renderEntry(entry);
  });
  updateUI();
}

function resultRow(entry, blob, outMime){
  var meta = T.FORMATS[outMime];
  var inLabel = entry.detected ? entry.detected.label : 'Image';
  var newName = T.safeName(baseName(entry.file.name)) + '.' + meta.ext;
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
  var diff = entry.file.size - blob.size;
  var pct = entry.file.size > 0 ? Math.round((diff / entry.file.size) * 100) : 0;
  var sizeNote = pct >= 0 ? pct + '% smaller' : Math.abs(pct) + '% larger';
  span.textContent = inLabel + ' → ' + meta.label + ' · ' +
    T.fmtBytes(entry.file.size) + ' → ' + T.fmtBytes(blob.size) + ' · ' + sizeNote;
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

function convertAll(){
  if(!entries.length) return;
  var q = (parseInt(quality.value, 10) || 90) / 100;
  convertBtn.disabled = true;
  noticeEl.hidden = true;
  resultList.innerHTML = '';
  results.hidden = true;
  var chain = Promise.resolve();
  entries.forEach(function(entry){
    chain = chain.then(function(){
      var outMime = entry.format || 'image/webp';
      return T.loadImage(entry.file).then(function(img){
        var canvas = T.drawToCanvas(img, img.naturalWidth, img.naturalHeight, outMime === 'image/jpeg');
        return T.canvasToBlob(canvas, outMime, q);
      }).then(function(blob){
        resultRow(entry, blob, outMime);
      }).catch(function(err){
        note('Could not convert "' + entry.file.name + '": ' + (err && err.message ? err.message : 'unknown error'));
      });
    });
  });
  chain.then(function(){
    results.hidden = false;
    convertBtn.disabled = entries.length === 0;
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
quality.addEventListener('input', updateQualityLabel);
clearBtn.addEventListener('click', clearAll);
convertBtn.addEventListener('click', convertAll);
startOverBtn.addEventListener('click', clearAll);

updateQualityLabel();
updateUI();
})();

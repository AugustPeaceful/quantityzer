if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// ── STATE ──────────────────────────────────────────────────────────────────
let b64=null, itype='image/jpeg';
let pickerOpen=false, viewMode='list', sortBy='date';
let currentObj={q:'logs or wooden beams',icon:'ti-stack-2',label:'Брёвна'};
let docs=[], deferredInstall=null;
let cameraStream=null, cameraActive=false;
try{ docs=JSON.parse(localStorage.getItem('qtz_docs')||'[]'); }catch(e){}

const $=id=>document.getElementById(id);

// ── VIEWS ──────────────────────────────────────────────────────────────────
const VIEWS=['vCamera','vLibrary','vSearch','vNewFolder','vSettings'];
function showView(id){
  VIEWS.forEach(v=>{
    const el=$(v);
    if(!el) return;
    el.classList.toggle('hidden', v!==id);
  });
  if(id==='vCamera') startCamera();
  else stopCamera();
}

// ── CAMERA STREAM ──────────────────────────────────────────────────────────
async function startCamera(){
  const video=$('camVideo');
  if(!video) return;
  // if image already loaded, just show it
  if(b64){ showPreview(); return; }
  if(cameraStream) return;
  // hide preview, show video
  $('camPreview').style.display='none';
  video.style.display='block';
  $('camHint').style.display='block';
  clearOverlay();
  try{
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},
      audio:false
    });
    cameraStream=stream;
    video.srcObject=stream;
    cameraActive=true;
    $('camHint').textContent='Наведите камеру на объекты';
    $('flashBtn').style.display='flex';
  }catch(err){
    cameraActive=false;
    $('camHint').textContent='Нажмите на галерею чтобы загрузить фото';
    $('flashBtn').style.display='none';
    video.style.display='none';
  }
}

function stopCamera(){
  if(cameraStream){
    cameraStream.getTracks().forEach(t=>t.stop());
    cameraStream=null;
    cameraActive=false;
  }
  const video=$('camVideo');
  if(video){ video.srcObject=null; }
}

function showPreview(){
  $('camVideo').style.display='none';
  $('camPreview').style.display='block';
  $('camHint').style.display='none';
}

// ── SHUTTER — снять фото с камеры ──────────────────────────────────────────
$('shutterBtn').addEventListener('click',()=>{
  if(!cameraActive || !cameraStream){
    // no camera — open gallery instead
    $('fileInput').click();
    return;
  }
  const video=$('camVideo');
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth||640;
  canvas.height=video.videoHeight||480;
  canvas.getContext('2d').drawImage(video,0,0);
  itype='image/jpeg';
  b64=canvas.toDataURL('image/jpeg',0.9).split(',')[1];
  $('camPreview').src='data:image/jpeg;base64,'+b64;
  showPreview();
  clearOverlay();
  $('resultArea').innerHTML='';
  // flash effect
  const flash=document.createElement('div');
  flash.style.cssText='position:absolute;inset:0;background:#fff;opacity:.8;pointer-events:none;z-index:99;border-radius:36px';
  $('vCamera').appendChild(flash);
  setTimeout(()=>flash.remove(),100);
});

// ── GALLERY ────────────────────────────────────────────────────────────────
$('galleryBtn').addEventListener('click',()=>$('fileInput').click());

$('fileInput').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(file) readFile(file);
  e.target.value=''; // reset so same file can be selected again
});

document.addEventListener('paste',e=>{
  const items=e.clipboardData?.items||[];
  for(const item of items){ if(item.type.startsWith('image/')){ readFile(item.getAsFile()); break; } }
});

function readFile(file){
  if(!file||!file.type.startsWith('image/'))return;
  itype=file.type;
  const r=new FileReader();
  r.onload=e=>{
    b64=e.target.result.split(',')[1];
    $('camPreview').src=e.target.result;
    showPreview();
    stopCamera();
    clearOverlay();
    $('resultArea').innerHTML='';
  };
  r.readAsDataURL(file);
}

// ── FLASH ──────────────────────────────────────────────────────────────────
let flashOn=false;
$('flashBtn').addEventListener('click',async()=>{
  flashOn=!flashOn;
  $('flashBtn').classList.toggle('flash-on',flashOn);
  $('flashIco').style.color=flashOn?'#ffd200':'';
  if(cameraStream){
    const track=cameraStream.getVideoTracks()[0];
    try{ await track.applyConstraints({advanced:[{torch:flashOn}]}); }catch(e){}
  }
});

// ── CLOSE CAMERA ──────────────────────────────────────────────────────────
$('camCloseBtn').addEventListener('click',()=>{
  b64=null;
  $('camPreview').src='';
  $('camPreview').style.display='none';
  $('resultArea').innerHTML='';
  clearOverlay();
  showView('vLibrary');
  renderLib();
});

$('openCamBtn').addEventListener('click',()=>{
  b64=null;
  $('camPreview').src='';
  $('camPreview').style.display='none';
  $('resultArea').innerHTML='';
  clearOverlay();
  showView('vCamera');
});

// ── OVERLAY ────────────────────────────────────────────────────────────────
function clearOverlay(){
  const ov=$('overlay');
  if(!ov) return;
  ov.getContext('2d').clearRect(0,0,ov.width,ov.height);
}

function drawBoxes(boxes){
  const img=$('camPreview');
  const w=img.offsetWidth, h=img.offsetHeight;
  if(!w||!h) return;
  const ov=$('overlay');
  ov.width=w; ov.height=h;
  ov.style.width=w+'px'; ov.style.height=h+'px';
  const ctx=ov.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const colors=['#1D9E75','#6366f1','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316'];
  boxes.forEach((box,i)=>{
    const c=colors[i%colors.length];
    const x=box.x*w, y=box.y*h, bw=box.w*w, bh=box.h*h;
    ctx.strokeStyle=c; ctx.lineWidth=2.5;
    ctx.strokeRect(x,y,bw,bh);
    const lbl=String(i+1);
    ctx.font='bold 12px DM Sans,system-ui,sans-serif';
    const lw=ctx.measureText(lbl).width+14, lh=18;
    const lx=x, ly=y>lh?y-lh:y;
    ctx.fillStyle=c+'dd';
    ctx.beginPath(); ctx.roundRect(lx,ly,lw,lh,[4,4,4,0]); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillText(lbl,lx+7,ly+13);
  });
}

// ── ANALYZE ────────────────────────────────────────────────────────────────
$('analyzeBtn2').addEventListener('click', analyze);

async function analyze(){
  const q=($('pickInput').value.trim())||currentObj.q;
  if(!b64){ showToast('Сначала сделайте фото или загрузите из галереи'); return; }
  const apiKey=getKey();
  if(!apiKey){ showToast('Добавьте API-ключ в Настройках'); showView('vSettings'); renderSettings(); return; }
  if(!navigator.onLine){ showToast('Нет подключения к интернету'); return; }

  $('resultArea').innerHTML='<div class="result-overlay show"><div class="loading-box"><div class="spin"></div><p>AI анализирует...</p></div></div>';
  clearOverlay();

  const system=`You are a precise visual object detector and counter. Respond ONLY with valid JSON, no markdown, no extra text:
{"count":<integer>,"object":"<name in Russian>","confidence":"<high|medium|low>","notes":"<1 sentence in Russian>","boxes":[{"x":<0-1>,"y":<0-1>,"w":<0-1>,"h":<0-1>}]}
boxes: one per detected object, normalized 0-1 coords.`;

  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',max_tokens:2000,system,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:itype,data:b64}},
          {type:'text',text:`Найди и посчитай: "${q}". JSON с bounding boxes.`}
        ]}]
      })
    });
    const data=await resp.json();
    if(!resp.ok) throw new Error(data?.error?.message||`Ошибка ${resp.status}`);
    const raw=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const p=JSON.parse(raw.replace(/```json|```/g,'').trim());
    const cnt=Math.round(p.count);
    const cfMap={high:{cls:'ro-bh',l:'Высокая точность'},medium:{cls:'ro-bm',l:'Средняя'},low:{cls:'ro-bl',l:'Низкая'}};
    const cf=cfMap[p.confidence]||cfMap.medium;
    $('resultArea').innerHTML=`
      <div class="result-overlay show">
        <div class="ro-label">Найдено</div>
        <div class="ro-num">${cnt}</div>
        <div class="ro-obj">${p.object}</div>
        <div class="ro-footer">
          <span class="ro-badge ${cf.cls}">${cf.l}</span>
          <span class="ro-notes">${p.notes||''}</span>
        </div>
        ${p.boxes?.length?'<div class="ro-hl"><i class="ti ti-checkbox" aria-hidden="true"></i><span>Объекты отмечены рамками</span></div>':''}
      </div>`;
    if(p.boxes?.length) requestAnimationFrame(()=>drawBoxes(p.boxes));

    const entry={
      name:currentObj.label+' — '+cnt+' шт.',
      sub:'1 страница',count:cnt,
      confidence:p.confidence,
      thumb:b64.slice(0,600),
      time:Date.now()
    };
    docs.unshift(entry);
    if(docs.length>50) docs.pop();
    try{ localStorage.setItem('qtz_docs',JSON.stringify(docs)); }catch(e){}
  }catch(err){
    $('resultArea').innerHTML=`<div class="result-overlay show"><div class="errbox"><i class="ti ti-alert-circle" aria-hidden="true"></i><span>${err.message}</span></div></div>`;
  }
}

// ── PICKER ─────────────────────────────────────────────────────────────────
$('pillBtn').addEventListener('click',()=>{
  pickerOpen=!pickerOpen;
  $('picker').classList.toggle('open',pickerOpen);
  $('pillArr').classList.toggle('open',pickerOpen);
});
$('pickGrid').querySelectorAll('.pi').forEach(chip=>{
  chip.addEventListener('click',()=>{
    $('pickGrid').querySelectorAll('.pi').forEach(x=>x.classList.remove('on'));
    chip.classList.add('on');
    currentObj={q:chip.dataset.q,icon:chip.dataset.icon,label:chip.dataset.label};
    $('pillVal').textContent=currentObj.label;
    $('pillIco').className='ti '+currentObj.icon;
    $('pickInput').value='';
    setTimeout(()=>{ pickerOpen=false; $('picker').classList.remove('open'); $('pillArr').classList.remove('open'); },280);
  });
});
$('pickOk').addEventListener('click',()=>{
  const v=$('pickInput').value.trim();
  if(v){ $('pickGrid').querySelectorAll('.pi').forEach(x=>x.classList.remove('on')); currentObj={q:v,icon:'ti-scan',label:v}; $('pillVal').textContent=v; $('pillIco').className='ti ti-scan'; }
  pickerOpen=false; $('picker').classList.remove('open'); $('pillArr').classList.remove('open');
});

// ── LIBRARY ────────────────────────────────────────────────────────────────
function renderLib(items){
  const data=items||docs;
  const body=$('libBody');
  if(!data.length){
    body.innerHTML='<div style="text-align:center;padding:60px 0;color:rgba(255,255,255,.2);font-size:13px"><i class="ti ti-camera-off" style="font-size:32px;display:block;margin-bottom:10px" aria-hidden="true"></i><p>Нет фотографий</p></div>';
    return;
  }
  const sorted=[...data].sort((a,b)=>sortBy==='name'?a.name.localeCompare(b.name):sortBy==='size'?b.count-a.count:b.time-a.time);
  if(viewMode==='grid'){
    body.innerHTML=`<div class="lib-grid">${sorted.map(it=>`
      <div class="lib-card">
        <div class="lib-thumb">${it.thumb?`<img src="data:image/jpeg;base64,${it.thumb}" alt=""/>`:'<i class="ti ti-photo" aria-hidden="true"></i>'}<div class="lib-count-badge">${it.count}</div></div>
        <div class="lib-card-info"><div class="lib-card-name">${it.name}</div><div class="lib-card-sub">${it.sub}</div></div>
      </div>`).join('')}</div>`;
  } else {
    body.innerHTML=sorted.map(it=>`
      <div class="lib-list-item">
        <div class="lib-list-thumb">${it.thumb?`<img src="data:image/jpeg;base64,${it.thumb}" alt=""/>`:'<i class="ti ti-photo" aria-hidden="true"></i>'}<span class="lib-list-count">${it.count}</span></div>
        <div class="lib-list-info"><div class="lib-list-name">${it.name}</div><div class="lib-list-sub">${it.sub}</div></div>
      </div>`).join('');
  }
}

$('folderBtn').addEventListener('click',()=>showView('vNewFolder'));
$('viewBtn').addEventListener('click',()=>{
  viewMode=viewMode==='grid'?'list':'grid';
  $('viewIco').className=viewMode==='grid'?'ti ti-layout-grid':'ti ti-list-details';
  renderLib();
});
$('sortBtn').addEventListener('click',()=>$('sortOverlay').classList.add('show'));
$('sortCancel').addEventListener('click',()=>$('sortOverlay').classList.remove('show'));
$('sortOverlay').addEventListener('click',e=>{ if(e.target===$('sortOverlay')) $('sortOverlay').classList.remove('show'); });
$('sortSheet').querySelectorAll('.sort-item').forEach(item=>{
  item.addEventListener('click',()=>{
    $('sortSheet').querySelectorAll('.sort-item').forEach(x=>x.classList.remove('active'));
    item.classList.add('active');
    sortBy=item.dataset.sort;
    $('sortOverlay').classList.remove('show');
    renderLib();
  });
});
$('searchBtn').addEventListener('click',()=>{ showView('vSearch'); $('searchResults').innerHTML=''; });

// ── SEARCH ─────────────────────────────────────────────────────────────────
$('searchInput').addEventListener('input',()=>{
  const q=$('searchInput').value.toLowerCase();
  const res=q?docs.filter(d=>d.name.toLowerCase().includes(q)):docs;
  $('searchResults').innerHTML=res.length?res.map(it=>`
    <div class="lib-list-item">
      <div class="lib-list-thumb">${it.thumb?`<img src="data:image/jpeg;base64,${it.thumb}" alt=""/>`:'<i class="ti ti-photo" aria-hidden="true"></i>'}<span class="lib-list-count">${it.count}</span></div>
      <div class="lib-list-info"><div class="lib-list-name">${it.name}</div><div class="lib-list-sub">${it.sub}</div></div>
    </div>`).join(''):'<p style="color:rgba(255,255,255,.3);font-size:13px;padding:20px 0;text-align:center">Ничего не найдено</p>';
});
$('searchClear').addEventListener('click',()=>{ $('searchInput').value=''; $('searchResults').innerHTML=''; });
$('searchCancelBtn').addEventListener('click',()=>{ showView('vLibrary'); renderLib(); });

// ── NEW FOLDER ──────────────────────────────────────────────────────────────
$('nfClear').addEventListener('click',()=>$('nfInput').value='');
$('nfCancel').addEventListener('click',()=>{ showView('vLibrary'); renderLib(); });
$('nfDone').addEventListener('click',()=>{ showView('vLibrary'); renderLib(); });

// ── SETTINGS ───────────────────────────────────────────────────────────────
$('settingsBtn').addEventListener('click',()=>{ showView('vSettings'); renderSettings(); });
$('setBack').addEventListener('click',()=>{ showView('vLibrary'); renderLib(); });

function renderSettings(){
  const k=getKey();
  $('keySubtitle').textContent=k?'Ключ сохранён: '+k.slice(0,12)+'...':'Не задан';
  $('keyInput').value=k||'';
  $('histCountSub').textContent=docs.length+' записей';
}

let keyOpen=false;
$('keyRow').addEventListener('click',()=>{
  keyOpen=!keyOpen;
  $('keyBar').classList.toggle('open',keyOpen);
  $('keyChevron').style.transform=keyOpen?'rotate(180deg)':'';
});
$('keySave').addEventListener('click',()=>{
  const v=$('keyInput').value.trim();
  if(!v.startsWith('sk-ant-')){ $('keyStatus').textContent='Неверный формат. Ключ начинается с sk-ant-'; $('keyStatus').style.color='#f87171'; return; }
  saveKey(v); $('keyStatus').textContent='Сохранено ✓'; $('keyStatus').style.color='#4ade80';
  renderSettings();
  setTimeout(()=>{ keyOpen=false; $('keyBar').classList.remove('open'); $('keyChevron').style.transform=''; },900);
});
$('clearHistBtn').addEventListener('click',()=>{
  if(confirm('Очистить всю историю?')){ docs=[]; try{ localStorage.removeItem('qtz_docs'); }catch(e){} renderSettings(); renderLib(); }
});

// ── API KEY ─────────────────────────────────────────────────────────────────
function getKey(){ try{ return localStorage.getItem('anthropic_key')||''; }catch(e){ return ''; } }
function saveKey(k){ try{ localStorage.setItem('anthropic_key',k.trim()); }catch(e){} }

// ── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg){
  let t=document.getElementById('toast');
  if(!t){
    t=document.createElement('div'); t.id='toast';
    t.style.cssText='position:absolute;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(30,31,42,.97);color:#fff;padding:10px 18px;border-radius:12px;font-size:13px;z-index:200;border:1px solid rgba(255,255,255,.1);white-space:nowrap;pointer-events:none;transition:opacity .3s';
    document.getElementById('app').appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._tid); t._tid=setTimeout(()=>t.style.opacity='0',2500);
}

// ── PWA INSTALL ─────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredInstall=e; });

// ── INIT ────────────────────────────────────────────────────────────────────
showView('vCamera');

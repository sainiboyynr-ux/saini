'use strict';

const USER_IDS = {
  QA_EXEC: 'QA_EXEC',
  STORE_EXEC: 'STORE_EXEC',
  PROD_SUP: 'PROD_SUP',
  IPQA_EXEC: 'IPQA_EXEC'
};

const urlParams = new URLSearchParams(window.location.search);
const bprId = urlParams.get('id') || 'default';
let STORE_KEY = 'bpr_data_v2_' + bprId;
let currentUser = null;
let bprData = loadData();

function defaultData() {
  return {
    header: {
      productName: '', batchSize: '', effectiveDate: '', revisionNo: '02',
      batchNo: '', mfgDate: '', sku: '', mrp: '', shadeNo: '', expiry: ''
    },
    material: Array.from({length: 10}, () => ({
      desc: '', arNo: '', reqQty: '', usedQty: '', rejQty: '', retQty: '', sign: ''
    })),
    lcFields: {
      date: '', shift: '', section: '', lineNo: '', cleanStart: '', cleanEnd: '', prevProduct: '', prevBatch: ''
    },
    clearance: [
      'Remove all packing materials of previous product from the line.',
      'Disconnect power supply before start the cleaning/change over.',
      'Collect all the left over bulk of previous product and segregate it with label.',
      'Clean all the machines as per the laid down procedure to make it perfectly clean.',
      'Check all utility lines are attached.',
      'Check for loose nut bolts & other metal on line before starting production.',
      'Collect all packing material for new product/variant and ensure that it has passed & released by Quality.',
      'Mop the entire floor with water and then dry moping.'
    ].map(desc => ({ desc, prodYes: false, prodNo: false, ipqaYes: false, ipqaNo: false, remarks: '' })),
    lcSigs: { prod: { data: '', date: '' }, ipqa: { data: '', date: '' } },
    codingPacks: [
      { id: 'primary', title: 'Primary Pack (Card)',
        items: [
          {id:'cp_ok', label:'Coding on Primary (OK/Not OK)'},
          {id:'text_ok', label:'Text Matters of Container/Tube (OK/Not OK)'}
        ]
      },
      { id: 'secondary', title: 'Secondary Pack',
        items: [
          {id:'cs_ok', label:'Coding of Card/Carton (OK/Not OK)'},
          {id:'ill_cod', label:'Illegible Coding (F/NF)'},
          {id:'w_cod', label:'Without Coding (F/NF)'},
          {id:'text_card', label:'Text matters of Card/Carton (OK/Not OK)'},
          {id:'seal_bl', label:'Sealing Quality of Blister (OK/Not OK)'},
          {id:'burn_bl', label:'Burn Blister/Card (F/NF)'},
          {id:'miss_comp', label:'Missed Component (F/NF)'}
        ]
      },
      { id: 'inner', title: 'Inner Box',
        items: [
          {id:'ci_ok', label:'Coding of Inner Box (OK/Not OK)'},
          {id:'text_inner', label:'Text Matters of Inner Box (OK/Not OK)'},
          {id:'dam_inner', label:'Damage or Torn Inner Box (F/NF)'},
          {id:'short_pack', label:'Short Packing (F/NF)'},
          {id:'bopp_inner', label:'BOPP Taping on Inner Box (Bottom & Top) (OK/Not OK)'}
        ]
      },
      { id: 'shipper', title: 'Shipper',
        items: [
          {id:'csh_ok', label:'Coding of Shipper (OK/Not OK)'},
          {id:'text_shipper', label:'Text Matters of Shipper (OK/Not OK)'},
          {id:'dam_shipper', label:'Damage or Torn Shipper (F/NF)'},
          {id:'pcs_filled', label:'No. of Pcs. Filled in the Shipper'},
          {id:'short_pack_sh', label:'Short Packing (F/NF)'},
          {id:'bopp_shipper', label:'BOPP Taping on Shipper (Bottom & Top) (OK/Not OK)'}
        ]
      }
    ].map(p => ({ ...p, vals: p.items.reduce((acc, i) => ({...acc, [i.id]: {prod: '', ipqa: ''}}), {}) })),
    ipqcFields: {
      date: '', time: '', section: '', lineNo: '', shift: '',
      appearance: '', odor: '', color: '', foreignParticles: '',
      claimWt: '', miniWt: '', maxWt: ''
    },
    weightObs: Array.from({length: 8}, () => ({
      time: '', wts: Array(10).fill(''), avg: ''
    })),
    pkFields: { lineNo: '', section: '', shift: '' },
    fgTransfer: Array.from({length: 5}, () => ({
      date: '', shift: '', box: '', produced: '', transferred: '', sign: ''
    })),
    completed: { header: false, material: false, clearance: false, coding: false, ipqc: false, fg: false }
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return defaultData();
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(bprData));
}

// ─── LOGIN ────────────────────────────────────────────────────────────

let selectedRole = null;
function selectRole(role) {
  selectedRole = role;
  document.getElementById('login-id').value = role;
  document.querySelectorAll('.role-badge').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.${role.split('_')[0].toLowerCase()}-role`).classList.add('selected');
  document.querySelectorAll('.role-check').forEach(c => c.classList.remove('checked'));
  document.getElementById(`check-${role}`).classList.add('checked');
}

function handleLogin() {
  const val = document.getElementById('login-id').value.trim().toUpperCase();
  if (USER_IDS[val]) {
    document.getElementById('login-error').classList.add('hidden');
    currentUser = val;
    showBprPage();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
}

function handleLogout() {
  showModal('🚪', 'Logout', 'Are you sure you want to log out?', () => {
    currentUser = null;
    document.getElementById('login-id').value = '';
    switchPage('login-page');
  });
}

function switchPage(pid) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pid).classList.add('active');
}

// ─── INIT BPR PAGE ────────────────────────────────────────────────────

function showBprPage() {
  switchPage('bpr-page');
  renderUserBadge();
  if (!bprData.header.mfgDate) bprData.header.mfgDate = new Date().toISOString().split('T')[0];
  
  // Render tables
  renderMaterialTable();
  renderClearanceTable();
  renderCodingPacks();
  renderWeightTable();
  renderPackingTable();
  renderFGTable();
  
  loadForms();
  applyLocks();
  updateStepper();
  initSigs();
  switchTab(0);
}

function renderUserBadge() {
  const map = {
    QA_EXEC: { cls: 'qa', txt: '🟡 QA Exec' },
    STORE_EXEC: { cls: 'store', txt: '🔵 Store Exec' },
    PROD_SUP: { cls: 'prod', txt: '🟠 Prod Sup' },
    IPQA_EXEC: { cls: 'ipqa', txt: '🟣 IPQA Exec' }
  };
  const b = document.getElementById('user-badge');
  b.className = `user-badge ${map[currentUser].cls}`;
  b.textContent = map[currentUser].txt;
  
  document.getElementById('print-btn').classList.toggle('hidden', currentUser !== 'IPQA_EXEC');
}

// ─── TABS ─────────────────────────────────────────────────────────────

function switchTab(idx) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
  
  const hints = [
    "Editing Header fields.", "Editing Material Issue.", "Editing Line Clearance.",
    "Editing Coding Verification.", "Editing IPQC & Weights.", "Editing FG Transfer."
  ];
  document.getElementById('save-info').textContent = hints[idx];
}

// ─── LOCKS & STEPPER ──────────────────────────────────────────────────

function applyLocks() {
  const sections = [
    { id: 'header', roles: ['QA_EXEC'] },
    { id: 'material', roles: ['STORE_EXEC', 'PROD_SUP'] },
    { id: 'clearance', roles: ['PROD_SUP', 'IPQA_EXEC'] },
    { id: 'coding', roles: ['PROD_SUP', 'IPQA_EXEC'] },
    { id: 'ipqc', roles: ['IPQA_EXEC', 'PROD_SUP'] },
    { id: 'fg', roles: ['PROD_SUP'] }
  ];
  
  sections.forEach(sec => {
    const isCompleted = bprData.completed[sec.id];
    const canEditRole = sec.roles.includes(currentUser);
    // Special rules: IPQA can edit coding/clearance verification even if Prod locked it, but let's say if section is "complete" by both, it's locked.
    // For simplicity, if checked 'complete', lock for everyone except IPQA final checks.
    
    let locked = false;
    if (!canEditRole) locked = true;
    if (isCompleted && currentUser !== 'IPQA_EXEC') locked = true;

    document.getElementById(`complete-${sec.id}`).checked = isCompleted;
    
    const pill = document.getElementById(`lock-${sec.id}`);
    if (pill) {
      pill.textContent = locked ? '🔒 View Only' : '✏️ Editable';
      pill.className = `lock-pill ${locked ? 'locked' : ''}`;
    }
    
    // Disable inputs inside that tab panel if locked
    const panel = document.getElementById(`tab-${sections.indexOf(sec)}`);
    if (panel) {
      panel.querySelectorAll('input, select, textarea, canvas').forEach(el => {
        if (el.type === 'checkbox' && el.id.startsWith('complete-')) return;
        
        // Fine-grained field disabling
        if (sec.id === 'material') {
          if (currentUser === 'STORE_EXEC' && el.id.startsWith('mat-sign')) el.disabled = true;
          else if (currentUser === 'PROD_SUP' && !el.id.startsWith('mat-sign')) el.disabled = true;
          else el.disabled = locked;
        } else if (sec.id === 'clearance' || sec.id === 'coding') {
          if (currentUser === 'PROD_SUP' && el.id.includes('ipqa')) el.disabled = true;
          else if (currentUser === 'IPQA_EXEC' && el.id.includes('prod')) el.disabled = true;
          else el.disabled = locked;
        } else {
          el.disabled = locked;
        }
      });
    }
  });

  document.getElementById('finalize-btn').classList.toggle('hidden', currentUser !== 'IPQA_EXEC');
}

function updateStepper() {
  const steps = ['header','material','clearance','coding','ipqc','fg'];
  steps.forEach((s, i) => {
    const dot = document.getElementById(`sdot-${i}`);
    dot.classList.toggle('done', bprData.completed[s]);
  });
}

function markComplete(sec) {
  bprData.completed[sec] = document.getElementById(`complete-${sec}`).checked;
  saveData();
  applyLocks();
  updateStepper();
  showToast('info', 'Section lock status updated.');
}

// ─── DATA BINDING ─────────────────────────────────────────────────────

function updateHeader(key, val) { bprData.header[key] = val; }
function updateLC(key, val) { bprData.lcFields[key] = val; }
function updateIPQC(key, val) { bprData.ipqcFields[key] = val; }
function updatePacking(key, val) { bprData.pkFields[key] = val; }

function loadForms() {
  ['productName','batchSize','effectiveDate','revisionNo','batchNo','mfgDate','sku','mrp','shadeNo','expiry'].forEach(k => {
    const el = document.getElementById(`h-${k.replace(/[A-Z]/g, m => '-'+m.toLowerCase())}`);
    if (el) el.value = bprData.header[k] || '';
  });
  
  ['date','shift','section','lineNo','cleanStart','cleanEnd','prevProduct','prevBatch'].forEach(k => {
    const el = document.getElementById(`lc-${k.toLowerCase()}`);
    if (el) el.value = bprData.lcFields[k] || '';
  });

  ['date','time','section','lineNo','shift','appearance','odor','color','foreignParticles','claimWt','miniWt','maxWt'].forEach(k => {
    const el = document.getElementById(k.includes('Wt') ? `wt-${k.replace('Wt','')}` : `ipqc-${k.toLowerCase()}`);
    if (el) el.value = bprData.ipqcFields[k] || '';
  });

  ['lineNo','section','shift'].forEach(k => {
    const el = document.getElementById(`pk-${k.toLowerCase()}`);
    if (el) el.value = bprData.pkFields[k] || '';
  });
  
  document.getElementById('lc-prod-date').value = bprData.lcSigs.prod.date;
  document.getElementById('lc-ipqa-date').value = bprData.lcSigs.ipqa.date;
}

// ─── TABLES ───────────────────────────────────────────────────────────

function renderMaterialTable() {
  const tbody = document.getElementById('material-body');
  tbody.innerHTML = bprData.material.map((m, i) => `
    <tr>
      <td><span class="row-num">${i+1}</span></td>
      <td><input class="tbl-input" value="${m.desc}" oninput="bprData.material[${i}].desc=this.value" id="mat-desc-${i}"></td>
      <td><input class="tbl-input" value="${m.arNo}" oninput="bprData.material[${i}].arNo=this.value" id="mat-ar-${i}"></td>
      <td><input class="tbl-input" value="${m.reqQty}" oninput="bprData.material[${i}].reqQty=this.value" id="mat-req-${i}"></td>
      <td><input class="tbl-input" value="${m.usedQty}" oninput="bprData.material[${i}].usedQty=this.value" id="mat-use-${i}"></td>
      <td><input class="tbl-input" value="${m.rejQty}" oninput="bprData.material[${i}].rejQty=this.value" id="mat-rej-${i}"></td>
      <td><input class="tbl-input" value="${m.retQty}" oninput="bprData.material[${i}].retQty=this.value" id="mat-ret-${i}"></td>
      <td><input class="tbl-input" value="${m.sign}" oninput="bprData.material[${i}].sign=this.value" id="mat-sign-${i}"></td>
    </tr>
  `).join('');
}

function renderClearanceTable() {
  const tbody = document.getElementById('clearance-body');
  tbody.innerHTML = bprData.clearance.map((c, i) => `
    <tr>
      <td><span class="row-num">${i+1}</span></td>
      <td style="text-align:left">${c.desc}</td>
      <td><input type="checkbox" ${c.prodYes?'checked':''} onchange="bprData.clearance[${i}].prodYes=this.checked;bprData.clearance[${i}].prodNo=false;renderClearanceTable()" id="lc-py-${i}"></td>
      <td><input type="checkbox" ${c.prodNo?'checked':''} onchange="bprData.clearance[${i}].prodNo=this.checked;bprData.clearance[${i}].prodYes=false;renderClearanceTable()" id="lc-pn-${i}"></td>
      <td><input type="checkbox" ${c.ipqaYes?'checked':''} onchange="bprData.clearance[${i}].ipqaYes=this.checked;bprData.clearance[${i}].ipqaNo=false;renderClearanceTable()" id="lc-iy-${i}"></td>
      <td><input type="checkbox" ${c.ipqaNo?'checked':''} onchange="bprData.clearance[${i}].ipqaNo=this.checked;bprData.clearance[${i}].ipqaYes=false;renderClearanceTable()" id="lc-in-${i}"></td>
      <td><input class="tbl-input" value="${c.remarks}" oninput="bprData.clearance[${i}].remarks=this.value" id="lc-rem-${i}"></td>
    </tr>
  `).join('');
}

function renderCodingPacks() {
  const wrap = document.getElementById('coding-packs');
  wrap.innerHTML = bprData.codingPacks.map((pack, pi) => `
    <div class="coding-pack">
      <div class="coding-pack-title">${pack.title}</div>
      <div class="table-wrap">
        <table class="bpr-table">
          <thead><tr><th>Item</th><th>Checked by Prod</th><th>Verified by IPQA</th></tr></thead>
          <tbody>
            ${pack.items.map((item, ii) => `
              <tr>
                <td style="text-align:left">${item.label}</td>
                <td><input class="tbl-input" value="${pack.vals[item.id].prod}" oninput="bprData.codingPacks[${pi}].vals['${item.id}'].prod=this.value" id="cod-prod-${item.id}"></td>
                <td><input class="tbl-input" value="${pack.vals[item.id].ipqa}" oninput="bprData.codingPacks[${pi}].vals['${item.id}'].ipqa=this.value" id="cod-ipqa-${item.id}"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function renderWeightTable() {
  const tbody = document.getElementById('weight-body');
  tbody.innerHTML = bprData.weightObs.map((w, i) => `
    <tr>
      <td><input class="tbl-input" value="${w.time}" oninput="bprData.weightObs[${i}].time=this.value" placeholder="00:00"></td>
      ${w.wts.map((wt, wi) => `
        <td><input class="tbl-input" value="${wt}" oninput="bprData.weightObs[${i}].wts[${wi}]=this.value" style="width:40px"></td>
      `).join('')}
      <td><input class="tbl-input" value="${w.avg}" oninput="bprData.weightObs[${i}].avg=this.value" style="width:50px"></td>
    </tr>
  `).join('');
}

function renderPackingTable() {
  const tableWrap = document.getElementById('packing-table-wrap');
  // Simple table for IPQC Packing Checklist (Primary, Secondary, etc.)
  // Just hardcode a few generic rows to match doc structure
  const rows = [
    { cat: 'Primary', items: ['Broken Container/Tube (F/NF)', 'Cap Fitment (OK/Not OK)', 'Sticker Pasting (OK/Not OK)'] },
    { cat: 'Secondary', items: ['Coding of Card/Carton (OK/Not OK)', 'Missed Component (F/NF)'] }
  ];
  
  if(!bprData.pkList) {
    bprData.pkList = rows.map(r => ({...r, items: r.items.map(i => ({desc: i, prod: '', ipqa: ''}))}));
  }
  
  let html = `<table class="bpr-table"><thead><tr><th>Category</th><th>Checklist Item</th><th>Prod Sup</th><th>IPQA</th></tr></thead><tbody>`;
  bprData.pkList.forEach((cat, ci) => {
    cat.items.forEach((item, ii) => {
      html += `<tr>
        ${ii===0 ? `<td rowspan="${cat.items.length}"><b>${cat.cat}</b></td>` : ''}
        <td style="text-align:left">${item.desc}</td>
        <td><input class="tbl-input" value="${item.prod}" oninput="bprData.pkList[${ci}].items[${ii}].prod=this.value" id="pk-p-${ci}-${ii}"></td>
        <td><input class="tbl-input" value="${item.ipqa}" oninput="bprData.pkList[${ci}].items[${ii}].ipqa=this.value" id="pk-i-${ci}-${ii}"></td>
      </tr>`;
    });
  });
  html += `</tbody></table>`;
  tableWrap.innerHTML = html;
}

function renderFGTable() {
  const tbody = document.getElementById('fg-body');
  tbody.innerHTML = bprData.fgTransfer.map((f, i) => `
    <tr>
      <td><input type="date" class="tbl-input" value="${f.date}" oninput="bprData.fgTransfer[${i}].date=this.value"></td>
      <td><input class="tbl-input" value="${f.shift}" oninput="bprData.fgTransfer[${i}].shift=this.value"></td>
      <td><input class="tbl-input" value="${f.box}" oninput="bprData.fgTransfer[${i}].box=this.value"></td>
      <td><input class="tbl-input" value="${f.produced}" oninput="bprData.fgTransfer[${i}].produced=this.value"></td>
      <td><input class="tbl-input" value="${f.transferred}" oninput="bprData.fgTransfer[${i}].transferred=this.value"></td>
      <td><input class="tbl-input" value="${f.sign}" oninput="bprData.fgTransfer[${i}].sign=this.value"></td>
    </tr>
  `).join('');
}

// ─── SIGNATURES ───────────────────────────────────────────────────────

function initSigs() {
  setupCanvas('lc-prod');
  setupCanvas('lc-ipqa');
}

function setupCanvas(id) {
  const canvas = document.getElementById(`sig-${id}`);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const role = id.includes('prod') ? 'prod' : 'ipqa';
  const stored = bprData.lcSigs[role].data;
  if(stored) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = stored;
  }
  
  let drawing = false;
  
  const canDraw = () => {
    if(id.includes('prod') && currentUser !== 'PROD_SUP') return false;
    if(id.includes('ipqa') && currentUser !== 'IPQA_EXEC') return false;
    return !bprData.completed.clearance;
  };
  
  const getPos = e => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width/r.width, sy = canvas.height/r.height;
    if(e.touches) return {x:(e.touches[0].clientX-r.left)*sx, y:(e.touches[0].clientY-r.top)*sy};
    return {x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy};
  };

  const start = e => { if(!canDraw())return; e.preventDefault(); drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.strokeStyle='#fff'; ctx.lineWidth=2; };
  const draw = e => { if(!drawing||!canDraw())return; e.preventDefault(); const p=getPos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); bprData.lcSigs[role].data = canvas.toDataURL(); };
  const end = () => drawing=false;

  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchmove', draw, {passive:false}); canvas.addEventListener('touchend', end);
}

function clearSig(id) {
  const role = id.includes('prod') ? 'prod' : 'ipqa';
  const canvas = document.getElementById(`sig-${id}`);
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  bprData.lcSigs[role].data = '';
}

// ─── ACTIONS ──────────────────────────────────────────────────────────

function handleSave() {
  // Sync remaining specific inputs
  bprData.lcSigs.prod.date = document.getElementById('lc-prod-date').value;
  bprData.lcSigs.ipqa.date = document.getElementById('lc-ipqa-date').value;
  
  saveData();
  showToast('success', '✅ Progress saved locally.');
}

function handleReset() {
  showModal('🔄', 'Reset Data', 'This will clear all BPR data. Are you sure?', () => {
    bprData = defaultData();
    saveData();
    showBprPage();
  });
}

function handleFinalize() {
  showModal('🏁', 'Submit BPR', 'Generate final PDF and lock entire document?', () => {
    Object.keys(bprData.completed).forEach(k => bprData.completed[k] = true);
    saveData();
    applyLocks();
    updateStepper();
    handlePrint();
  });
}

function handlePrint() {
  window.print();
}

function showToast(type, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => t.classList.add('hidden'), 3000);
}

let mc = null;
function showModal(ic, ti, bo, cb) {
  document.getElementById('modal-icon').textContent=ic;
  document.getElementById('modal-title').textContent=ti;
  document.getElementById('modal-body').textContent=bo;
  mc=cb;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
document.getElementById('modal-confirm-btn').onclick = () => { if(mc)mc(); closeModal(); };

function handleShare() {
  if (currentUser !== 'QA_EXEC') {
    showToast('error', 'Only QA Executive can generate sharing links.');
    return;
  }
  
  if (!bprData.header.batchNo) {
    showToast('error', 'Please enter a Batch No. first to generate a link.');
    return;
  }
  
  const newId = bprData.header.batchNo.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
  const shareUrl = window.location.origin + window.location.pathname + '?id=' + newId;
  
  // Save current data to the new key
  localStorage.setItem('bpr_data_v2_' + newId, JSON.stringify(bprData));
  
  // Update URL without reloading
  window.history.pushState({}, '', shareUrl);
  
  // Update current store key so subsequent saves go to the new ID
  STORE_KEY = 'bpr_data_v2_' + newId;
  
  // Copy to clipboard
  navigator.clipboard.writeText(shareUrl).then(() => {
    showModal('🔗', 'Share Link Generated', 'The link has been copied to your clipboard!\n\n' + shareUrl, () => {});
  }).catch(() => {
    showModal('🔗', 'Share Link Generated', 'Please copy this link:\n\n' + shareUrl, () => {});
  });
}

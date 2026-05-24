// ── SUPABASE CONFIG ──────────────────────────────────────────────
const SUPA_URL = 'https://ctueqxlhbtfzvocwohjf.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dWVxeGxoYnRmenZvY3dvaGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjQyMTMsImV4cCI6MjA5NTE0MDIxM30.VikphOEMgR4QgDOLQkneZWOC2XdgbFvoXyAn1rsDsec';

const HDRS = {
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function supa(path, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: HDRS, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── LOADING BAR ──────────────────────────────────────────────────
function loadStart() {
  const b = document.getElementById('loadingBar');
  if (b) b.className = 'loading-bar active';
}
function loadDone() {
  const b = document.getElementById('loadingBar');
  if (b) { b.className = 'loading-bar done'; setTimeout(() => b.className = 'loading-bar', 400); }
}

// ── TOAST ────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3200);
}

// ── FORMATTING ───────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  const parts = d.split('T')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}
function toInputDate(d) {
  if (!d) return '';
  const s = d.split('T')[0];
  const parts = s.split('-');
  if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return s;
}
function fmtMoney(v) { return Number(v || 0).toFixed(2).replace('.', ','); }

// ── PAGINATION ───────────────────────────────────────────────────
function buildPagination(containerId, currentPage, totalItems, pageSize, onGo) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let btns = `<button class="page-btn" onclick="${onGo}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 3 || i === totalPages - 2) btns += `<span class="page-info">…</span>`;
      continue;
    }
    btns += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onGo}(${i})">${i}</button>`;
  }
  btns += `<button class="page-btn" onclick="${onGo}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
  btns += `<span class="page-info">${totalItems} registros</span>`;
  container.innerHTML = btns;
}

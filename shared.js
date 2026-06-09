// ── SUPABASE CONFIG ──
const SUPA_URL = 'https://ctueqxlhbtfzvocwohjf.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dWVxeGxoYnRmenZvY3dvaGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjQyMTMsImV4cCI6MjA5NTE0MDIxM30.VikphOEMgR4QgDOLQkneZWOC2XdgbFvoXyAn1rsDsec';

const SESSION_KEY = 'sb_session';

// ── SESSION HELPERS ──
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch(e) { return null; }
}
function setSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

function isTokenExpired(session) {
  if (!session || !session.expires_at) return true;
  return session.expires_at * 1000 < Date.now();
}

// ── AUTH GUARD (chame no topo das páginas protegidas) ──
function requireAuth() {
  const s = getSession();
  if (!s || isTokenExpired(s)) {
    clearSession();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── LOGIN / LOGOUT ──
async function loginEmail(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Falha no login');
  setSession(data);
  return data;
}

async function logout() {
  const s = getSession();
  if (s && s.access_token) {
    try {
      await fetch(`${SUPA_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${s.access_token}` }
      });
    } catch(e) {}
  }
  clearSession();
  window.location.href = 'index.html';
}

// ── HEADERS PARA REST ──
function getHeaders() {
  const s = getSession();
  const token = (s && s.access_token) ? s.access_token : SUPA_KEY;
  return {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supa(path, options = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: getHeaders(), ...options });
  if (res.status === 401) {
    clearSession();
    window.location.href = 'index.html';
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── LOADING BAR ──
function loadStart() { const b = document.getElementById('loadingBar'); if (b) b.className = 'loading-bar active'; }
function loadDone()  { const b = document.getElementById('loadingBar'); if (b) { b.className = 'loading-bar done'; setTimeout(() => b.className = 'loading-bar', 400); } }

// ── TOAST ──
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 3200);
}

// ── FORMATTING ──
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

// ── MÊS CONTÁBIL ──
// Regra: o mês de referência X/AAAA cobre o período do dia 5/X até dia 4 do mês X+1.
// Ex: Junho/2026 = 05/06/2026 a 04/07/2026.
const DIA_FECHAMENTO = 5;

function pad2(n) { return String(n).padStart(2, '0'); }

// Recebe "yyyy-mm" (do input month) e devolve { inicio, fim } como "yyyy-mm-dd"
function fiscalRange(mesInput) {
  const [y, m] = mesInput.split('-').map(Number);
  const inicio = `${y}-${pad2(m)}-${pad2(DIA_FECHAMENTO)}`;
  // dia 4 do mês seguinte
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const fim = `${nextY}-${pad2(nextM)}-${pad2(DIA_FECHAMENTO - 1)}`;
  return { inicio, fim };
}

// Recebe uma data ("yyyy-mm-dd" ou Date) e devolve o mês contábil ("yyyy-mm") a que ela pertence.
// Ex: 03/07/2026 ainda pertence a Junho/2026, pois Junho vai até 04/07.
function fiscalMonthOf(dateInput) {
  let y, m, d;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    [y, m, d] = parts.map(Number);
  } else {
    y = dateInput.getFullYear(); m = dateInput.getMonth() + 1; d = dateInput.getDate();
  }
  // Se o dia for menor que o DIA_FECHAMENTO, ainda é o mês anterior
  if (d < DIA_FECHAMENTO) {
    if (m === 1) { y--; m = 12; } else { m--; }
  }
  return `${y}-${pad2(m)}`;
}

// Mês contábil atual (em formato "yyyy-mm" para inputs type=month)
function currentFiscalMonth() {
  return fiscalMonthOf(new Date());
}

// ── PAGINATION ──
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

// ── MENU HAMBÚRGUER (mobile) ──
// Injeta o botão e o overlay, e liga os eventos. Chamado automaticamente.
function setupMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.getElementById('menuToggle')) return;

  const btn = document.createElement('button');
  btn.id = 'menuToggle';
  btn.className = 'menu-toggle';
  btn.setAttribute('aria-label', 'Abrir menu');
  btn.innerHTML = '<span></span>';

  const overlay = document.createElement('div');
  overlay.id = 'sidebarOverlay';
  overlay.className = 'sidebar-overlay';

  function toggle(open) {
    const isOpen = open === undefined ? !sidebar.classList.contains('open') : open;
    sidebar.classList.toggle('open', isOpen);
    overlay.classList.toggle('visible', isOpen);
    btn.classList.toggle('open', isOpen);
  }

  btn.addEventListener('click', () => toggle());
  overlay.addEventListener('click', () => toggle(false));
  // Fecha ao clicar num link da navegação
  sidebar.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => toggle(false)));

  document.body.appendChild(btn);
  document.body.appendChild(overlay);
}

// Chama o setup assim que o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMobileMenu);
} else {
  setupMobileMenu();
}


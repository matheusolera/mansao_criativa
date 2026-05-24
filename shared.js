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

// ── USER INFO + LOGOUT BUTTON ──
function renderUserBar() {
  const s = getSession();
  if (!s || !s.user) return;
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.getElementById('userBar')) return;
  const div = document.createElement('div');
  div.id = 'userBar';
  div.className = 'user-bar';
  const initial = (s.user.email || '?').charAt(0).toUpperCase();
  div.innerHTML = `
    <div class="user-avatar">${initial}</div>
    <div class="user-info">
      <div class="user-email">${s.user.email}</div>
      <button class="user-logout" onclick="logout()">Sair</button>
    </div>
  `;
  sidebar.appendChild(div);
}

/* ============================================================
   DASHBOARD SEMANAL — data.js
   Firebase Firestore + Authentication via SDK compat (CDN)
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDQuwMQwu6ZeikI5Fo0gFaeYHhKU0OQflw",
  authDomain:        "dash-semanal-c6eaf.firebaseapp.com",
  projectId:         "dash-semanal-c6eaf",
  storageBucket:     "dash-semanal-c6eaf.firebasestorage.app",
  messagingSenderId: "630431392747",
  appId:             "1:630431392747:web:a39c918203c80f46c7efae"
};

const COLLECTION = 'dashboard_weekly';
let _db   = null;
let _auth = null;

/* ---- Carrega script externo uma única vez ---- */
function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar SDK: ' + src));
    document.head.appendChild(s);
  });
}

/* ---- Inicializa Firebase (auth + firestore) ---- */
async function _init() {
  if (_db && _auth) return;
  await _loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
  await _loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js');
  await _loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _db   = firebase.firestore();
}

/* ---- Auth: retorna usuário atual ou null ---- */
async function getAuth() {
  await _init();
  return _auth;
}

/* ---- Auth: login com e-mail e senha ---- */
async function login(email, password) {
  await _init();
  await _auth.signInWithEmailAndPassword(email, password);
}

/* ---- Auth: logout ---- */
async function logout() {
  await _init();
  await _auth.signOut();
}

/* ---- Auth: observa mudança de estado ---- */
async function onAuthChange(callback) {
  await _init();
  _auth.onAuthStateChanged(callback);
}

/* ---- Retorna instância do Firestore ---- */
async function getDb() {
  await _init();
  return _db;
}

/* ---- Promise com timeout ---- */
function withTimeout(promise, ms, label) {
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
  );
  return Promise.race([promise, t]);
}

/* ============================================================
   CRUD
   ============================================================ */

async function loadRecords() {
  try {
    const db   = await withTimeout(getDb(), 8000, 'getDb');
    const snap = await withTimeout(db.collection(COLLECTION).get(), 10000, 'loadRecords');
    return snap.docs.map(doc => ({ ...doc.data(), _docId: doc.id }));
  } catch (e) {
    console.error('[data.js] loadRecords:', e);
    showToast('Erro ao carregar: ' + e.message.slice(0, 80), 'error');
    return [];
  }
}

async function upsertRecord(record) {
  try {
    const db = await withTimeout(getDb(), 8000, 'getDb');
    await withTimeout(db.collection(COLLECTION).doc(record.id).set(record), 10000, 'upsert');
    return true;
  } catch (e) {
    console.error('[data.js] upsertRecord:', e);
    showToast('Erro ao salvar: ' + e.message.slice(0, 80), 'error');
    return false;
  }
}

async function deleteRecord(id) {
  try {
    const db = await withTimeout(getDb(), 8000, 'getDb');
    await withTimeout(db.collection(COLLECTION).doc(id).delete(), 10000, 'delete');
    return true;
  } catch (e) {
    console.error('[data.js] deleteRecord:', e);
    showToast('Erro ao excluir: ' + e.message.slice(0, 80), 'error');
    return false;
  }
}

async function getSortedRecords() {
  const records = await loadRecords();
  return [...records].sort((a, b) => {
    if (a.mes !== b.mes) return b.mes.localeCompare(a.mes);
    return Number(b.semana) - Number(a.semana);
  });
}

/* ============================================================
   Utilitários
   ============================================================ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nowFormatted() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  clearTimeout(t._timer);
  requestAnimationFrame(() => {
    t.classList.add('show');
    t._timer = setTimeout(() => t.classList.remove('show'), 4000);
  });
}

function credenciaisOk() { return true; }

/* ============================================================
   Exporta como window.DS
   ============================================================ */
window.DS = {
  login,
  logout,
  onAuthChange,
  getAuth,
  loadRecords,
  upsertRecord,
  deleteRecord,
  getSortedRecords,
  generateId,
  nowFormatted,
  showToast,
  credenciaisOk,
};
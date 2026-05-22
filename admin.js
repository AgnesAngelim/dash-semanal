/* ============================================================
   DASHBOARD SEMANAL — admin.js
   Lógica da tela de preenchimento manual
   Depende de: data.js (window.DS)
   ============================================================ */

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', async () => {
  const veioDoLogin = sessionStorage.getItem('loginOk') === '1';
  sessionStorage.removeItem('loginOk');

  if (!veioDoLogin) {
    try { await DS.logout(); } catch(e) {}
    sessionStorage.setItem('loginDest', 'admin.html');
    window.location.href = 'index.html';
    return;
  }

  // Botão de logout
  if (!document.getElementById('btnLogout')) {
    const headerRight = document.querySelector('.site-header > a');
    if (headerRight) {
      const btn = document.createElement('button');
      btn.id = 'btnLogout';
      btn.textContent = 'Sair';
      btn.style.cssText = 'background:transparent;border:1px solid #334155;color:#64748B;padding:7px 14px;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer;margin-right:8px;';
      btn.onclick = async () => { await DS.logout(); window.location.href = 'index.html'; };
      headerRight.parentNode.insertBefore(btn, headerRight);
    }
  }

  initMesAnoSelects();
  applyDataFieldStates(1);
  await renderRecordsList();
});

/* ---- Helpers de DOM ---- */
const g  = id => document.getElementById(id);
const gv = id => g(id)?.value.trim() ?? '';
const gn = id => parseInt(g(id)?.value) || 0;

/* ---- Inicializa select de anos ---- */
function initMesAnoSelects() {
  const anoSel = g('fMesAno');
  if (!anoSel) return;
  const anoAtual = new Date().getFullYear();
  anoSel.innerHTML = '';
  for (let a = anoAtual + 1; a >= anoAtual - 3; a--) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    if (a === anoAtual) opt.selected = true;
    anoSel.appendChild(opt);
  }
  syncMesField();
}

/* ---- Sincroniza campo oculto fMes ---- */
function syncMesField() {
  const nome = g('fMesNome')?.value || '';
  const ano  = g('fMesAno')?.value  || '';
  const fMes = g('fMes');
  if (fMes) fMes.value = nome && ano ? `${nome} ${ano}` : '';
}
window.syncMesField = syncMesField;

/* ---- Aplica readonly nos campos de data ---- */
function applyDataFieldStates(semana) {
  for (let s = 1; s <= 4; s++) {
    const field = g(`fData${s}`);
    if (!field) continue;
    if (s === semana) {
      field.removeAttribute('readonly');
      field.style.opacity = '1';
      field.style.cursor  = 'text';
    } else {
      field.setAttribute('readonly', true);
      field.style.opacity = '0.5';
      field.style.cursor  = 'not-allowed';
    }
  }
}

/* ---- Atualiza campos de data ao trocar semana ---- */
async function onSemanaChange() {
  const mes    = gv('fMes');
  const semana = parseInt(gv('fSemana')) || 1;

  applyDataFieldStates(semana);

  // Limpa campo da semana atual
  const currentField = g(`fData${semana}`);
  if (currentField) currentField.value = '';

  // Limpa semanas futuras
  for (let s = semana + 1; s <= 4; s++) {
    const field = g(`fData${s}`);
    if (field) field.value = '';
  }

  // Busca datas das semanas anteriores do Firebase
  if (mes) {
    const records = await DS.loadRecords();
    for (let s = 1; s < semana; s++) {
      const prev = records.find(r => r.mes === mes && Number(r.semana) === s);
      const field = g(`fData${s}`);
      if (field) field.value = prev ? (prev[`data${s}`] || prev.dataInicio || '') : '';
    }
  }
}
window.onSemanaChange = onSemanaChange;

/* ---- Renderiza lista de registros salvos ---- */
async function renderRecordsList() {
  const list = g('recordsList');
  const cnt  = g('recordCount');

  list.innerHTML = '<div class="empty-records"><span class="spinner"></span> Carregando...</div>';

  const records = await DS.getSortedRecords();
  cnt.textContent = `${records.length} registro${records.length !== 1 ? 's' : ''}`;

  if (records.length === 0) {
    list.innerHTML = '<div class="empty-records">Nenhum dado cadastrado ainda.</div>';
    return;
  }

  list.innerHTML = records.map(r => `
    <div class="record-item" id="item-${r.id}">
      <div class="record-item-info">
        <div class="record-item-title">
          ${escHtml(r.mes)}
          <span class="badge badge-blue">Semana ${r.semana}</span>
        </div>
        <div class="record-item-sub">
          ${r.dataInicio ? escHtml(r.dataInicio) + ' · ' : ''}
          Ativ: ${r.ativacoes ?? 0} · Cancel: ${r.cancelamentos ?? 0} ·
          Port: ${r.portabilidades ?? 0} · Novas: ${r.novasLinhas ?? 0}
          ${r.updatedAt ? ' · ' + r.updatedAt : ''}
        </div>
      </div>
      <div class="record-item-actions">
        <button class="btn-icon edit" onclick="startEdit('${r.id}')">Editar</button>
        <button class="btn-icon del"  onclick="confirmDelete('${r.id}')">Excluir</button>
      </div>
    </div>`).join('');
}

/* ---- Escape HTML simples ---- */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---- Inicia edição de um registro ---- */
async function startEdit(id) {
  const records = await DS.loadRecords();
  const r = records.find(x => x.id === id);
  if (!r) { DS.showToast('Registro não encontrado.', 'error'); return; }

  g('editId').value = r.id;

  // Preenche dropdowns de mês e ano
  const partesMes = (r.mes || '').split(' ');
  if (g('fMesNome')) g('fMesNome').value = partesMes[0] || '';
  if (g('fMesAno'))  g('fMesAno').value  = partesMes[1] || new Date().getFullYear();
  syncMesField();

  g('fSemana').value = r.semana ?? '1';
  g('fData1').value  = r.data1  ?? '';
  g('fData2').value  = r.data2  ?? '';
  g('fData3').value  = r.data3  ?? '';
  g('fData4').value  = r.data4  ?? '';

  g('fAtivacoes').value      = r.ativacoes      ?? 0;
  g('fCancelamentos').value  = r.cancelamentos  ?? 0;
  g('fPortabilidades').value = r.portabilidades ?? 0;
  g('fNovasLinhas').value    = r.novasLinhas    ?? 0;
  g('fLog').value            = r.log            ?? 0;
  g('fLogEntregue').value    = r.logEntregue    ?? 0;
  g('fLogPago').value        = r.logPago        ?? 0;
  g('fPgCartao').value  = r.pgCartao  ?? 0;
  g('fPgPix').value     = r.pgPix     ?? 0;
  g('fPgVoucher').value = r.pgVoucher ?? 0;

  g('fPortAprovado').value  = r.portAprovado  ?? 0;
  g('fPortAndamento').value = r.portAndamento ?? 0;
  g('fPortNegado').value    = r.portNegado    ?? 0;

  g('fLogEmRota').value     = r.logEmRota     ?? 0;
  g('fLogDevolvido').value  = r.logDevolvido  ?? 0;
  g('fLogEmAberto').value   = r.logEmAberto   ?? 0;
  g('fLogReeenviado').value = r.logReeenviado ?? 0;
  g('fLogAtivo').value      = r.logAtivo      ?? 0;
  g('fLogNaoAtivo').value   = r.logNaoAtivo   ?? 0;

  g('fChipEsim').value   = r.chipEsim   ?? 0;
  g('fChipFisico').value = r.chipFisico ?? 0;

  applyDataFieldStates(Number(r.semana));
  showEditBanner(r.mes, r.semana);
  g('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  DS.showToast(`Editando: ${r.mes} — Semana ${r.semana}`);
}

/* ---- Banner de edição ---- */
function showEditBanner(mes, semana) {
  const banner = g('editBanner');
  if (!banner) return;
  banner.style.display = 'flex';
  g('editBannerText').textContent = `Editando: ${mes} — Semana ${semana}`;
}

function hideEditBanner() {
  const banner = g('editBanner');
  if (banner) banner.style.display = 'none';
}

/* ---- Limpa formulário ---- */
function clearForm() {
  g('editId').value = '';
  if (g('fMesNome')) g('fMesNome').value = '';
  syncMesField();
  g('fSemana').value = '1';

  ['fData1', 'fData2', 'fData3', 'fData4'].forEach(id => {
    const el = g(id);
    if (el) el.value = '';
  });

  [
    'fAtivacoes', 'fCancelamentos', 'fPortabilidades', 'fNovasLinhas', 'fLog', 'fLogEntregue', 'fLogPago',
    'fPgCartao', 'fPgPix', 'fPgVoucher',
    'fPortAprovado', 'fPortAndamento', 'fPortNegado',
    'fLogEmRota', 'fLogDevolvido', 'fLogEmAberto', 'fLogReeenviado',
    'fLogAtivo', 'fLogNaoAtivo', 'fChipEsim', 'fChipFisico'
  ].forEach(id => { const el = g(id); if (el) el.value = ''; });

  hideEditBanner();
  applyDataFieldStates(1);
}

/* ---- Salva registro ---- */
async function saveRecord() {
  const mes    = gv('fMes');
  const semana = parseInt(gv('fSemana')) || 1;

  if (!mes) {
    DS.showToast('Informe o mês de referência.', 'error');
    g('fMesNome').focus();
    return;
  }

  const btn = g('btnSave');
  if (btn) { btn.classList.add('loading'); btn.textContent = 'Salvando...'; }

  const editId     = gv('editId');
  const dataInicio = g(`fData${semana}`)?.value.trim() ?? '';
  const _data1     = g('fData1')?.value.trim() ?? '';
  const _data2     = g('fData2')?.value.trim() ?? '';
  const _data3     = g('fData3')?.value.trim() ?? '';
  const _data4     = g('fData4')?.value.trim() ?? '';

  const record = {
    id: editId || DS.generateId(),
    mes, semana, dataInicio,
    data1: _data1, data2: _data2, data3: _data3, data4: _data4,
    ativacoes:      gn('fAtivacoes'),
    cancelamentos:  gn('fCancelamentos'),
    portabilidades: gn('fPortabilidades'),
    novasLinhas:    gn('fNovasLinhas'),
    log:            gn('fLog'),
    logEmRota:      gn('fLogEmRota'),
    logDevolvido:   gn('fLogDevolvido'),
    logEmAberto:    gn('fLogEmAberto'),
    logReeenviado:  gn('fLogReeenviado'),
    logEntregue:    gn('fLogEntregue'),
    logPago:        gn('fLogPago'),
    logAtivo:       gn('fLogAtivo'),
    logNaoAtivo:    gn('fLogNaoAtivo'),
    pgCartao:       gn('fPgCartao'),
    pgPix:          gn('fPgPix'),
    pgVoucher:      gn('fPgVoucher'),
    portAprovado:   gn('fPortAprovado'),
    portAndamento:  gn('fPortAndamento'),
    portNegado:     gn('fPortNegado'),
    chipEsim:       gn('fChipEsim'),
    chipFisico:     gn('fChipFisico'),
    updatedAt: DS.nowFormatted(),
  };

  const ok = await DS.upsertRecord(record);
  if (btn) { btn.classList.remove('loading'); btn.textContent = '💾 Salvar Dados'; }

  if (ok) {
    DS.showToast(editId ? 'Registro atualizado!' : 'Dados salvos com sucesso!');
    clearForm();
    await renderRecordsList();
  } else {
    DS.showToast('Erro ao salvar. Tente novamente.', 'error');
  }
}

/* ---- Confirma e exclui ---- */
async function confirmDelete(id) {
  if (!confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.')) return;
  const ok = await DS.deleteRecord(id);
  if (ok) {
    DS.showToast('Registro excluído.');
    await renderRecordsList();
    if (gv('editId') === id) clearForm();
  } else {
    DS.showToast('Erro ao excluir.', 'error');
  }
}

/* ---- Expõe funções globais ---- */
window.saveRecord     = saveRecord;
window.clearForm      = clearForm;
window.startEdit      = startEdit;
window.confirmDelete  = confirmDelete;
window.hideEditBanner = hideEditBanner;

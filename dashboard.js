/* ============================================================
   DASHBOARD SEMANAL — dashboard.js
   Lógica da tela de visualização
   Depende de: data.js (window.DS) e Chart.js global
   ============================================================ */

/* ---- Estado ---- */
const chartInstances = {};   // guarda instâncias Chart.js para destruir antes de recriar
let autoRefreshTimer = null;

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', async () => {
  await populateSelector();
  await renderDashboard();
  startAutoRefresh();
});

/* ---- Seletor de período ---- */
async function populateSelector() {
  const sel = document.getElementById('weekSelect');
  const currentVal = sel.value;

  const records = await DS.getSortedRecords();

  sel.innerHTML = '';
  records.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    const dateHint = r.dataInicio ? ` (${r.dataInicio})` : '';
    opt.textContent = `${r.mes} — Semana ${r.semana}${dateHint}`;
    sel.appendChild(opt);
  });

  // Mantém seleção anterior ou seleciona o mais recente
  if (currentVal && sel.querySelector(`option[value="${currentVal}"]`)) {
    sel.value = currentVal;
  } else if (records.length > 0) {
    sel.value = records[0].id;
  }
}

/* ---- Render principal ---- */
async function renderDashboard() {
  const sel      = document.getElementById('weekSelect');
  const content  = document.getElementById('dashContent');
  const noBanner = document.getElementById('noDashData');
  const id       = sel.value;

  if (!id) {
    noBanner.style.display = 'block';
    content.style.display  = 'none';
    destroyAllCharts();
    return;
  }

  const records = await DS.loadRecords();
  const d = records.find(r => r.id === id);

  if (!d) {
    noBanner.style.display = 'block';
    content.style.display  = 'none';
    destroyAllCharts();
    return;
  }

  noBanner.style.display = 'none';
  content.style.display  = 'block';

  // --- Período ---
  document.getElementById('pMonth').textContent = d.mes || '—';
  document.getElementById('pWeek').textContent  = `Semana ${d.semana}`;
  document.getElementById('pDates').textContent = d.dataInicio || '';
  document.getElementById('lastUpdate').textContent =
    d.updatedAt ? `Atualizado: ${d.updatedAt}` : '—';

  // --- KPI: busca semana anterior para comparação ---
  const prevRecord = records.find(r =>
    r.mes === d.mes && Number(r.semana) === Number(d.semana) - 1
  );

  // --- KPIs ---
  document.getElementById('kpiAtivacoesBackOffice').textContent     = d.ativacoesBackOffice    ?? 0;
  document.getElementById('kpiAtivacoesContel').textContent       = d.ativacoesContel        ?? 0;
  document.getElementById('kpiClientesFaltantes').textContent     = d.clientesFaltantes      ?? 0;
  document.getElementById('kpiCancelamentos').textContent  = d.cancelamentos ?? 0;
  document.getElementById('kpiPortabilidades').textContent = d.portabilidades ?? 0;
  document.getElementById('kpiNovasLinhas').textContent    = d.novasLinhas   ?? 0;
  document.getElementById('kpiLogisticaBackOffice').textContent     = d.logBackOffice ?? 0;
  document.getElementById('kpiLogisticaContel').textContent = d.logContel ?? 0;

  // --- Variações ---
  setKpiVariation('varAtivacoesBackOffice',    d.ativacoesBackOffice,     prevRecord?.ativacoesBackOffice);
  setKpiVariation('varAtivacoesContel', d.ativacoesContel, prevRecord?.ativacoesContel);
  setKpiVariation('varClientesFaltantes', d.clientesFaltantes, prevRecord?.clientesFaltantes);
  setKpiVariation('varCancelamentos', d.cancelamentos, prevRecord?.cancelamentos, true);
  setKpiVariation('varPortabilidades',d.portabilidades,prevRecord?.portabilidades);
  setKpiVariation('varNovasLinhas',   d.novasLinhas,   prevRecord?.novasLinhas);
  const logBackOffice     = d.logBackOffice ?? 0;
  const logContel = d.logContel ?? 0;
  const logTotalPrev = prevRecord ? (prevRecord.logBackOffice ?? 0) + (prevRecord.logContel ?? 0) : undefined;
  setKpiVariation('varLogisticaBackOffice', logBackOffice, prevRecord?.logBackOffice);
  setKpiVariation('varLogisticaContel', logContel, prevRecord?.logContel);

  // --- Gráficos ---
  renderDonut('chartPagamento', 'legendPagamento',
    ['Cartão', 'Pix', 'Voucher', 'Bundle'],
    [d.pgCartao ?? 0, d.pgPix ?? 0, d.pgVoucher ?? 0, d.pgBundle ?? 0],
    ['#34D399', '#EC4899', '#8B5CF6', '#06B6D4']
  );

  renderDonut('chartPortStatus', 'legendPortStatus',
    ['Aprovado', 'Em Andamento', 'Negado'],
    [d.portAprovado ?? 0, d.portAndamento ?? 0, d.portNegado ?? 0],
    ['#34D399', '#EC4899', '#8B5CF6']
  );

  renderDonut('chartLogistica', 'legendLogistica',
    ['Em rota', 'Devolvido', 'Em aberto', 'Reenviado', 'Entregue', 'Pago', 'Ativo', 'Não ativo', 'Envios extras'],
    [d.logEmRota ?? 0, d.logDevolvido ?? 0, d.logEmAberto ?? 0, d.logReeenviado ?? 0, d.logEntregue ?? 0, d.logPago ?? 0, d.logAtivo ?? 0, d.logNaoAtivo ?? 0, d.logExtras ?? 0],
    ['#10B981', '#EC4899', '#06B6D4', '#8B5CF6', '#F59E0B', '#84CC16', '#4143e2', '#475569', '#FBBF24']
  );

  renderDonut('chartChip', 'legendChip',
    ['eSIM', 'Físico'],
    [d.chipEsim ?? 0, d.chipFisico ?? 0],
    ['#34D399', '#EC4899']
  );
}

/* ---- Variação de KPI ---- */
function setKpiVariation(elId, current, previous, invertColors = false) {
  const el = document.getElementById(elId);
  if (!el) return;

  if (previous === undefined || previous === null || previous === 0) {
    el.textContent = '';
    el.className = 'kpi-variation';
    return;
  }

  const diff = current - previous;
  const pct  = Math.round((diff / previous) * 100);

  if (pct === 0) {
    el.textContent = '→ 0% vs semana anterior';
    el.className = 'kpi-variation neutral';
    return;
  }

  const arrow = pct > 0 ? '↑' : '↓';
  el.textContent = `${arrow} ${Math.abs(pct)}% vs semana anterior`;
  // invertColors: subir é ruim (vermelho), baixar é bom (verde)
  const isGood = invertColors ? pct < 0 : pct > 0;
  el.className = 'kpi-variation ' + (isGood ? 'up' : 'down');
}

/* ---- Donut helper ---- */
function renderDonut(canvasId, legendId, labels, values, colors) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }

  chartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#0A0F1E',
        borderWidth: 3,
        hoverBorderColor: '#1E293B',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '50%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total ? Math.round(ctx.parsed / total * 100) : 0;
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // Legenda customizada
  const total = values.reduce((a, b) => a + b, 0);
  const legendEl = document.getElementById(legendId);
  if (!legendEl) return;
  legendEl.innerHTML = labels.map((label, i) => {
    const pct = total ? Math.round(values[i] / total * 100) : 0;
    return `
      <span class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-val">${values[i]}</span>
        ${label}
      </span>`;
  }).join('');
}

/* ---- Destroy charts ---- */
function destroyAllCharts() {
  Object.values(chartInstances).forEach(c => c && c.destroy());
  Object.keys(chartInstances).forEach(k => delete chartInstances[k]);
}

/* ---- Auto-refresh só quando há mudança real no Firestore ---- */
function startAutoRefresh() {
  if (autoRefreshTimer) return; // já iniciado
  DS.onAuthChange(async user => {
    if (!user) return;
    const db = await DS.getDb();
    autoRefreshTimer = db.collection('dashboard_weekly').onSnapshot(async () => {
      await populateSelector();
      await renderDashboard();
    });
  });
}

/* ---- Expõe onchange do select para o HTML ---- */
window.onWeekChange = async () => {
  await renderDashboard();
};
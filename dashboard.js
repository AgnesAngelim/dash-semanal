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

  sel.innerHTML = '<option value="">Selecione o período...</option>';
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

  // --- KPIs ---
  document.getElementById('kpiAtivacoes').textContent    = d.ativacoes    ?? 0;
  document.getElementById('kpiCancelamentos').textContent = d.cancelamentos ?? 0;
  document.getElementById('kpiPortabilidades').textContent = d.portabilidades ?? 0;
  document.getElementById('kpiNovasLinhas').textContent   = d.novasLinhas   ?? 0;

  // --- Gráficos ---
  renderDonut('chartPagamento', 'legendPagamento',
    ['Cartão', 'Pix', 'Voucher'],
    [d.pgCartao ?? 0, d.pgPix ?? 0, d.pgVoucher ?? 0],
    ['#10B981', '#06B6D4', '#F59E0B']
  );

  renderDonut('chartPortStatus', 'legendPortStatus',
    ['Aprovado', 'Em Andamento', 'Negado'],
    [d.portAprovado ?? 0, d.portAndamento ?? 0, d.portNegado ?? 0],
    ['#10B981', '#F59E0B', '#EF4444']
  );

  renderDonut('chartLogistica', 'legendLogistica',
    ['Ativos', 'Não Ativos'],
    [d.logAtivo ?? 0, d.logNaoAtivo ?? 0],
    ['#10B981', '#475569']
  );

  renderDonut('chartChip', 'legendChip',
    ['eSIM', 'Físico'],
    [d.chipEsim ?? 0, d.chipFisico ?? 0],
    ['#06B6D4', '#EC4899']
  );
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
      cutout: '70%',
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
        ${label}
        <span class="legend-val">${values[i]}</span>
        <span class="legend-pct">${pct}%</span>
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
/* ==========================================================================
   Verlorene Welten — detail.js (detail.html) — v3 (Feedback-Runde 2)
   ========================================================================== */

let popChart;
let numPop = [];

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(id, value, fallback = '—') {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
}

function formatJahr(n) {
  return Math.round(n).toString(); // niemals Locale-Formatierung -> kein "2.011"
}

function formatZahl(n) {
  // Für die KPI-Kachel: normale deutsche Tausendertrennung ist hier gewünscht (Anzeige der Größenordnung)
  return Math.round(n).toLocaleString('de-DE');
}

function renderThreatCard(b) {
  return `
    <div class="threat-card">
      <span class="sev ${b.schweregrad}">${b.schweregrad || ''}</span>
      <h4>${b.bedrohungsname}</h4>
      <p>${b.kurzbeschreibung || ''}</p>
      ${b.schutzmassnahmen ? `<div class="measures"><strong>Schutzmaßnahme:</strong> ${b.schutzmassnahmen}</div>` : ''}
      ${b.quelle ? `<div class="measures" style="opacity:0.7">Quelle: ${b.quelle}</div>` : ''}
    </div>`;
}

function animiereKpi(elId, von, bis) {
  const el = document.getElementById(elId);
  const dauer = 500;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / dauer);
    const wert = von + (bis - von) * (1 - Math.pow(1 - t, 2));
    el.textContent = formatZahl(wert);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = formatZahl(bis);
  }
  requestAnimationFrame(frame);
}

let letzterAnzahlWert = null;

function updateZeitregler(index) {
  const punkt = numPop[index];
  if (!punkt) return;

  document.getElementById('kpi-jahr').textContent = formatJahr(punkt.jahr);
  animiereKpi('kpi-anzahl', letzterAnzahlWert ?? punkt.wert, punkt.wert);
  letzterAnzahlWert = punkt.wert;

  if (popChart) {
    popChart.data.datasets[1].data = [{ x: punkt.jahr, y: punkt.wert }];
    popChart.update('none');
  }

  document.querySelectorAll('#daten-tabelle tbody tr').forEach((tr, i) => {
    tr.classList.toggle('aktiv', i === index);
  });
}

async function init() {
  const id = qs('id');
  if (!id) { document.getElementById('name-de').textContent = 'Keine Art angegeben.'; return; }

  const modeBtn = document.getElementById('toggle-mode');
  modeBtn.addEventListener('click', () => {
    ThemeManager.toggleMode();
    modeBtn.textContent = ThemeManager.getMode() === 'dark' ? 'Hell' : 'Dunkel';
  });
  modeBtn.textContent = ThemeManager.getMode() === 'dark' ? 'Hell' : 'Dunkel';

  const daten = await ladeArtDetail(id);
  if (!daten) { document.getElementById('name-de').textContent = 'Art nicht gefunden.'; return; }

  const { art, bilder, bedrohungen, populationsdaten } = daten;

  document.documentElement.setAttribute('data-theme', art.typ === 'tier' ? 'tiere' : 'pflanzen');

  const hauptbild = bilder[0]?.url || '';
  document.getElementById('detail-header').style.backgroundImage = `url("${hauptbild}")`;
  setText('name-de', art.name_de);
  setText('name-sci', art.name_wiss, '');
  const badge = document.getElementById('badge-kategorie');
  badge.textContent = `${art.kategorie} — ${art.kategorien?.label || ''}`;
  badge.style.background = art.kategorien?.farbe_hex || '#999';
  document.title = `${art.name_de} — Verlorene Welten`;

  if (bilder.length > 1) {
    document.getElementById('galerie-section').style.display = '';
    document.getElementById('galerie').innerHTML = bilder.slice(1).map(b =>
      `<img src="${b.url}" alt="${art.name_de}" loading="lazy">`).join('');
  }

  setText('botschafter-text', art.botschafter_text, '');
  setText('fact-gruppe', art.gruppe);
  setText('fact-ernaehrung', art.ernaehrung);
  setText('fact-seit', art.existiert_seit);

  if (art.typ === 'pflanze') {
    document.getElementById('fact-sozial-card').remove();
  } else {
    setText('fact-sozial', art.sozialverhalten);
  }

  setText('prose-besonderheiten', art.besonderheiten, 'Keine Angaben hinterlegt.');
  setText('prose-oekologie', art.oekologische_rolle, 'Keine Angaben hinterlegt.');

  // Historische Entwicklung
  numPop = populationsdaten
    .filter(p => p.wert !== null && p.wert !== undefined)
    .map(p => ({ jahr: p.jahr, wert: Number(p.wert), einheit: p.einheit, kontext: p.kontext, quelle: p.quelle }))
    .sort((a, b) => a.jahr - b.jahr);

  const slider = document.getElementById('zeitregler');

  if (numPop.length >= 2) {
    slider.min = 0;
    slider.max = numPop.length - 1;
    slider.step = 1;
    slider.value = 0;
    document.getElementById('jahr-min').textContent = formatJahr(numPop[0].jahr);
    document.getElementById('jahr-max').textContent = formatJahr(numPop[numPop.length - 1].jahr);
  } else {
    slider.disabled = true;
    document.querySelector('.timeline-controls').style.display = 'none';
  }
  slider.addEventListener('input', () => updateZeitregler(Number(slider.value)));

  const ctx = document.getElementById('pop-chart');
  const einheit = numPop[0]?.einheit && !numPop[0].einheit.includes('(') ? numPop[0].einheit : 'Individuen';

  popChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: einheit,
          data: numPop.map(p => ({ x: p.jahr, y: p.wert })),
          borderColor: 'rgb(25,138,188)',
          backgroundColor: 'rgba(25,138,188,0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointBackgroundColor: 'rgb(25,138,188)',
        },
        {
          label: 'Ausgewähltes Jahr',
          data: [],
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 8,
          pointHitRadius: 0,
          backgroundColor: '#e0453a',
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      events: ['mousemove', 'mouseout'],
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Jahre' },
          ticks: { stepSize: 1, callback: (value) => formatJahr(value) },
        },
        y: { title: { display: true, text: 'Individuen' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            // Ohne diesen Override formatiert Chart.js die x-Achse Locale-abhängig -> "2.011" statt "2011"
            title: (items) => 'Jahr ' + formatJahr(items[0].parsed.x),
          },
        },
      },
      interaction: { intersect: false, mode: 'nearest' },
    },
  });

  // Quellen-/Datentabelle
  const tbody = document.querySelector('#daten-tabelle tbody');
  tbody.innerHTML = numPop.map(p => `
    <tr>
      <td class="jahr">${formatJahr(p.jahr)}</td>
      <td>${p.kontext || '—'}</td>
      <td class="quelle">${p.quelle || '—'}</td>
    </tr>`).join('');

  if (numPop.length >= 2) {
    updateZeitregler(0);
  } else if (numPop.length === 1) {
    popChart.data.datasets[1].data = [{ x: numPop[0].jahr, y: numPop[0].wert }];
    popChart.update();
    document.getElementById('kpi-jahr').textContent = formatJahr(numPop[0].jahr);
    document.getElementById('kpi-anzahl').textContent = formatZahl(numPop[0].wert);
  } else {
    document.querySelector('.kpi-row').style.display = 'none';
    document.querySelector('.pop-chart-wrap').style.display = 'none';
  }

  document.getElementById('threat-cards').innerHTML =
    bedrohungen.map(renderThreatCard).join('') || '<p>Keine Bedrohungsdaten hinterlegt.</p>';

  setText('schutz-name', art.schutzprojekt_name);
  setText('schutz-text', art.hauptbedrohung ? `Hauptbedrohung: ${art.hauptbedrohung}` : '', '');
  const schutzLink = document.getElementById('schutz-link');
  if (art.schutzprojekt_url) { schutzLink.href = art.schutzprojekt_url; } else { schutzLink.style.display = 'none'; }
  const iucnLink = document.getElementById('iucn-link');
  if (art.iucn_url) { iucnLink.href = art.iucn_url; } else { iucnLink.style.display = 'none'; }

  document.getElementById('content').style.display = '';
}

init();

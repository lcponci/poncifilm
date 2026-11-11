// Strumenti generici per costruire l'interfaccia.

// Crea un elemento: h('div', { class: 'x', onclick: f }, 'testo', altroElemento)
export function h(tag, attributi, ...figli) {
  const el = document.createElement(tag);
  for (const [nome, valore] of Object.entries(attributi || {})) {
    if (valore == null || valore === false) continue;
    if (nome === 'class') el.className = valore;
    else if (nome === 'style' && typeof valore === 'object') Object.assign(el.style, valore);
    else if (nome.startsWith('on') && typeof valore === 'function') el.addEventListener(nome.slice(2), valore);
    else el.setAttribute(nome, valore === true ? '' : valore);
  }
  aggiungiFigli(el, figli);
  return el;
}

function aggiungiFigli(el, figli) {
  for (const figlio of figli.flat(Infinity)) {
    if (figlio == null || figlio === false || figlio === true || figlio === '') continue;
    el.append(figlio instanceof Node ? figlio : String(figlio));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONE = {
  libreria: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  aggiungi: '<path d="M12 5v14M5 12h14"/>',
  impostazioni: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  indietro: '<path d="M15 18l-6-6 6-6"/>',
  spunta: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  segnalibro: '<path d="M7 4h10v16l-5-4-5 4z"/>',
  chiudi: '<path d="M6 6l12 12M18 6L6 18"/>',
  ripeti: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
};

export function icona(nome, classe = 'icona') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', classe);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICONE[nome] || '';
  return svg;
}

// Messaggio breve in basso ("Aggiunto alla Watchlist").
let timerAvviso = null;
export function avviso(testo, { azione } = {}) {
  const box = document.getElementById('avvisi');
  const nascondi = () => box.classList.remove('visibile');
  box.replaceChildren(h('span', null, testo));
  if (azione) box.append(h('a', { href: azione.href, onclick: nascondi }, azione.testo));
  box.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(nascondi, azione ? 4500 : 2500);
}

// Pannello che sale dal basso.
export function apriFoglio(contenuto) {
  const velo = h('div', { class: 'velo' });
  const pannello = h('div', { class: 'foglio', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'maniglia' }), contenuto);
  const tasto = e => { if (e.key === 'Escape') chiudi(); };
  function chiudi() {
    velo.remove();
    pannello.remove();
    document.removeEventListener('keydown', tasto);
    window.removeEventListener('hashchange', chiudi);
  }
  velo.addEventListener('click', chiudi);
  document.addEventListener('keydown', tasto);
  window.addEventListener('hashchange', chiudi);
  document.body.append(velo, pannello);
  return { chiudi };
}

export function vuoto(...contenuto) {
  return h('div', { class: 'vuoto' }, ...contenuto);
}

// ---------------------------------------------------------------- formati

const formatoData = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

export function formattaData(iso) {
  if (!iso) return '';
  // Data con ora (es. "2026-11-11T21:30:00Z"): la mostro nel fuso orario locale.
  if (iso.length > 10) {
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? '' : formatoData.format(data);
  }
  const [anno, mese, giorno] = iso.slice(0, 10).split('-').map(Number);
  if (!anno) return '';
  return formatoData.format(new Date(anno, (mese || 1) - 1, giorno || 1));
}

export function formattaDurata(minuti) {
  if (!minuti) return '';
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (!ore) return `${resto} min`;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}

let nomiPaesi = null;
export function nomePaese(codice) {
  try {
    nomiPaesi ??= new Intl.DisplayNames(['it'], { type: 'region' });
    return nomiPaesi.of(codice) || codice;
  } catch {
    return codice;
  }
}

// Minuscole e senza accenti, per cercare "perche" e trovare "Perché".
export function normalizza(testo) {
  return (testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function stelle(voto, classe = 'stelle') {
  if (!voto) return null;
  return h('span', { class: classe, 'aria-label': `${voto} stelle su 5` }, '★'.repeat(voto) + '☆'.repeat(5 - voto));
}

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
  matita: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  medaglia: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
  nuvola: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/>',
  scarica: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  chiave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  casa: '<path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
  cerca: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  avanti: '<path d="M9 6l6 6-6 6"/>',
  importa: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v6h14v-6"/>',
  mensola: '<path d="M3 20.5h18"/><rect x="4.5" y="7" width="4" height="13.5" rx=".8"/><rect x="10" y="4.5" width="4" height="16" rx=".8"/><path d="M15.6 8.4l3.6-1 3 12.4-3.6 1z"/>',
  foto: '<rect x="3.5" y="5.5" width="17" height="14" rx="2"/><circle cx="9" cy="10.5" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
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
// azione: un collegamento ({ testo, href }) oppure un comando ({ testo, fai }), es. "Annulla".
let timerAvviso = null;
export function avviso(testo, { azione } = {}) {
  const box = document.getElementById('avvisi');
  const nascondi = () => box.classList.remove('visibile');
  box.replaceChildren(h('span', null, testo));
  if (azione?.href) box.append(h('a', { href: azione.href, onclick: nascondi }, azione.testo));
  else if (azione?.fai) {
    box.append(h('button', { type: 'button', onclick: () => { nascondi(); azione.fai(); } }, azione.testo));
  }
  box.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(nascondi, azione ? 4500 : 2500);
}

// Pannello che sale dal basso.
// alChiudere: funzione chiamata quando il pannello si chiude (es. per salvare).
export function apriFoglio(contenuto, { alChiudere } = {}) {
  const velo = h('div', { class: 'velo' });
  const pannello = h('div', { class: 'foglio', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'maniglia' }), contenuto);
  const tasto = e => { if (e.key === 'Escape') chiudi(); };
  function chiudi() {
    if (!pannello.isConnected) return;
    alChiudere?.();
    velo.remove();
    pannello.remove();
    document.removeEventListener('keydown', tasto);
    window.removeEventListener('hashchange', chiudi);
  }
  velo.addEventListener('click', chiudi);
  document.addEventListener('keydown', tasto);
  window.addEventListener('hashchange', chiudi);
  trascinaPerChiudere(pannello, velo, chiudi);
  document.body.append(velo, pannello);
  return { chiudi };
}

// Trascinando il pannello verso il basso (quando è già scorso fino in cima) si chiude,
// come nelle app dell'iPhone. Se lo lasci prima, torna al suo posto.
function trascinaPerChiudere(pannello, velo, chiudi) {
  let inizioY = null;
  let inizioTempo = 0;
  let spostamento = 0;
  let trascinando = false;

  const torna = () => {
    pannello.style.transition = 'transform .18s ease-out';
    velo.style.transition = 'opacity .18s';
    pannello.style.transform = '';
    velo.style.opacity = '';
  };

  pannello.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { inizioY = null; return; }
    inizioY = e.touches[0].clientY;
    inizioTempo = Date.now();
    spostamento = 0;
    trascinando = false;
  }, { passive: true });

  pannello.addEventListener('touchmove', e => {
    if (inizioY === null) return;
    const y = e.touches[0].clientY - inizioY;
    if (!trascinando) {
      if (Math.abs(y) < 8) return;
      // Verso l'alto, o con il contenuto non in cima: è un normale scorrimento.
      if (y < 0 || pannello.scrollTop > 0) { inizioY = null; return; }
      trascinando = true;
      document.activeElement?.blur?.(); // chiude la tastiera, se aperta
      pannello.style.transition = 'none';
      velo.style.transition = 'none';
    }
    spostamento = Math.max(0, y);
    pannello.style.transform = `translateY(${spostamento}px)`;
    velo.style.opacity = String(Math.max(0.2, 1 - spostamento / 400));
    e.preventDefault();
  }, { passive: false });

  const fine = () => {
    if (!trascinando) { inizioY = null; return; }
    const veloce = spostamento / Math.max(1, Date.now() - inizioTempo) > 0.6;
    if (spostamento > 110 || (veloce && spostamento > 40)) {
      pannello.style.transition = 'transform .2s ease-in';
      velo.style.transition = 'opacity .2s';
      pannello.style.transform = 'translateY(100%)';
      velo.style.opacity = '0';
      setTimeout(chiudi, 200);
    } else {
      torna();
    }
    inizioY = null;
    trascinando = false;
  };
  pannello.addEventListener('touchend', fine);
  pannello.addEventListener('touchcancel', fine);
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

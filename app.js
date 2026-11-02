'use strict';
// Seuils : arrêté du 21 décembre 2009, annexe I (températures maximales) ; GBPH Restaurateur pour les couples temps/température.
const CATS = [
  ['vh', 'Viandes hachées', 2], ['vsm', 'Viandes séparées mécaniquement', 2], ['peche', 'Produits de la pêche frais, crustacés et mollusques cuits', 2],
  ['abats', 'Abats', 3], ['prep', 'Préparations culinaires élaborées à l\'avance', 3], ['pv', 'Préparations de viandes', 4],
  ['vol', 'Volailles, lapin, petit gibier', 4], ['ovo', 'Ovoproduits (hors UHT)', 4], ['laitcru', 'Lait cru', 4],
  ['tp', 'Autres denrées très périssables', 4], ['decoupe', 'Viandes : morceaux de découpe', 4], ['carc', 'Viandes : carcasses et pièces de gros', 7],
  ['per', 'Autres denrées périssables', 8], ['fab', 'Lait pasteurisé, fromages affinés (T° du fabricant)', null],
  ['glace', 'Glaces et crèmes glacées', -18], ['vhcong', 'Viandes hachées et préparations congelées', -18], ['pcong', 'Produits de la pêche congelés', -18],
  ['surg', 'Surgelés', -18], ['cong', 'Autres denrées congelées', -12], ['sec', 'Épicerie sèche', null],
];
const cat = k => CATS.find(c => c[0] === k);
const enceintes = () => (R._settings.enceintes || 'Chambre froide positive ; 3\nFrigo ligne ; 4\nCongélateur ; -18')
  .split('\n').map(l => l.split(';').map(s => s.trim())).filter(a => a[0]).map(([n, c]) => ({ n, c: Number(c) }));
const friteuses = () => (R._settings.friteuses || 'Friteuse 1').split('\n').map(s => s.trim()).filter(Boolean);
const mins = (a, b) => (new Date(b) - new Date(a)) / 60000;
const ACTION = { k: 'action', label: 'Action corrective', type: 'textarea', help: 'Obligatoire si non conforme : produit écarté, réglage, appel du frigoriste…' };

const TYPES = [
  { id: 'jour', label: 'Aujourd\'hui', short: 'Aujourd\'hui', icon: '◉', fields: [], custom: today },
  {
    id: 'froid', label: 'Température des enceintes froides', short: 'Froid', icon: '❄', needsAction: 'action',
    intro: 'Un relevé par enceinte, au moins matin et soir. La consigne se règle dans Réglages.',
    fields: [
      { k: 'enceinte', label: 'Enceinte', type: 'select', required: true, options: () => enceintes().map(e => [e.n, `${e.n} (≤ ${e.c} °C)`]) },
      { k: 't', label: 'Température relevée', type: 'number', unit: '°C', required: true },
      ACTION],
    check: d => { const e = enceintes().find(x => x.n === d.enceinte); if (!e || d.t == null) return null;
      return d.t <= e.c ? { ok: true, msg: `Conforme (≤ ${e.c} °C)` } : { ok: false, msg: `Non conforme : ${d.t} °C pour une consigne de ${e.c} °C` }; },
    summary: d => `${d.enceinte} : ${d.t} °C`,
    cols: [['Enceinte', d => d.enceinte], ['T° (°C)', d => d.t], ['Action corrective', d => d.action]],
  },
  {
    id: 'reception', label: 'Réception des marchandises', short: 'Réception', icon: '⇣', needsAction: 'action',
    fields: [
      { k: 'fournisseur', label: 'Fournisseur', required: true },
      { k: 'produit', label: 'Produit', required: true },
      { k: 'cat', label: 'Catégorie', type: 'select', required: true, options: CATS.map(c => [c[0], c[2] == null ? c[1] : `${c[1]} (≤ ${c[2]} °C)`]) },
      { k: 't', label: 'Température à cœur ou en surface', type: 'number', unit: '°C', showIf: d => !(cat(d.cat) && cat(d.cat)[2] == null) },
      { k: 'lot', label: 'N° de lot' },
      { k: 'dlc', label: 'DLC ou DDM', type: 'date' },
      { k: 'emballage', label: 'Emballage intact et étiquetage lisible', type: 'bool' },
      { k: 'photo', label: 'Photo de l\'étiquette ou du bon de livraison', type: 'photo' },
      { k: 'decision', label: 'Décision', type: 'select', required: true, options: ['Accepté', 'Accepté avec réserve', 'Refusé'] },
      ACTION],
    check: d => {
      const c = cat(d.cat); if (!c) return null;
      const pb = [];
      if (c[2] != null && d.t != null && d.t > c[2]) pb.push(`${d.t} °C au-dessus du maximum de ${c[2]} °C`);
      if (!d.emballage) pb.push('emballage ou étiquetage à vérifier');
      if (d.dlc && d.dlc < R.today()) pb.push('DLC dépassée');
      return pb.length ? { ok: false, msg: 'Non conforme : ' + pb.join(', ') } : { ok: true, msg: 'Conforme' };
    },
    summary: d => `${d.produit} · ${d.fournisseur}${d.t != null ? ' · ' + d.t + ' °C' : ''} · ${d.decision}`,
    cols: [['Fournisseur', d => d.fournisseur], ['Produit', d => d.produit], ['Cat.', d => (cat(d.cat) || [, d.cat])[1]], ['T°', d => d.t], ['Lot', d => d.lot],
      ['DLC/DDM', d => R.fmtD(d.dlc)], ['Décision', d => d.decision], ['Action', d => d.action]],
  },
  {
    id: 'refroid', label: 'Refroidissement rapide', short: 'Refroid.', icon: '↘', needsAction: 'action',
    intro: 'Passer de +63 °C à moins de +10 °C à cœur en 2 heures au plus, puis stocker entre 0 et +3 °C.',
    fields: [
      { k: 'produit', label: 'Préparation', required: true }, { k: 'lot', label: 'Lot ou date de fabrication' },
      { k: 'h0', label: 'Début', type: 'datetime', required: true, now: true }, { k: 't0', label: 'T° à cœur au début', type: 'number', unit: '°C', required: true },
      { k: 'h1', label: 'Fin', type: 'datetime' }, { k: 't1', label: 'T° à cœur à la fin', type: 'number', unit: '°C' }, ACTION],
    check: d => { if (d.t1 == null || !d.h1) return { ok: true, msg: 'Début enregistré : complétez la fin par une rectification.' };
      const m = mins(d.h0, d.h1); const pb = [];
      if (d.t1 >= 10) pb.push(`${d.t1} °C à la fin (objectif < 10 °C)`);
      if (m > 120) pb.push(`${Math.round(m)} min (maximum 120)`);
      return pb.length ? { ok: false, msg: 'Non conforme : ' + pb.join(', ') } : { ok: true, msg: `Conforme : ${Math.round(m)} min` }; },
    summary: d => `${d.produit} · ${d.t0} → ${d.t1 ?? '…'} °C`,
    cols: [['Préparation', d => d.produit], ['Lot', d => d.lot], ['Début', d => R.fmtDT(d.h0)], ['T° début', d => d.t0], ['Fin', d => d.h1 && R.fmtDT(d.h1)], ['T° fin', d => d.t1], ['Action', d => d.action]],
  },
  {
    id: 'remise', label: 'Remise en température', short: 'Remise T°', icon: '↗', needsAction: 'action',
    intro: 'Atteindre +63 °C à cœur en moins d\'une heure ; à consommer le jour même.',
    fields: [
      { k: 'produit', label: 'Préparation', required: true },
      { k: 'h0', label: 'Début', type: 'datetime', required: true, now: true }, { k: 't0', label: 'T° de départ', type: 'number', unit: '°C', required: true },
      { k: 'h1', label: 'Heure où +63 °C est atteint', type: 'datetime' }, { k: 't1', label: 'T° atteinte', type: 'number', unit: '°C' }, ACTION],
    check: d => { if (d.t1 == null || !d.h1) return null; const m = mins(d.h0, d.h1); const pb = [];
      if (d.t1 < 63) pb.push(`${d.t1} °C (minimum 63 °C)`); if (m > 60) pb.push(`${Math.round(m)} min (maximum 60)`);
      return pb.length ? { ok: false, msg: 'Non conforme : ' + pb.join(', ') } : { ok: true, msg: `Conforme : ${Math.round(m)} min` }; },
    summary: d => `${d.produit} · ${d.t1 ?? '…'} °C`,
  },
  {
    id: 'chaud', label: 'Maintien au chaud', short: 'Chaud', icon: '♨', needsAction: 'action',
    fields: [{ k: 'produit', label: 'Préparation', required: true }, { k: 't', label: 'Température', type: 'number', unit: '°C', required: true }, ACTION],
    check: d => d.t == null ? null : d.t >= 63 ? { ok: true, msg: 'Conforme (≥ 63 °C)' } : { ok: false, msg: `Non conforme : ${d.t} °C (minimum 63 °C)` },
    summary: d => `${d.produit} : ${d.t} °C`,
  },
  {
    id: 'huile', label: 'Huiles de friture', short: 'Huiles', icon: '◍', needsAction: 'action',
    intro: 'Huile impropre au-delà de 25 % de composés polaires (décret 2008-184).',
    fields: [{ k: 'friteuse', label: 'Friteuse', type: 'select', required: true, options: friteuses },
      { k: 'tpm', label: 'Composés polaires (TPM)', type: 'number', unit: '%' }, { k: 'change', label: 'Huile changée', type: 'bool' }, ACTION],
    check: d => d.tpm == null ? (d.change ? { ok: true, msg: 'Changement enregistré' } : null)
      : d.tpm <= 25 || d.change ? { ok: true, msg: d.tpm > 25 ? 'Huile changée' : 'Conforme (≤ 25 %)' } : { ok: false, msg: `Non conforme : ${d.tpm} %, changez l'huile` },
    summary: d => `${d.friteuse}${d.tpm != null ? ' · ' + d.tpm + ' %' : ''}${d.change ? ' · huile changée' : ''}`,
  },
  {
    id: 'nettoyage', label: 'Nettoyage et désinfection', short: 'Nettoyage', icon: '✧',
    fields: [{ k: 'zone', label: 'Zone ou équipement', type: 'select', required: true, options: () => (R._settings.zones || 'Plans de travail\nChambre froide\nSols cuisine\nHotte\nTrancheuse').split('\n').map(s => s.trim()).filter(Boolean) },
      { k: 'produit', label: 'Produit utilisé' }, { k: 'verif', label: 'Vérification visuelle satisfaisante', type: 'bool' }, { k: 'obs', label: 'Observations', type: 'textarea' }],
    check: d => d.verif ? { ok: true, msg: 'Fait' } : { ok: false, msg: 'Vérification non satisfaisante' },
    summary: d => `${d.zone}${d.produit ? ' · ' + d.produit : ''}`,
  },
  {
    id: 'temoin', label: 'Plats témoins', short: 'Témoins', icon: '▣',
    intro: 'Restauration collective : 80 à 100 g par plat, conservés au moins 5 jours entre 0 et +3 °C.',
    fields: [{ k: 'plat', label: 'Plat', required: true }, { k: 'service', label: 'Service', type: 'select', options: ['Déjeuner', 'Dîner', 'Autre'] },
      { k: 'date', label: 'Date du service', type: 'date', required: true, now: true }],
    summary: d => `${d.plat} · ${R.fmtD(d.date)} · à détruire après le ${R.fmtD(addDays(d.date, 5))}`,
    cols: [['Plat', d => d.plat], ['Service', d => d.service], ['Date', d => R.fmtD(d.date)], ['Destruction possible après', d => R.fmtD(addDays(d.date, 5))]],
  },
  {
    id: 'nuisibles', label: 'Lutte contre les nuisibles', short: 'Nuisibles', icon: '⌖',
    fields: [{ k: 'qui', label: 'Prestataire ou intervenant', required: true }, { k: 'constat', label: 'Constat', type: 'textarea' }, { k: 'action', label: 'Actions', type: 'textarea' }],
    summary: d => `${d.qui}${d.constat ? ' · ' + d.constat : ''}`,
  },
  {
    id: 'nc', label: 'Non-conformité et action', short: 'Incident', icon: '!',
    intro: 'Tout incident hors relevés : panne, livraison refusée, plainte client, coupure de courant.',
    fields: [{ k: 'quoi', label: 'Non-conformité constatée', type: 'textarea', required: true }, { k: 'action', label: 'Action corrective', type: 'textarea', required: true },
      { k: 'suivi', label: 'Vérification de l\'efficacité', type: 'textarea' }],
    check: () => ({ ok: false, msg: 'Non-conformité déclarée' }),
    summary: d => d.quoi,
  },
  {
    id: 'formation', label: 'Formation hygiène du personnel', short: 'Formation', icon: '✎',
    intro: 'Au moins une personne formée par établissement (14 h, organisme habilité), sauf dispense.',
    fields: [{ k: 'nom', label: 'Nom', required: true }, { k: 'orga', label: 'Organisme ou dispense' }, { k: 'date', label: 'Date', type: 'date' },
      { k: 'photo', label: 'Attestation (photo)', type: 'photo' }],
    summary: d => `${d.nom} · ${d.orga || ''} ${R.fmtD(d.date)}`,
  },
];
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function today() {
  const { h } = R; const t = R.today();
  const todays = R.cache.filter(e => !e.corrects && e.ts.slice(0, 10) === t);
  const box = h('div', {});
  const ench = enceintes().map(e => {
    const n = todays.filter(x => x.type === 'froid' && x.data.enceinte === e.n);
    const nc = n.some(x => x.conf === false);
    return h('button', { class: 'tile' + (nc ? ' nc' : ''), onclick: () => { R.view.tab = 'froid'; R.render(); } },
      h('b', {}, n.length ? `${n[n.length - 1].data.t} °C` : '—'), e.n, h('div', { class: 'small' }, `${n.length} relevé${n.length > 1 ? 's' : ''} aujourd'hui · ≤ ${e.c} °C`));
  });
  box.append(h('div', { class: 'card' }, h('h2', {}, 'Enceintes froides'), h('div', { class: 'grid' }, ench)));
  const ncs = R.cache.filter(e => e.conf === false && !e.corrects && e.ts.slice(0, 10) >= addDays(t, -7));
  box.append(h('div', { class: 'card' }, h('h2', {}, 'Non-conformités des 7 derniers jours'),
    ncs.length ? ncs.reverse().map(e => h('div', { class: 'item nc' }, h('div', { class: 'meta' }, `n° ${e.seq} · ${R.fmtDT(e.ts)} · ${TYPES.find(x => x.id === e.type).label}`),
      h('div', {}, (TYPES.find(x => x.id === e.type).summary || (d => ''))(R.effective(e))), e.data.action ? h('div', { class: 'small' }, 'Action : ' + e.data.action) : ''))
      : h('p', { class: 'muted' }, 'Aucune.')));
  const counts = TYPES.filter(x => !x.custom).map(T => [T, todays.filter(e => e.type === T.id).length]).filter(x => x[1]);
  box.append(h('div', { class: 'card' }, h('h2', {}, 'Saisies du jour'),
    counts.length ? h('div', { class: 'grid' }, counts.map(([T, n]) => h('button', { class: 'tile', onclick: () => { R.view.tab = T.id; R.render(); } }, h('b', {}, n), T.label)))
      : h('p', { class: 'muted' }, 'Rien de saisi aujourd\'hui.')));
  box.append(h('div', { class: 'card' }, h('h2', {}, 'Le jour du contrôle'),
    h('p', {}, 'Ouvrez « Registre », choisissez la période, puis « Imprimer / PDF ». Chaque écriture est horodatée, signée de son opérateur et chaînée à la précédente : une modification après coup se voit, une erreur se rectifie par une nouvelle écriture qui laisse l\'originale visible.')));
  return box;
}

R._settings = {};
R.start({
    id: 'reglet-haccp', name: 'Reglet HACCP', registerTitle: 'Plan de maîtrise sanitaire · enregistrements', registerLabel: 'Registre',
    types: TYPES, demoLimit: 60, price: '79 € TTC', buyUrl: 'https://payhip.com/b/ji4W6',
    publicKey: 'ac0tXLjtqH1cqcCNliweBFikVKUlNzyK0raG5lNviH4',
    settings: [
      { k: 'nom', label: 'Établissement' }, { k: 'adresse', label: 'Adresse' }, { k: 'siret', label: 'SIRET' },
      { k: 'resp', label: 'Responsable du plan de maîtrise sanitaire' },
      { k: 'enceintes', label: 'Enceintes froides : une par ligne, « nom ; température maximale »', type: 'textarea', help: 'Ex. Chambre froide positive ; 3' },
      { k: 'friteuses', label: 'Friteuses : une par ligne', type: 'textarea' },
      { k: 'zones', label: 'Zones de nettoyage : une par ligne', type: 'textarea' },
    ],
    onSettings: s => { R._settings = s; },
});

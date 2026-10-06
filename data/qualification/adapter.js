'use strict';
// Reguły kwalifikacji i nominacji (qualification-2026.json) – funkcje pomocnicze dla gry.
// Przeglądarka: SpeedwayQualification. Node: require('./adapter.js'). Bez globali gry: dane zawodników przekazuje się w opcjach.
(function (root) {
  // Zawody po kodzie z COMPS – także kod etapu (np. IMPE → IMP, etap elim)
  function competition(pack, code) {
    if (pack.competitions[code]) return pack.competitions[code];
    return Object.values(pack.competitions).find(c => c.stages.some(s => s.comp === code)) || null;
  }
  function stage(pack, code, stageId) {
    const c = competition(pack, code);
    if (!c) return null;
    if (stageId) return c.stages.find(s => s.id === stageId) || null;
    return c.stages.find(s => s.comp === code) || c.stages[c.stages.length - 1];
  }
  const asList = x => (Array.isArray(x) ? x : [x]);
  // Ścieżki nominacji wychodzące z zawodów (np. ZK → SGPQ, SECQ) i prowadzące do nich
  function pathwaysFrom(pack, code) { return pack.pathways.filter(p => p.from.comp === code); }
  function pathwaysTo(pack, code) { return pack.pathways.filter(p => asList(p.to).some(t => t.comp === code)); }
  // Wariant ścieżki obowiązujący w sezonie: najnowszy wariant z sezonu ≤ season (pola wariantu nadpisują domyślne)
  function forSeason(pathway, season) {
    const v = (pathway.variants || []).filter(x => x.season <= season).sort((a, b) => b.season - a.season)[0];
    if (!v) return pathway;
    const { places, season: _s, ...rest } = v;
    return { ...pathway, ...rest, from: places ? { ...pathway.from, places } : pathway.from, variants: undefined, variantSeason: v.season };
  }
  // Nominacje z klasyfikacji: classification – identyfikatory zawodników w kolejności miejsc.
  // opts.skip(id, rule) – czy pominąć zawodnika (np. stały uczestnik SGP, odmowa); pominięte miejsce przechodzi na kolejnego.
  // opts.coachPick(n, taken) – wybór trenera (lista n identyfikatorów) dla ścieżek z coachPicks.
  function applyPathway(pathway, classification, opts = {}) {
    const p = opts.season ? forSeason(pathway, opts.season) : pathway;
    const skip = opts.skip || (() => false);
    const rules = p.skipIf || [];
    const out = [];
    if (p.from.places) {
      const [a, b] = p.from.places, want = b - a + 1;
      for (let i = a - 1; i < classification.length && out.length < want; i++) {
        const id = classification[i];
        if (rules.some(r => skip(id, r))) continue; // miejsce przechodzi na kolejnego w klasyfikacji
        out.push(id);
      }
    } else if (p.from.rule === 'bestNotSgp') { // najwyżej sklasyfikowany zawodnik spoza stałych uczestników SGP
      const id = classification.find(x => !rules.some(r => skip(x, r)));
      if (id != null) out.push(id);
    } else if (p.count && p.from.rule === 'ranking') {
      for (const id of classification) { if (out.length >= p.count) break; if (!rules.some(r => skip(id, r))) out.push(id); }
    }
    const picks = p.coachPicks && opts.coachPick ? opts.coachPick(p.coachPicks, out.slice()) || [] : [];
    return { pathway: p.id, to: p.to, nominated: out, coachPicks: picks.slice(0, p.coachPicks || 0), pendingCoachPicks: Math.max(0, (p.coachPicks || 0) - picks.length) };
  }
  // Opis zasad obsady etapu po polsku (do ekranów gry)
  const PL = { clubEntry: 'zgłoszenia klubów', federationEntry: 'nominacje federacji', fromStage: 'awans z etapu', fromComp: 'awans z zawodów', fromLeague: 'miejsce w lidze', seeded: 'rozstawieni', host: 'gospodarz', nomination: 'nominacja', wildcard: 'dzika karta', trackReserve: 'rezerwa toru' };
  function describeStage(pack, code, stageId) {
    const s = stage(pack, code, stageId);
    if (!s) return [];
    return (s.entrants || []).map(e => {
      const n = e.count != null ? ` – ${e.count}` : e.places ? ` – miejsca ${e.places[0]}–${e.places[1]}${e.per === 'event' ? ' z każdych zawodów' : e.per === 'group' ? ' z każdej grupy' : ''}` : '';
      const src = e.stage ? ` (${e.stage})` : e.comp ? ` (${e.comp}${e.seasonOffset === -1 ? ', poprzedni sezon' : ''})` : e.league ? ` (${e.league}${e.seasonOffset === -1 ? ', poprzedni sezon' : ''})` : '';
      return `${PL[e.type] || e.type}${src}${n}${e.by ? `, decyduje: ${e.by}` : ''}${e.note ? ` – ${e.note}` : ''}`;
    });
  }
  // Czy zawodnik spełnia warunki wieku (rocznikowo albo od urodzin) w danym sezonie
  function ageOk(comp, born, season, date) {
    const el = comp.eligibility || {};
    const y = Number(String(born).slice(0, 4));
    if (el.ageMax != null && season - y > el.ageMax) return false;
    if (el.ageMin != null) {
      if (el.ageMinRule === 'od urodzin' && date) { const b = new Date(born), d = new Date(date); const age = d.getFullYear() - b.getFullYear() - (d < new Date(d.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); if (age < el.ageMin) return false; }
      else if (season - y < el.ageMin) return false;
    }
    return true;
  }
  const api = { competition, stage, pathwaysFrom, pathwaysTo, forSeason, applyPathway, describeStage, ageOk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SpeedwayQualification = api;
})(typeof window !== 'undefined' ? window : globalThis);

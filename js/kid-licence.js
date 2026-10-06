'use strict';
// Licencje adeptów na niższe klasy (Regulamin szkolenia PZM; ekstraliga.pl „Kiedy można zostać żużlowcem (nabór, egzaminy i licencje)”):
// - certyfikat 85–140 cm³: egzamin po ukończeniu 10 lat, przed 12. urodzinami (ekstraliga.pl/se/szkolenie); ważny do 31 grudnia roku 13. urodzin,
// - licencja 250 cm³/500R (jedna licencja): egzamin po ukończeniu 13 lat (rejestr PZM 2026: zdają też 15-latkowie – próg górny przed 16. urodzinami);
//   przy jeździe na 250 cm³ ważna do 31 grudnia roku 15. urodzin, na 500R – do licencji Ż (egzamin Ż po ukończeniu 15 lat, js/competitions.js).
// Egzaminy na wspólnych sesjach z licencją Ż (sesje EXAM z kalendarza PZM). Adepci zagraniczni mają licencje swoich federacji – bez egzaminów PZM.
const KID_LIC = {
  mini: { name: 'certyfikat 85–140 cm³', short: '85–140 cm³', min: 10, max: 12, until: 13 },
  250: { name: 'licencja 250 cm³/500R', short: '250 cm³/500R', min: 13, max: 16, until: 15 },
};
const KID_LIC_EVENT = { mini: /85|125|140/, 250: /250|500R/ }; // klasy w licenseEvents rejestru PZM (np. „250cc/500R”, „500R”)
const kidByear = k => Number(String(k.born || '').slice(0, 4)) || null;
const kidAgeNow = (k, date = G.date) => ageAt(typeof kidBirth === 'function' ? kidBirth(k) : k.born, date);
// licencja ważna w danym dniu (certyfikat do końca roku 13. urodzin; 250 cm³ do końca roku 15. urodzin – na 500R bez tego limitu)
function kidLicNow(k, date = G.date) {
  if (!k || !k.lic) return null;
  const y = Number(date.slice(0, 4)), by = kidByear(k);
  if (!by) return k.lic;
  if (k.lic === 'mini' && y - by > KID_LIC.mini.until) return null;
  if (k.lic === '250' && k.cat !== 'c500' && y - by > KID_LIC[250].until) return null;
  return k.lic;
}
const kidForeign = k => (k.country || 'POL') !== 'POL';
// Trening w klasie jest możliwy przed certyfikatem / egzaminem (od wieku treningowego klasy); starty w zawodach – tylko z licencją:
// klasy 250 cm³ i 500R – licencja 250 cm³/500R; zawody miniżużla – certyfikat 85–140 cm³
function kidLicAllows(k, catId) {
  if (kidForeign(k) || !['c250', 'c500'].includes(catId)) return true;
  return kidLicNow(k) === '250';
}
const kidMiniOk = k => kidForeign(k) || kidLicNow(k) === 'mini';
// czy adept może startować w zawodach swojej klasy (pit bike – brak zawodów w grze)
const kidCanRace = k => (k.cat === 'c85' ? kidMiniOk(k) : kidLicAllows(k, k.cat));
// Przeniesienie do sąsiedniej klasy na trening (od wieku treningowego klasy, także przed egzaminem)
function kidMoveOk(k, dir) {
  const i = ACADEMY_CATS.findIndex(c => c.id === k.cat), t = ACADEMY_CATS[i + dir];
  if (!t || k.catalogOnly || k.retired) return null;
  if (dir > 0 && kidAgeNow(k) < t.ages[0]) return { ok: false, cat: t, text: `Treningi w klasie ${t.name} od ${t.ages[0]} lat.` };
  return { ok: true, cat: t };
}
// Licencja z rejestru PZM / klasy i wieku – przy pierwszym uruchomieniu (nowa gra, starszy zapis)
function ensureKidLicences() {
  if (G.kidLicModel === 1) return false;
  for (const k of Object.values(G.academy)) {
    if (k.catalogOnly || k.lic !== undefined) continue;
    const p = Object.values(G.miniPeople || {}).find(x => x.kidId === k.id || (k.academyCatalogId && x.id === k.academyCatalogId));
    const reg = (p && p.registryClasses) || [];
    const age = kidAgeNow(k);
    let lic = null;
    if (reg.some(c => KID_LIC_EVENT[250].test(c))) lic = '250';
    else if (reg.some(c => KID_LIC_EVENT.mini.test(c))) lic = 'mini';
    else if (['c250', 'c500'].includes(k.cat) && age >= KID_LIC[250].min) lic = '250';
    else if (k.cat === 'c85' && age >= KID_LIC.mini.min) lic = 'mini';
    // egzamin z rejestru po starcie gry: do tego dnia licencji jeszcze nie ma
    const ev = (k.licenseEvents || []).find(e => e.date && KID_LIC_EVENT[250].test(e.class) && !/^500cc$/.test(e.class));
    if (lic === '250' && ev && ev.date.slice(0, 7) > G.date.slice(0, 7)) lic = reg.some(c => KID_LIC_EVENT.mini.test(c)) && age < 13 ? 'mini' : null;
    k.lic = lic;
    if (!kidLicNow(k)) k.lic = null;
  }
  G.kidLicModel = 1;
  return true;
}
// Jaki egzamin niższej klasy może zdawać adept (null – żaden albo egzamin na licencję Ż)
function lowerExamKind(k, date = G.date) {
  if (!k || k.catalogOnly || k.retired || k.free || k.trial || kidForeign(k) || !examAffiliated(k)) return null;
  if (examCandidate(k, date)) return null; // podchodzi do egzaminu na licencję Ż
  const age = kidAgeNow(k, date), lic = kidLicNow(k, date);
  if (lic !== '250' && age >= KID_LIC[250].min && age < KID_LIC[250].max && ['c85', 'c250', 'c500'].includes(k.cat)) return '250';
  if (!lic && age >= KID_LIC.mini.min && age < KID_LIC.mini.max && ['c50', 'c85', 'c250'].includes(k.cat)) return 'mini';
  return null;
}
const lowerExamChance = (k, kind) => (kind === 'mini' ? clamp(0.55 + ((k.ca ?? 6) - 7) / 8, 0.3, 0.97) : clamp(0.5 + ((k.ca ?? 10) - 12) / 10, 0.3, 0.97));
const lowerRealExam = (k, kind, date) => (k.licenseEvents || []).some(e => e.date && KID_LIC_EVENT[kind].test(e.class) && e.class !== '500cc' && e.date.slice(0, 7) <= date.slice(0, 7));
const lowerRealLater = (k, kind, date) => !lowerRealExam(k, kind, date) && (k.licenseEvents || []).some(e => e.date && KID_LIC_EVENT[kind].test(e.class) && e.class !== '500cc' && e.date.slice(0, 7) > date.slice(0, 7));
function lowerExamRegistered(k, kind, date = G.date) {
  if (k.lexamLast && k.lexamLast > addDays(date, -EXAM_RETRY_DAYS)) return false; // po niezdanym – kolejna sesja
  const real = lowerRealExam(k, kind, date), ready = lowerExamChance(k, kind) >= 0.7;
  if (lowerRealLater(k, kind, date) && !(k.clubId === G.clubId && k.examRegistered === true)) return false;
  if (k.clubId === G.clubId) return !k.examWithdrawn && (k.examRegistered === true || ready || real);
  return real || ready;
}
// Sesja egzaminacyjna: certyfikaty 85–140 cm³ i licencje 250 cm³/500R (wywoływane z simulateExam po egzaminie Ż)
function lowerExamRun(ev, m) {
  for (const k of Object.values(G.academy)) {
    const kind = lowerExamKind(k, ev.date);
    if (!kind || !lowerExamRegistered(k, kind, ev.date)) continue;
    k.lexamLast = ev.date;
    const ok = lowerRealExam(k, kind, ev.date) || mulberry(hashStr(k.id + ev.id + kind))() < lowerExamChance(k, kind);
    if (ok) {
      k.lic = kind; k.licDate = ev.date; k.examRegistered = false;
      if (kind === 'mini' && k.cat === 'c50') k.cat = 'c85';
      if (kind === '250' && k.cat === 'c85') k.cat = 'c250';
    }
    m.exam.push({ name: k.name, clubId: k.clubId, schoolId: k.schoolId || null, kidId: k.id, ca: round1(k.ca), pa: round1(k.pa), ok, riderId: null, kind });
  }
}
// Koniec ważności (31 grudnia roku 13. / 15. urodzin) – sprawdzane co miesiąc
function kidLicMonthly() {
  for (const k of Object.values(G.academy)) if (k.lic && !kidLicNow(k)) {
    if (k.clubId === G.clubId) addMsg({ category: 'szkółka', from: 'Trener szkółki', title: `${k.name}: wygasła ${KID_LIC[k.lic].name}`, body: `<p>${esc(k.name)} (${kidAgeNow(k)} lat) traci ${esc(KID_LIC[k.lic].name)} z końcem roku. Następny krok: egzamin na ${k.lic === 'mini' ? 'licencję 250 cm³/500R (po ukończeniu 13 lat)' : 'licencję Ż (po ukończeniu 15 lat) – albo dalsza jazda na 500R'}.</p>`, link: `#/adept/${k.id}` });
    k.lic = null;
  }
}
// Opis licencji w profilu adepta
function kidLicText(k) {
  if (kidForeign(k)) return `licencja federacji krajowej (${COUNTRY[k.country] || k.country})`;
  const lic = kidLicNow(k), by = kidByear(k);
  if (lic === 'mini') return `${KID_LIC.mini.name}${by ? ` – ważny do 31.12.${by + KID_LIC.mini.until}` : ''}${k.licDate ? ` (egzamin ${fmtDateShort(k.licDate)})` : ''}`;
  if (lic === '250') return `${KID_LIC[250].name}${k.cat === 'c500' ? ' – jazda na 500R do licencji Ż' : by ? ` – ważna do 31.12.${by + KID_LIC[250].until} (na 250 cm³)` : ''}${k.licDate ? ` (egzamin ${fmtDateShort(k.licDate)})` : ''}`;
  const age = kidAgeNow(k);
  return age < KID_LIC.mini.min ? 'bez licencji – egzamin na certyfikat 85–140 cm³ po ukończeniu 10 lat' : age < KID_LIC.mini.max ? 'bez certyfikatu – egzamin 85–140 cm³ (po ukończeniu 10 lat, przed 12. urodzinami)' : age < KID_LIC[250].min ? 'bez licencji – egzamin na licencję 250 cm³/500R po ukończeniu 13 lat' : age < 15 ? 'bez licencji – egzamin na licencję 250 cm³/500R (od 13 lat)' : 'bez licencji niższej klasy – egzamin na licencję Ż (od 15 lat)';
}

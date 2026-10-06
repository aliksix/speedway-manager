'use strict';
// Obywatelstwa zawodników. Pierwsze na liście (r.country) to kraj macierzysty: barwy sportowe w zawodach FIM i FIM Europe,
// reprezentacja, mistrzostwa krajowe i zawieszenia. Każde kolejne obywatelstwo to dodatkowy paszport – np. polskie daje
// status zawodnika krajowego w polskiej lidze (limity składu, kontrakt amatorski juniora, licencja PZM, miejsce zamieszkania).

const nats = x => (x && x.nationalities && x.nationalities.length ? x.nationalities : [x && x.country].filter(Boolean));
const hasNat = (x, cc) => nats(x).includes(cc);

// Federacje zawieszone przez FIM od 1 marca 2022 r.: zawodnicy z tym krajem macierzystym nie startują w zawodach FIM
// i FIM Europe ani w reprezentacji – także z drugim obywatelstwem.
const FIM_SUSPENDED = { RUS: 'Rosja', BLR: 'Białoruś' };
const FIM_SUSPENDED_FROM = '2022-03-01';
// Coroczna decyzja FIM (1 grudnia, na kolejny sezon): szansa przywrócenia 10% w 2026 r. (na sezon 2027), co roku o 10 pkt proc. więcej.
// Po przywróceniu zawodnicy znów jeżdżą jako Rosjanie (Białorusini) od 1 stycznia kolejnego roku. G.fimLift = { from, decided }
const FIM_DECISION_DAY = '12-01', FIM_LIFT_FIRST_YEAR = 2026, FIM_LIFT_BASE = 0.10, FIM_LIFT_STEP = 0.10;
const fimLiftChance = year => clamp(FIM_LIFT_BASE + (year - FIM_LIFT_FIRST_YEAR) * FIM_LIFT_STEP, 0, 1);
const fimSuspended = (cc, date = G && G.date) => !!FIM_SUSPENDED[cc] && !(G && G.fimLift && G.fimLift.from && date >= G.fimLift.from);
const fimBanned = x => !!x && fimSuspended(x.country);
// W Polsce (liga, zawody PZM, kontrakty z polskimi klubami) zawodnik zawieszonej federacji może jeździć tylko z polskim
// obywatelstwem – do czasu zniesienia zawieszenia przez FIM.
const plBanned = (x, date = G && G.date) => !!x && fimSuspended(x.country, date) && !hasNat(x, 'POL');
const plBanText = x => `Bez startów w Polsce: federacja kraju macierzystego (${FIM_SUSPENDED[x.country]}) zawieszona przez FIM, a zawodnik nie ma polskiego obywatelstwa. Klub w Polsce nie zarejestruje kontraktu do czasu zniesienia zawieszenia.`;
const FIM_GROUPS = ['swiat', 'europa'];
const isFimEvent = ev => !!ev && (ev.kind === 'sgp' || (typeof compOf === 'function' && FIM_GROUPS.includes((compOf(ev) || {}).group)));
const fimBanText = x => `Zawieszony w zawodach FIM: federacja kraju macierzystego (${FIM_SUSPENDED[x.country]}) zawieszona przez FIM od ${fmtDate(FIM_SUSPENDED_FROM)}.${nats(x).length > 1 ? ` Drugie obywatelstwo (${nats(x).slice(1).map(cc => COUNTRY[cc] || cc).join(', ')}) nie zmienia barw sportowych w zawodach FIM.` : ''}${G && G.fimLift && G.fimLift.from ? ` Zawieszenie zostanie zniesione ${fmtDate(G.fimLift.from)}.` : ''}`;

// Codziennie (js/game.js: newDay): 1 grudnia decyzja FIM na kolejny sezon (force – wynik narzucony, testy)
function fimDay(force) {
  const y = Number(G.date.slice(0, 4));
  if (G.date.slice(5) !== FIM_DECISION_DAY || y < FIM_LIFT_FIRST_YEAR) return;
  G.fimLift = G.fimLift || { from: null, decided: {} };
  if (G.fimLift.from || G.fimLift.decided[y] != null) return;
  const lift = typeof force === 'boolean' ? force : chance(fimLiftChance(y));
  G.fimLift.decided[y] = lift;
  const next = y + 1, names = Object.values(FIM_SUSPENDED).join(' i ');
  const affected = Object.values(G.riders).filter(r => r.active && !r.retired && FIM_SUSPENDED[r.country]);
  const mine = affected.filter(r => r.clubId === G.clubId);
  if (lift) {
    G.fimLift.from = `${next}-01-01`;
    G.natSquads = null; // kadry narodowe od nowa – z reprezentacjami przywróconych krajów
    addMsg({ category: 'liga', from: 'FIM', stop: true, title: `Koniec wojny – FIM przywraca federacje: ${names}`,
      body: `<p>Wojna się zakończyła. Zgromadzenie Ogólne FIM zniosło zawieszenie federacji: ${esc(names)}. Od <b>${fmtDate(G.fimLift.from)}</b> zawodnicy z tych krajów mogą znowu startować w zawodach FIM i FIM Europe pod swoimi flagami – w Grand Prix i jego kwalifikacjach, mistrzostwach Europy i w reprezentacji.</p>
        <p>Zawodnicy bez polskiego obywatelstwa mogą znowu podpisywać kontrakty z polskimi klubami i jeździć w lidze (jako obcokrajowcy). Zawodnicy z polskim obywatelstwem pozostają zawodnikami krajowymi.</p>
        ${mine.length ? `<p>Dotyczy zawodników naszego klubu: ${mine.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}. Starty w zawodach FIM oznaczają więcej terminów poza ligą.</p>` : ''}` });
  } else {
    addMsg({ category: 'liga', from: 'FIM', title: `FIM utrzymuje zawieszenie federacji na sezon ${next}`,
      body: `<p>Zgromadzenie Ogólne FIM przedłużyło zawieszenie federacji: ${esc(names)}. W sezonie ${next} zawodnicy z tych krajów nadal nie startują w zawodach FIM i FIM Europe ani w reprezentacji. Starty w ligach – bez zmian.</p>
        ${mine.length ? `<p>Dotyczy zawodników naszego klubu: ${mine.map(r => `<a href="#/zawodnik/${r.id}">${esc(r.name)}</a>`).join(', ')}.</p>` : ''}` });
  }
}

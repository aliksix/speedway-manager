'use strict';
// Rzeczywiste sytuacje kontraktowe zawodników na sezon 2026 (prasa), nanoszone na start gry i na wczytany zapis.
// sitOut: zawodnik ma ważny kontrakt, ale nie startuje dla klubu macierzystego (zawieszone starty) – pojedzie tylko po wypożyczeniu;
// loanAsk: kwota, za którą klub macierzysty wypożyczy zawodnika (cena wyjściowa; klub zgodzi się też na niższą, ale nie poniżej loanMin).
const CONTRACT_CASES = [
  { name: 'Paweł Trześniewski', club: 'RYB', until: 2026, kind: 'amatorski', role: 'zbedny', sitOut: true, loanAsk: 180000, loanMin: 50000 },
];
function applyContractCases() {
  if (G.contractCases === 2) return false; // wersja danych (2: wypożyczenie Trześniewskiego 180 tys. zł)
  let ch = false;
  for (const x of CONTRACT_CASES) {
    const r = Object.values(G.riders).find(q => normName(q.name) === normName(x.name));
    const c = Object.values(G.clubs).find(q => q.short === x.club);
    if (!r || !c || r.retired) continue;
    if (!(r.contract && r.contract.clubId === c.id && r.contract.until >= x.until)) {
      const from = Math.min(sportSeason(), x.until);
      r.contract = makeContract(c.id, { kind: x.kind, stipend: 0, signing: 0, perPoint: 0, years: x.until - from + 1, role: x.role }, from, 'umowa z prasy (zawieszone starty)');
      r.clubId = c.id;
    }
    r.contract.role = x.role;
    r.sitOut = x.sitOut ? x.until : null;
    r.loanListed = true; r.loanAsk = x.loanAsk; r.loanMin = x.loanMin || 0;
    delete r.caseNote; delete r.caseSource;
    ch = true;
  }
  G.contractCases = 2;
  return ch;
}

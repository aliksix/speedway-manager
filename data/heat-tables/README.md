# Tabele biegowe — sezon 2026

Paczka dla Speedway Manager, zweryfikowana 1 października 2026. **27 tabel, 526 zapisów biegów**, w tym biegi ustalane według wyników i nominacji. Podstawą są regulaminy PZM, FIM i FIM Europe na 2026. Tabela wskazana przez użytkownika z 2020 została zachowana jako materiał historyczny.

## Zawartość

- `index.html` — przeglądarka tabel działająca lokalnie, z wyborem formatu i odnośnikami do źródeł.
- `heat-tables-2026.json` — główny import, UTF-8; tabele, selektory obsady, pola, kaski, punktacja, źródła i przypisania do `COMPS`.
- `heat-tables-2026.js` — te same dane dla przeglądarki (`SPEEDWAY_HEAT_TABLES`) i Node/CommonJS.
- `adapter.js` — wybór tabeli oraz zamiana obsady na `{riderId, team, gate, helmet, slot}`, zgodne z wejściem `runHeat()`.
- `heats.csv` — płaski eksport do przeglądania, separator `;`, UTF-8 BOM. Dla biegów dynamicznych pola pozostają puste do czasu wyboru; pełne zasady są w JSON.
- `schema.json` — schemat JSON danych podstawowych.
- `manifest.json`, `sources.json`, `sources/` — źródła, daty dostępu, pobrane PDF i SHA-256, teksty oraz obrazy sprawdzonych stron.
- `validate.cjs`, `validation-report.json` — testy i wynik kontroli.

## Zakres

| Format | Biegi / uczestnicy |
|---|---|
| Ekstraliga, 2. Ekstraliga, KLŻ | dwa zestawy; 13 + 2 nominowane |
| Zawody indywidualne PZM | 16 zawodników / 20 biegów |
| Indywidualne PZM, art. 61a | 20 zawodników / 20 biegów + pięć finałów |
| IMP, IMP 500R, IMP 85–140cc | 20 + półfinał + finał |
| SEC | 20 + last chance + finał |
| SGP i SGP2 | 20 + LCQ1 + LCQ2 + finał |
| SGP sprint | osobny bieg 0, punktacja 4–3–2–1 |
| SGP3 i SGP4 | 20, bez finału |
| Pary PZM | 5 / 6 / 7 par: 10 / 15 / 21 biegów |
| Pary FIM Europe | 6 / 7 / 8 par: 15 / 21 / 28 biegów |
| DMPJ i DME U24 | 16 + 4 według klasyfikacji wewnątrz drużyn |
| DME seniorów | 22; dodatkowe biegi rezerwowych U21 nr 9 i 18 |
| U24 Ekstraliga | 4 drużyny / 18 biegów, po dwóch zawodników drużyny w biegu |
| Drużynowy Puchar Świata | 16 + 4 nominowane przez menedżerów |
| SON2 | 8 reprezentacji / 28, punktacja 4–3–2–0, bez finału |
| DMP 85–140cc | 6 lub 7 drużyn po trzech: 18 lub 21 biegów |
| DPE 500R | 7 drużyn po trzech / 21 |
| DPE 85–140cc i DP2E 500R | 7 drużyn po dwóch / 21; inna tabela niż MPPK |
| IPP / IPE 85–140cc, IPE 500R | 20 zawodników, po cztery starty + finał top 4 |

MPPK mini: eliminacje po 7 par, **finał 6 par** (15 biegów). Senior SON nie jest rozgrywany w 2026; jego regulamin jest w źródłach, bez aktywnej tabeli w paczce.

`competitionMappings` ma 62 wpisy, obejmujące również jawne oznaczenia braków. `not-mapped` oznacza, że przypisanie nie było zweryfikowane; nie oznacza braku regulaminu. Dotyczy m.in. kwalifikacji SGP, części pucharów szkoleniowych i innych imprez. Turnieje otwarte wymagają regulaminu uzupełniającego. Adapter odmawia użycia nieustalonej tabeli. Nie należy podstawiać SGP do każdej imprezy indywidualnej.

## Import do gry

Paczka jest **podłączona do silnika gry** przez `js/heat-runtime.js`. `index.html` wczytuje dane i adapter przed silnikiem. Mecze ligowe korzystają z wylosowanego zestawu, a `simulateGp()` i `unitsMeeting()` wybierają program według rozgrywek, etapu i liczby drużyn. `runHeat()` otrzymuje punktację tabeli (w tym SON2: 4–3–2–0). Listy indywidualne mają 16 lub 20 miejsc; liczba drużyn i zawodników wynika z programu. SGP ma dwa LCQ i finał, IMP/SEC bieg ostatniej szansy i finał; SGP3/4 nie dostają dodatkowych półfinałów.

Wynik zapisuje `heatTableId`, wersję, obsadę, pola, kolory kasków i fazy biegów. Rankingi i nominacje są zamrażane przed fazą końcową. Brak zawodnika pozostawia puste miejsce bez przesuwania numerów. Suma biegowa obejmuje wszystkie starty; punktacja cyklu IMP/SEC wyłącza bieg 21. DMPJ, U24 i mini DMP używają odpowiednich punktów za miejsca, dzielonych przy remisach. Istniejące wyniki pozostają bez zmian; rozpoczęty mecz bez identyfikatora tabeli kończy się starym programem. Nowe mecze i nierozpoczęte zawody używają paczki.

Granice integracji: brak zweryfikowanego przypisania oznacza jawnie opisany w ekranie wyników uproszczony format gry (indywidualny 16/20 albo dotychczasowy drużynowy). Paczka nie ustala pełnej legalności rezerw, biegów dodatkowych i uprawnień. Symulacja rozstrzyga nierozstrzygnięte remisy indywidualne przez powtarzalne losowanie po punktach i liczbie poszczególnych miejsc; nie przeprowadza wszystkich regulaminowych biegów dodatkowych. Wybory pól i nominacje drużynowe wykonuje AI. Sprint nie jest automatycznie dopisywany do kalendarza bez danych kwalifikacji.

Test integracji: `node tools/test-heat-runtime.cjs`. Test sezonu z miniżużlem: `node tools/test-sim.js 1`. Test miniżużla i zapisu: `node tools/test-mini.cjs`. Test Chrome i SQLite (wynik SGP, zapis po 13. biegu ligi i dokończenie meczu po wczytaniu): `node tools/test-heat-browser.cjs`.

Node:

```js
const pack = require('./heat-tables-2026.json');
const adapter = require('./adapter.js');
const entries = adapter.toRunHeatEntries(pack, 'league-15-set-1', 1, {
  startNumbers: {1: 'away-one', 3: 'away-three', 9: 'home-one', 11: 'home-three'}
});
// A: away-one/żółty, B: home-one/czerwony,
// C: away-three/biały, D: home-three/niebieski.
```

W przeglądarce załaduj kolejno `heat-tables-2026.js` i `adapter.js`. Dane i API są dostępne jako `SPEEDWAY_HEAT_TABLES` oraz `SpeedwayHeatAdapter`. Nie wymagają bibliotek ani `fetch`, więc działają także dla plików lokalnych.

### Obsada i kolejność

- `startNumbers`: mapa numerów programu do ID zawodników. To **numery z listy startowej**, nie stałe numery zawodników SGP.
- `teamRiders`: np. `{D1: [id1,id2,id3,id4,id5]}` dla SWC albo `{A: [id1,id2,id3], B: [...]}` dla SON2. `teamSlot.slot` jest liczony od 1.
- `rankings.main`: ID zawodników w zatwierdzonej kolejności po fazie zasadniczej. `rankings.D1` itd.: klasyfikacja zawodników danej drużyny; DMPJ po 16, DME po 17, z wyłączeniem rezerwowego. Remisy rozstrzyga menedżer zgodnie z regulaminem.
- `results[heat]`: kolejność ID w zakończonym biegu; używana do awansu z półfinału lub LCQ.
- `nominations`: w lidze klucze `14:czerwony`, `14:niebieski`, `14:biały`, `14:żółty` oraz analogiczne dla 15; w SWC `17:D1` … `20:D4`.
- `gateChoices[heat]`: cztery ID w kolejności pól A–D po wyborze lub losowaniu. Kolejność uprawnienia do wyboru zwraca `choiceOrder()`. W finale SGP zwycięzcy LCQ wybierają według klasyfikacji po 20, a nie numeru LCQ.
- `nominatedSet: 1 | 2`: wymagany osobno dla ligi w biegach 14–15. Może różnić się od zestawu w biegach 1–13.
- `swapTeams`: opcjonalna lista drużyn zamieniających pola między partnerami, tylko gdy tabela na to pozwala. Kaski pozostają przypisane do zawodników.

Wpis `gate: null` jest celowy: zawodnik musi wybrać pole albo musi zostać przeprowadzone losowanie. Kolejność wpisów w takim biegu nie oznacza pól startowych.

Przykład finału SGP:

```js
const ctx = {
  rankings: {main: [101,102,103,104,105,106,107,108,109,110]},
  results: {21: [109,103,106,108], 22: [104,105,107,110]},
  gateChoices: {23: [109,102,104,101]}
};
adapter.choiceOrder(pack, 'sgp-16-23', 23, ctx); // [101,102,104,109]
adapter.toRunHeatEntries(pack, 'sgp-16-23', 23, ctx);
```

`selectTable(pack, 'MMPPK', {stage: 'qualifying', teamCount: 6})` wybiera PZM 15-biegową. Dla finału użyj `stage: 'final'`. `selectTable(pack, 'MINI_DMP_A', {teamCount: 6})` wybiera tabelę 18-biegową. Rozgrywki z bezpośrednim przypisaniem nie wymagają opcji.

To dane **programu zawodów**, nie kompletny silnik regulaminowy. Uprawnienia zawodników, limity startów, legalność nominacji i rezerw, kontuzje, remisy i biegi dodatkowe wymagają logiki regulaminu danej imprezy. Adapter wymaga gotowych rankingów i decyzji; nie zgaduje brakujących uczestników. Kolory kasków są niezależne od pól, szczególnie w lidze i czwórmeczach. Dla różnych rozgrywek współdzielących tabelę zasady klasyfikacji, rezerw oraz przerw mogą się różnić — obowiązują źródła danej imprezy.

## Uwagi do źródeł

- PZM: aktualny indeks https://pzm.pl/zuzel/regulaminy-i-druki oraz PDF na 2026. Część plików jest na domenie `archiwum.pzm.pl`, ale dotyczy sezonu 2026.
- FIM Europe: wydanie 9 lutego 2026. Sześć par FIM Europe ma inną tabelę i numery rezerwowych niż sześć par PZM.
- SGP: dokument 2026 odczytano przez indeks internetowy, art. 8.5, s. 19–20. Bezpośrednie pobranie zwracało 404, więc zapisano `sources/sgp-2026-table.txt`. Link opisany przez organizatora jako regulamin 2026 prowadził do PDF z okładką 2025; zachowany `sgp-current.pdf` jest tylko materiałem porównawczym. Format potwierdza również https://fimspeedway.com/sgp/rules.
- Mini DMP dla 6 drużyn: źródło dwukrotnie drukuje `XVI`; drugi z tych wierszy otrzymał numer 17. Obsada pozostała zgodna z PDF.
- Klasa SGP4 w 2026 to 190cc; dotychczasowy opis 125cc w grze wymaga osobnej aktualizacji.

## Sprawdzenie i przebudowa

W folderze paczki: `node validate.cjs`. Testy kontrolują strukturę, unikalność obsady i pól, spotkania każdy z każdym, 25 sekwencji z tekstów źródłowych, wszystkie wiersze SWC i SON2 oraz adapter w Node i przeglądarce. Wybrane tabele sprawdzono także na obrazach PDF.

W katalogu projektu: `node tools/build-heat-tables.cjs`, następnie `node data/heat-tables/validate.cjs`. Pobieranie źródeł: `tools/download-heat-sources.ps1`; istniejące kopie nie są nadpisywane. Teksty `.raw.txt` uzyskano poleceniem `pdftotext -raw`. Wersje i pobrane dokumenty mają znaczenie: nowszego regulaminu nie należy podmieniać bez ponownej weryfikacji danych.

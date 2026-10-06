# Kwalifikacje i nominacje – sezon 2026

Paczka dla Żużlowego Menedżera, zweryfikowana 3 października 2026. Zawiera reguły obsady zawodów mistrzowskich: kto startuje, skąd się awansuje i które wyniki dają nominacje do zawodów FIM i FIM Europe.

- **31 zawodów:** PZM/GKSŻ, FIM, FIM Europe oraz mistrzostwa Danii, Szwecji i Wielkiej Brytanii.
- **17 ścieżek nominacji**, np. Złoty Kask → eliminacje GP i SEC, finał DM → eliminacje EM/VM, wicemistrz Wielkiej Brytanii → dzika karta GP.

Zasady obowiązują od sezonu 2026 i gra stosuje je w każdym kolejnym sezonie (jedna wersja zasad, bez statusów i wariantów historycznych). Kody zawodów są takie same jak w `COMPS` (`js/competitions.js`). Zawody spoza gry mają prefiks kraju (`DEN_DM`, `SWE_SM`, `GBR_BF`) i `inGame: false`.

## Zawartość

- `qualification-2026.json` – główny import (UTF-8).
- `qualification-2026.js` – te same dane jako `SPEEDWAY_QUALIFICATION` (przeglądarka) i moduł CommonJS. Generowany, nie edytuj ręcznie.
- `adapter.js` – funkcje dla gry, bez globali gry (`SpeedwayQualification` w przeglądarce, `require` w Node):
  - `competition(pack, kod)` i `stage(pack, kod, etap)` – reguły zawodów, także po kodzie etapu (np. `IMPE` → IMP, eliminacje);
  - `pathwaysFrom(pack, kod)` i `pathwaysTo(pack, kod)` – ścieżki nominacji wychodzące z zawodów i prowadzące do nich;
  - `applyPathway(ścieżka, klasyfikacja, { season, skip, coachPick })` – nominacje z klasyfikacji. Pomija zawodników wskazanych przez `skip` (np. stałych uczestników SGP), a ich miejsca przechodzą na kolejnych. Dodaje wybory trenera kadry. Wariant ścieżki dobiera według sezonu;
  - `describeStage(pack, kod, etap)` – opis obsady po polsku, do ekranów gry;
  - `ageOk(zawody, dataUrodzenia, sezon, data)` – limity wieku (rocznikowo albo od urodzin).
- `sources.json` – źródła z adresami, lokalnymi kopiami i sumami SHA-256 (generowany).
- `tools/build-qualification.cjs` – walidacja (kody zawodów i etapów, ligi, źródła) i budowa wersji JS.
- `tools/test-qualification.cjs` – test paczki z przykładowymi nominacjami.

## Model danych

Każde zawody mają etapy (`stages`), np. eliminacje → challenge → finał. Etap opisuje:
- liczbę zawodów (`events`) i stawkę (`field`, `reserves`, `unit`: zawodnik, para, drużyna);
- obsadę (`entrants`) jako listę selektorów:
  - `clubEntry` – zgłoszenie klubu;
  - `federationEntry` – nominacja federacji;
  - `fromStage` – awans z etapu;
  - `fromComp` – awans z innych zawodów;
  - `fromLeague` – miejsce w tabeli ligi;
  - `seeded` – rozstawienie;
  - `host` – miejsce gospodarza;
  - `nomination`, `wildcard`, `trackReserve`;
- awanse (`advance`) i wykluczenia (`exclude`, np. stali uczestnicy SGP w eliminacjach SEC).

Pola wspólne:
- `places: [od, do]` – zakres miejsc;
- `per: event | group | overall` – czy miejsca liczy się w każdych zawodach, w każdej grupie, czy łącznie;
- `seasonOffset` – sezon docelowy względem źródłowego (−1 poprzedni, 1 kolejny);
- `count: null` – liczbę ustala organ z pola `by` (np. komunikat GKSŻ) i regulamin jej nie podaje.

## Najważniejsze zasady

| Zawody | Obsada i awans |
|---|---|
| IMP | eliminacje (16 + 2) → po 4 do challenge'u → 7 do finału; w finale także medaliści IMP z poprzedniego roku, stali uczestnicy SGP (nr 1–15), MIMP z poprzedniego roku, dzikie karty GKSŻ i zawodnik klubu gospodarza; 3 turnieje finałowe |
| MIMP | eliminacje → finał (liczbę ustala GKSŻ) + uczestnicy eliminacji SGP2; finał u DMPJ z poprzedniego roku |
| Złoty Kask | 15 zawodników wskazanych przez trenera kadry + 1 dzika karta GKSŻ; finał to podstawa nominacji do eliminacji GP i SEC |
| ZK → eliminacje GP | miejsca 1–3; stali uczestnicy SGP pomijani (miejsce przechodzi na kolejnego) |
| ZK → eliminacje SEC | miejsca 1–6 + 2 wybory trenera |
| Srebrny / Brązowy Kask | eliminacje → finał; podstawa nominacji do SGP2 (4 miejsca) i IME U19 |
| MPPK | 1 finał, 7 par: gospodarz, miejsca 1–4 PGE Ekstraligi i zwycięzca 2. Ekstraligi z poprzedniego sezonu, najlepsza pozostała para poprzedniego finału; para to zawodnicy z najwyższą średnią z poprzedniego sezonu (najwyżej 1 obcokrajowiec) |
| MMPPK | eliminacje (grupy 5–7 par) → finał 7 par u wicemistrza DMPJ |
| DMPJ | 5 grup eliminacyjnych (1–3 + najlepsze 4. miejsce) → 4 ćwierćfinały (1–2) → 2 półfinały (1–2) → finał 4 drużyn w 4 turniejach |
| SGP | 7 najlepszych z poprzedniego roku + 4 z GP Challenge + mistrz Europy + 3 stałe dzikie karty; na każdą rundę dzika karta (nr 16) i 2 rezerwy toru (nr 17–18) od federacji kraju gospodarza – dzika karta: zawodnik kraju spoza stałych uczestników albo zawodnik miejscowego klubu (w Polsce także obcokrajowiec: Kvěch, Huckenbeck 2025); rezerwy toru: zawodnicy kraju gospodarza w dowolnym wieku, najpierw z miejscowego klubu (Łódź 2026 – seniorzy Orła) |
| Kwalifikacje GP | 3 rundy (nominacje federacji) → GP Challenge → 4 najlepszych do SGP w kolejnym roku |
| SGP2 | 3 rundy kwalifikacyjne, po 4 najlepszych z każdej + 3 stałe dzikie karty |
| SEC | 3 rundy kwalifikacyjne (po 5) → SEC Challenge (6) → 4 finały; plus 6 najlepszych z poprzedniego roku, 3 nominacje ECB, dzika karta i 2 rezerwy na każdy finał; stali uczestnicy SGP nie jadą w eliminacjach |
| DME / DME U24 / MEP / MEP U19 / IME U19 / IPE U24 | nominacje federacji, gospodarz zawsze w stawce; awanse według rozdziałów 13–17 i 25 regulaminu FIME |
| DPŚ / SoN2 | 10 drużyn w rankingu: 2 półfinały (zwycięzcy do finału) + zwycięzca SoN 2025 + gospodarz; SoN2: 8 drużyn U21 w jednym finale |
| Dania (DM) | otwarte zgłoszenia → 2 półfinały (po 8) → finał 16 + zawodnicy SGP + 1 dzika karta; finał to kwalifikacja EM/VM na kolejny rok (miejsca przydzielone DMU, 1 do decyzji trenera); dziką kartę na GP Danii dostaje najwyżej sklasyfikowany zawodnik spoza stałych uczestników SGP |
| Szwecja (SM) | SM-kval (8 do finału) + 8 nominowanych; nominacje do FIM: Svemo, bez opublikowanego powiązania z SM |
| Wielka Brytania | półfinał (6 do finału) + 10 rozstawionych; dziką kartę na GP Wielkiej Brytanii w kolejnym roku dostaje najwyżej sklasyfikowany zawodnik spoza stałych uczestników SGP |

## Czego jeszcze brakuje

- Pełne zasady Pucharu Europy 125 cm³ (FIME, rozdział 23) i Pucharu MACEC.
- Zawody z gry bez reguł w paczce: puchary i turnieje (IMME, Golden Boy, Flat Track), zawody 500R, Ekstraliga U24, egzaminy, mecz reprezentacji. To nie są mistrzostwa z kwalifikacjami. Ewentualnie można je dopisać w tej samej konwencji.

## Integracja z grą

Paczkę ładuje `index.html` (`qualification-2026.js`, `adapter.js`), a stosuje `js/qualification.js`: obsadę zawodów indywidualnych (awanse, rozstawieni, gospodarz, nominacje GKSŻ z kasków, wykluczenia), termin ogłoszenia list, stawkę GP na kolejny sezon i finał MPPK. Szczegóły: `CZYTAJ.md`, sekcja „Kwalifikacje i nominacje”.

## Aktualizacja

Po zmianie `qualification-2026.json` uruchom `node tools/test-qualification.cjs`. Skrypt przebuduje `qualification-2026.js` i `sources.json` oraz sprawdzi spójność.

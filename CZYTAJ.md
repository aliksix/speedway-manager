# Żużlowy Menedżer

Gra menedżerska o żużlu w stylu Football Managera. Czysty JavaScript + lokalny serwer Node.js z wbudowanym SQLite, bez pakietów do instalowania.

## Uruchomienie

`start.bat`: uruchamia serwer (`tools/server.js`) i otwiera przeglądarkę pod adresem http://127.0.0.1:8770. Wymagany jest Node.js w wersji 22.5 lub nowszej (ze względu na `node:sqlite`).

## Zapis gry

Każda rozgrywka to osobny plik `saves/<id>.sqlite` z pełną bazą danych gry:

| tabela | zawartość |
|---|---|
| `riders` | wszyscy zawodnicy: atrybuty, sprzęt, kontrakty, statystyki, historia |
| `clubs` | kluby: finanse, stadion, park maszyn, historia sezonów |
| `staff`, `academy` | sztaby klubów, rynek personelu, adepci szkółki |
| `fixtures`, `matches` | terminarze i pełne protokoły zawodów (bieg po biegu) |
| `messages`, `injuries`, `transactions`, `sponsors`, `events` | poczta, kontuzje, księga finansowa, sponsorzy, Grand Prix |
| `state`, `snapshots`, `meta` | stan ogólny, kopie zapasowe co tydzień gry (ostatnie 8), metadane |

Zapis jest przyrostowy: po każdym dniu gry i każdej zmianie wysyłane są tylko zmienione rekordy, w jednej transakcji (tryb WAL).

## Start gry

Gra startuje 15 października 2025, po zakończeniu sezonu 2025, bez symulowania czegokolwiek wcześniej:
- **Kadry 2026** pochodzą z ekstraliga.pl (PGE i 2. Ekstraliga) i polskizuzel.pl (KLŻ); skład Śląska jest pomijany. Dla klubów bez kadry w tych źródłach używany jest `Dane.xlsx`, a z niego zawsze brane są KSM i średnie 2023–2025. Daty urodzenia pochodzą ze źródeł. Kwoty kontraktów szacuje model.
- **Sztaby szkoleniowe i szkółki:**
  - trenerzy, trenerzy młodzieży, menedżerowie i kierownicy drużyn – z ekstraliga.pl i polskizuzel.pl;
  - osoby funkcyjne (instruktorzy, toromistrzowie, lekarze itd.) – z pliku PZM `osoby_funkcyjne_20260526.html`;
  - adepci 250 i 85–140 cm³ oraz miniżużla – z tych samych źródeł, uzupełnieni adeptami generowanymi, tak że każdy klub ma szkółkę.
- **Ligi 2026, terminarze, play-offy i baraże** pochodzą z oficjalnych terminarzy GKSŻ/PZM. Unia Tarnów nie startuje w 2026 roku.
- **Wszystkie zawody z kalendarza GKSŻ i FIM są rozgrywane w grze** (zakładka Zawody: terminarz, klasyfikacje i historia każdej rozgrywki):
  - indywidualne: SGP, SGP2–4, IMP, Kaski, MIMP, IME, memoriały, klasy 500R, 250 i 125 cm³ (w tych klasach jadą adepci szkółek);
  - parowe: MPPK, MMPPK, MEP, SON2;
  - drużynowe: DPŚ, DME, DMPJ, Ekstraliga U24, DPE/DP2E 500R, mecz reprezentacji;
  - egzaminy licencyjne: adepci 500 cm³ od ukończenia 15 lat; ci, którzy zdadzą, dołączają do drużyn. Do 16. urodzin zawodnik z licencją startuje tylko w zawodach z udziałem zawodników U-21 (MIMP, Srebrny/Brązowy Kask, DMPJ, MMPPK, SGP2 itp.) – nie jedzie w lidze ani w zawodach seniorskich (także Ekstraliga U24).
- **1 listopada** wygasają kontrakty z 2025 roku, wchodzą w życie prekontrakty i publikowany jest terminarz. Okienka transferowe działają według przepisów PZM (opis niżej). Od sezonu 2027 terminarze lig są generowane przez grę, a kalendarz zawodów powtarza układ z 2026 roku.

## Nowa gra: postać menedżera

Ekran startowy (`js/ui-start.js`) ma listę zapisanych gier, przycisk „Wczytaj ostatnią grę” i kreator nowej kariery. Model postaci jest w `js/manager.js`.

Kroki kreatora:
1. **Dane osobowe:** imię, nazwisko, data i miejsce urodzenia, obywatelstwo (wiek 18–80 lat).
   - Opcjonalnie dzieci (do 5): imię, data urodzenia, czy jeździ na żużlu. Można podać tylko dzieci do 15 lat rocznikowo w sezonie 2026 (rocznik 2011 i młodsze), co najmniej 16 lat młodsze od menedżera.
   - Dziecko, które jeździ, trafia do bazy jako adept szkółki wybranego klubu: klasa pojemności według wieku, ukryty potencjał losowany jak u innych adeptów, maksymalne wsparcie rodziców. Dziecko młodsze niż 5 lat dołącza do szkółki klubu gracza w dniu 5. urodzin (`managerChildrenDay()`, wiadomość w skrzynce).
   - Zdjęcia gracza i dzieci: bez wgrywania w grze – pliki `img/staff/<imię-nazwisko>.png|jpg|webp` (menedżer; awaryjnie `img/riders`) i `img/riders/<imię-nazwisko>.…` (dzieci; awaryjnie `img/staff`), wczytywane od razu, bez importu. Brak pliku – grafika zastępcza.
2. **Menedżer:** zaplecze debiutanta (bez doświadczenia, działacz społeczny, menedżer w biznesie, studia z zarządzania sportem) – bez prowadzonych klubów. Wyznacza pulę punktów (72–88), maksimum atrybutu (13–14) i startowe zaufanie zarządu; punkty rozdziela się na 9 atrybutów menedżera.
3. **Kwalifikacje trenerskie:** doświadczenie żużlowe (brak, amator, miniżużel, licencja bez przebicia się do składu – bez startów ligowych) i kompetencje (brak, treningi w szkółce, instruktor sportu żużlowego, trener sportu żużlowego, trener innej dyscypliny). Przy uprawnieniach instruktora/trenera podaje się rok ich uzyskania (licencja trenerska w profilu).
4. **Profil trenera:** pula punktów = kompetencje (50–72) + doświadczenie żużlowe (0–6); 9 atrybutów trenera, specjalizacja i profil poboczny.
5. **Wybór klubu** i długość kontraktu menedżera (1–3 sezony; pensja według ligi i renomy).

Gracz zawsze jest menedżerem drużyny (główny trener w sztabie klubu). Dotychczasowy menedżer klubu odchodzi i trafia do trenerów bez kontraktu. Profil gracza ma te same zakładki co profile trenerów (Przegląd, Kontrakt, Historia); historia jest pusta – gracz jest debiutantem.

Gracz-trener jest osobą w sztabie (`role: 'coach'`, `player: true`, bez pensji i kontraktu) i działa w treningu jak każdy trener: atrybuty, profil, autorytet. Autorytet zależy od doświadczenia trenerskiego, kariery zawodniczej i charyzmy. Dotychczasowi trenerzy klubu zostają asystentami. Profil menedżera jest pod `#/menedzer` (Sztab → karta menedżera).

Atrybuty menedżera są zapisane w `G.manager.attrs`; funkcja `mgrAttr(k)` zwraca 10 dla zapisów sprzed kreatora. Wpływ atrybutów menedżera na negocjacje, morale, finanse itd. nie jest jeszcze podłączony.

## Upływ czasu

Przycisk „Dalej” uruchamia tryb dzień po dniu: kolejny dzień co 3 sekundy (`DAY_DELAY` w `js/ui-core.js`). Pierwszy dzień mija od razu, ponowne kliknięcie („Stop”) zatrzymuje. Czas zatrzymuje się sam, gdy:
- drużyna ma mecz – gra przechodzi do zapowiedzi meczu;
- przychodzi nowa wiadomość – otwiera się skrzynka;
- są zawody z udziałem naszych zawodników, adeptów albo drużyny (także Grand Prix) – otwiera się strona zawodów.

Logika jednego dnia: `advanceDay()` i `clubEventsOn()` w `js/game.js`. `advance(n)` (przeskok do 7 dni) zostaje dla testów i `ACT.skipDays(n)`.

## Sparingi przed sezonem

Model jest w `js/sparing.js`, ekrany w `js/ui-sparing.js` (Kalendarz → Sparingi), test: `node tools/test-sparing.js`. Wzorzec to sezony 2025–2026: kluby jeżdżą 4–6 sparingów od połowy marca do startu ligi, najczęściej dwumecze dzień po dniu (np. Sparta 2026: Włókniarz 24/25.03, Unia 1/2.04).

- **Okno sparingowe:** 8 marca – 30 kwietnia (także wolne dni po starcie ligi). Termin najwcześniej 3 dni od dziś, bez meczu ligowego i innego sparingu tego dnia.
- **Zaproszenie gracza** (jak w FM): rywal, dwumecz albo jeden mecz, gospodarz pierwszego meczu, daty, bilety (wstęp wolny / 10 / 20 zł). Rywal odpowiada wiadomością po 1–3 dniach. Asystent pokazuje szanse na zgodę i zajęte terminy rywala. Na zgodę wpływają: odległość, różnica lig, renoma, liczba umówionych sparingów (maks. 6), dwumecz albo mecz u rywala.
- **„Zleć asystentowi”** wysyła zaproszenia na dwumecze (do 4 sparingów) do bliskich klubów z podobnego poziomu.
- **Kluby AI** układają swoje sparingi 15 stycznia (PGE 4–6, 2. Ekstraliga 3–5, KLŻ 2–4) i zapraszają gracza, gdy ma mniej niż 4 sparingi. Zaproszenie przyjmuje się albo odrzuca w skrzynce lub na liście; wygasa po 10 dniach.
- **Rozegranie:** silnik i tabela biegowa meczu ligowego (15 biegów). Składy według zasad ligi (te same funkcje co awizacja: `autoLineup` / `validLineup`): juniorzy na 6–7, U24 na 8 i wśród 1–5, co najmniej 4 zawodników krajowych, zastępstwo zawodnika. Gracz może ustawić skład sparingowy (numery 1–8, puste pole = automat, niedozwolone wybory zablokowane). Sparing gracza jest jak mecz ligowy: „Dalej” zatrzymuje się w dniu sparingu (po decyzji pogodowej), a na stronie sparingu można go rozegrać bieg po biegu – rezerwa zwykła i taktyczna, nominacje do biegów 14–15, wybór silnika na bieg – albo zasymulować całość. „Dalej” bez rozpoczęcia (lub w trakcie) dokańcza sparing symulacją. Silniki zużywają się jak w meczu. Obcokrajowcy są dostępni od 12 marca. Deszcz albo mróz (poniżej ~2,5°C) przekłada sparing najwyżej dwa razy na wolny dzień w ciągu 3 dni, potem go odwołuje.
- **Skutki:** wpis w dzienniku startów (rytm, technika w treningu), forma, obserwacja zawodników rywala, ryzyko kontuzji, koszty organizacji i wyjazdu, przychód z biletów. Sparing nie liczy się do statystyk, tabel, licencji, premii za punkty ani rekordu toru i nie trafia do `G.matches`. Pełny przebieg biegów zostaje tylko dla sparingów gracza (`G.sparings[id].match`).
- W soboty okresu przygotowawczego zawodnicy bez sparingu mają trening punktowany w klubie (`js/schedule.js`).

## Tor: przygotowanie, próba toru, przerwy techniczne

Model jest w `js/track.js`, ekrany w `js/ui-track.js` (Klub → Tor, panel w zapowiedzi meczu i w meczu na żywo). Testy: `node tools/test-track.js` (model i wpływ na biegi), `node tools/test-track-browser.cjs` (ekrany, polecenia w przerwie, zapis w SQLite).

Podstawa w regulaminach (`data/heat-tables/sources`):
- toromistrz kieruje pracami przy torze i wykonuje polecenia sędziego i komisarza toru; trener i menedżer gospodarza współodpowiadają za przygotowanie toru (Regulamin Zawodów PZM, art. 44);
- komisarz toru jest obowiązkowy w Ekstralidze, 2. Ekstralidze i KLŻ (art. 35);
- próba toru (Ekstraliga, 2. Ekstraliga, KLŻ): 30 min przed zawodami, po 2 zawodników drużyny, 4 sesje po 1,5 min, bez startów spod taśmy;
- przerwy techniczne na równanie toru (najwyżej 5 min) są w tabelach biegowych (`gradingAfter`): liga po biegach IV, VII, X, XIII; zawody indywidualne co 4 biegi; KLŻ po VII biegu ma długą przerwę (10 min);
- w zawodach FIM o polewaniu i równaniu decyduje dyrektor zawodów.

**Stan toru** (`m.surf`): trzy pasy (przy krawężniku, środek, zewnętrzna), każdy z ilością materiału (od twardego i wybitego do głębokiego i grząskiego), do tego wilgotność toru i koleiny. Po każdym biegu materiał przesuwa się na zewnętrzną, tor przesycha (szybciej w upale i słońcu), przybywa kolein. Opis toru w pogodzie zawodów (`weather.track`) jest liczony ze stanu toru.

**Wpływ na bieg** (`surfFx`, `runHeat`). Dla toru przyczepnego i równego modyfikatory są zerowe, więc kalibracja wyników się nie zmienia.
- Tor twardy: start decyduje, mniej mijanek, szybsze czasy, silniki „na prędkość”.
- Tor głęboki: więcej mijanek, większa losowość, częstsze upadki, silniki z momentem.
- Materiał na zewnętrznej premiuje jazdę po zewnętrznej, twarda zewnętrzna – jazdę przy krawężniku.
- Pola startowe nie są ustawiane osobno: ich przewaga wynika z nawierzchni pod polami. Grząski krawężnik i twarda zewnętrzna osłabiają pole A i wzmacniają C/D.
- Atut własnego toru jest pełny, gdy tor jest przygotowany jak na co dzień (profil toru klubu). Po każdym meczu domowym profil przesuwa się w stronę przygotowywanego toru.

**Kto decyduje:**

| Zawody | Przygotowanie | Prace w przerwach |
|---|---|---|
| liga PL, gracz gospodarzem | plan gracza (Klub → Tor: domyślny albo na konkretny mecz), komisarz toru koryguje plan poza normą | polecenia gracza (polewanie: brak / lekko / mocno; materiał: do krawężnika / tylko równać / szeroka ścieżka) albo propozycja toromistrza |
| liga PL, gospodarz AI; ligi zagraniczne | AI: profil najbardziej różnicujący drużyny (trafność – taktyka trenera), z przywiązaniem do własnego toru | AI wraca do planu; przegrywając co najmniej 6 pkt szuka toru lepszego dla swoich |
| sparing | jak w lidze, bez komisarza toru | jak w lidze |
| zawody PZM na torze gracza | plan gracza złagodzony do toru zbliżonego do neutralnego | sędzia / komisarz toru |
| pozostałe zawody PZM, FIM | organizator / dyrektor zawodów: tor neutralny | sędzia / komisarz / dyrektor zawodów |

Tor wychodzi tym bliżej planu, im lepszy toromistrz (atrybut „Przygotowanie toru”) i infrastruktura toru klubu. Pogoda zmienia wilgotność.

**Próba toru** (mecze ligowe i sparingi): trener wskazuje w zapowiedzi meczu 0–2 zawodników, a bez wyboru robi to sztab. Raport jest tym dokładniejszy, im wyższe Dopasowanie sprzętu i wiedza techniczna testujących. Wiedza drużyny o torze (`m.know`) zmniejsza błąd wyboru silnika na bieg. Na wyjeździe bez próby drużyna wie o torze najmniej. Próba kosztuje trochę kondycji i zużycia silnika i nie mówi nic o polach startowych. W zawodach indywidualnych wszyscy mają oficjalny trening.

## Obozy przygotowawcze

Model jest w `js/camps.js`, ekrany w `js/ui-camps.js` (Kalendarz → Obozy), test: `node tools/test-camps.js`.

- **Typy:**
  - A – kondycyjny w kraju (COS OPO Szczyrk, Zakopane, Spała, Cetniewo, Świnoujście), 15.11–31.03, 3–10 dni;
  - B – motocross i kondycja w Hiszpanii (Lloret de Mar, Calpe, Majorka), 7.01–10.03, 4–8 dni;
  - C – tor żużlowy za granicą (Goričan, Krško, Žarnovica, Lonigo, Terenzano, Debreczyn), od otwarcia toru do 8.04, 2–6 dni.
- **Rezerwacja:** min. 7 / 10 / 21 dni wcześniej, bez meczu, sparingu i innego obozu w tych dniach; na torze najwyżej 2 kluby dziennie. Kluby AI rezerwują od 10 grudnia. Odwołanie na mniej niż 14 dni przed wyjazdem kosztuje 50% pobytu i toru.
- **Koszt liczony na osobę:**
  - pobyt × dni, przejazd (A: bus, B: lot);
  - B: wynajem crossów za dzień MX;
  - C: opłata za tor za każdy dzień torowy, transport motocykli (2–3 motocykle zawodnika, 1 bus na 3 motocykle, km tam i z powrotem × 2,2 zł + 450 zł; juniorzy busem klubowym po dwóch), mechanicy zawodnika (`equip.mechanics`) i materiały 650 zł za dzień torowy;
  - sztab: pobyt i przejazd.
  - Klub płaci w dniu wyjazdu pobyt, przejazdy, tor i transport (kategoria finansów „Obozy przygotowawcze”). Senior płaci z budżetu sprzętowego swoich mechaników i materiały (`camp.paid`), juniorów klub finansuje w całości.
- **Uczestnicy:** gwiazdy (Grand Prix, wysoki poziom) i obcokrajowcy mogą odmówić – mają własny program przygotowań. Kontuzjowani nie jadą.
- **Przebieg dzień po dniu:**
  - pogoda w miejscu obozu (Polska + różnica klimatu);
  - A: kondycja;
  - B: podróż, motocross (ryzyko urazu), co trzeci dzień kondycja;
  - C: pierwszy dzień dojazd z motocyklami, potem dzień torowy = standardowy trening na torze (`trackSession` w `js/equipment.js`: zużycie i docieranie silników, ryzyko upadku), przy deszczu bez jazdy.
  - Zmęczenie mniejsze z fizjoterapeutą lub lekarzem.
- **Rozwój** (`campBoost` → `applyDevelopment`): dni kondycji i MX wzmacniają okno atrybutów fizycznych, MX i tor dodają technikę, tor także warsztat, wspólny wyjazd – mentalność i morale. Dni torowe na obozie liczą się w ocenie tygodnia torowego jak dobre (polska pogoda ich nie odbiera). Efekt zależy od zabranego sztabu: bez motoryka ok. 60% efektu fizycznego, bez trenera ok. 60% techniki, bez mechanika parku maszyn 70% warsztatu. Dni obozu są dniami z klubem (wpływ klubu na trening także u obcokrajowców).

## Organizacja memoriałów i turniejów

Model jest w `js/memorial.js`, a zakładka „Organizacja” (u innych organizatorów „Nagrody”) w `js/ui-memorial.js` (strona zawodów `#/gp/<id>/organizacja`). Test: `node tools/test-memorial.js`.

- **Dotyczy** zawodów indywidualnych klasy „turniej / memoriał” na stadionie klubu (np. Memoriał Smoczyka – Leszno, Jancarza – Gorzów, Idzikowskiego i Czernego – Częstochowa, Kryterium Asów – Bydgoszcz). Organizatorem jest klub, na którego stadionie są zawody.
- **Organizator** ustala pulę nagród (podział na 16 miejsc: 25%, 17%, 13%, 9%, 6%… do 1,7%) i zaprasza zawodników, ewentualnie ze startowym. Zaproszenia są otwarte od 75 dni przed zawodami do ogłoszenia listy startowej (14 dni przed). Wiadomość przypomina o tym na początku okresu zaproszeń. Do obsady przyjmuje się 16 zawodników + 2 rezerwowych.
- **Zawodnik odpowiada po 1–3 dniach.** Przyjmuje, gdy startowe + spodziewana nagroda (według miejsca, jakie zająłby w obecnej obsadzie) pokrywa jego oczekiwania. Oczekiwania rosną z poziomem, są wyższe dla zawodników Grand Prix, a dolicza się do nich przelot z zagranicy przed sezonem. Przed startem ligi są o 40% niższe (zawodnik potrzebuje jazdy), a dla zawodników klubu organizatora – o 60%. Odmawia też przy innym starcie tego dnia, kontuzji, zawieszeniu albo przyjętym innym zaproszeniu. Przy odmowie z powodów finansowych menedżer podaje, ile brakuje. Ponowne zaproszenie wymaga lepszych warunków.
- **Kluby AI** organizują swoje zawody tym samym modelem. Pula zależy od ligi i renomy (mniejsza przy ujemnym saldzie), a na startowe przeznaczają do 50% puli (PGE) lub 30% (pozostali). Zapraszają od najlepszych w dół, aż skompletują obsadę – bogatszy klub ma mocniejszą stawkę. Niepełną obsadę gracza na dzień ogłoszenia listy uzupełnia asystent tym samym sposobem.
- **Po zawodach** organizator płaci nagrody według klasyfikacji i startowe zawodników, którzy pojechali (finanse: „Imprezy i wynajem stadionu”). Pieniądze trafiają do budżetów sprzętowych zawodników.
- **Obsada a frekwencja:** czołówka i zawodnicy Grand Prix podnoszą atrakcyjność zawodów (mnożnik 0,6–1,8 w `eventGateCalc`, `js/stadium.js`).
- Organizowane przez nas zawody są w „Moich zawodach” z dopiskiem „organizator”.

## Egzaminy na licencję w kalendarzu

Sesje egzaminacyjne PZM („Egzamin na licencję Ż i 250 cc/500R”) są w widoku miesiąca zawsze, niezależnie od filtra „młodzież / 500R”. Gdy zdaje nasz adept, sesja jest wyróżniona, a w opisie są nazwiska. `examMine(ev)` w `js/competitions.js` zbiera naszych zdających: licencja Ż, licencja 250 cm³/500R i certyfikat 85–140 cm³, powroty po wygasłej licencji; po sesji – z protokołu. Każdy zdający jest przypisany do najbliższej sesji, na którą się kwalifikuje. Takie sesje są w „Moich zawodach”, a „Dalej” zatrzymuje się w dniu egzaminu naszego adepta.

## Obywatelstwa i zawieszenie FIM

Model jest w `js/nationality.js`, a lista podwójnych obywatelstw w `js/realdata.js` (`DUAL_NATIONALITY`).

- **Pierwsze obywatelstwo to kraj macierzysty** (`r.country`). Od niego zależą barwy w zawodach FIM i FIM Europe, reprezentacja, mistrzostwa krajowe (`polEligible`: IMP, kaski, MIMP, mecz reprezentacji) i zawieszenia.
- **Kolejne obywatelstwa to dodatkowe paszporty.** Polski paszport daje status zawodnika krajowego w polskiej lidze (`isDomestic`: limity składu, numery juniorskie, U24), a także kontrakt amatorski juniora, licencję PZM, zamieszkanie w Polsce i potrzeby kadrowe klubów AI.
- **Decyzja FIM co roku 1 grudnia** (`fimDay()`), na kolejny sezon: szansa przywrócenia 10% w 2026 r. (na sezon 2027) i co roku o 10 pkt proc. więcej (20% w 2027, 50% w 2030, pewność w 2035). Przywrócenie przychodzi jako wiadomość „Koniec wojny – FIM przywraca federacje” i działa od 1 stycznia: zawodnicy znów startują jako Rosjanie (Białorusini), wracają reprezentacje. Utrzymanie zawieszenia to krótka wiadomość. Stan: `G.fimLift` (`from`, `decided` według lat). Zawieszenie jest sprawdzane na dzień zawodów, a stawka Grand Prix – na dany sezon.
- **Zawieszenie FIM** (Rosja i Białoruś, od 1.03.2022, do decyzji FIM) obejmuje zawodników z tym krajem macierzystym, także z drugim obywatelstwem. Nie startują w zawodach FIM i FIM Europe (SGP i kwalifikacje, SGP2–4, DPŚ, SON, IME, DME, MEP, zawody U19/U24, MACEC). Zawieszone kraje nie mają kadry narodowej. Gdy zawodnik zawieszonej federacji jest w stawce Grand Prix, zastępuje go rezerwowy. Ligi krajowe i zagraniczne bez ograniczeń.
- **W Polsce** (liga, zawody PZM, kontrakty i wypożyczenia do polskich klubów) zawodnik zawieszonej federacji może jeździć tylko z polskim obywatelstwem (`plBanned`). Bez niego jest niedostępny w składach i zawodach, a polski klub nie zarejestruje z nim kontraktu – do czasu zniesienia zawieszenia (kontrakt na sezon, od którego zawieszenie już nie obowiązuje, jest możliwy). Ligi zagraniczne bez zmian.
- Łaguta, Sajfutdinow, Tarasenko i Czugunow mają obywatelstwa Rosja + Polska: w zawodach FIM są zawieszeni, w polskiej lidze jeżdżą jako zawodnicy krajowi. Greg Łaguta: Łotwa + Rosja, bez zawieszenia.
- Profil zawodnika pokazuje flagi wszystkich obywatelstw w kolejności i znacznik „bez startów FIM”. Filtr narodowości na rynku uwzględnia każde obywatelstwo.

## Rynek zawodników

Zasady według Regulaminu Przynależności Klubowej i Zbioru Zasad PZM 2026. Analiza przepisów: `tools/sources/regulaminy/ANALIZA_kontrakty_transfery.md`, kod: `js/market.js`.

- **Okienka transferowe:**
  - podstawowe 16–20 listopada i uzupełniające 22–31 grudnia;
  - śródroczne: pięć dni po 3., 6., 10. i 14. kolejce danej ligi, tylko dla zawodników bez klubu, niezgłoszonych w sezonie.
  - Uzgodniony transfer czeka na najbliższe okienko.
- **Prekontrakty:** od 15 czerwca zawodnik z kończącą się umową może uzgodnić kontrakt na kolejny sezon z dowolnym klubem, także z obecnym. Wcześniej obowiązuje zakaz kontaktów.
- **Zawodnik z ważnym kontraktem** zmienia klub tylko za zgodą klubu i tylko w okienku listopadowym lub grudniowym. Klub dostaje:
  - odstępne, albo
  - kwotę z klauzuli odstępnego (jej zapłata wymusza zgodę), albo
  - ekwiwalent za wyszkolenie: juniorzy do 21 lat, do 160 tys. zł za rok w klubie szkolącym; płacony także za wolnego juniora.
- **Kontrakty:**
  - od 1 do 6 sezonów;
  - podpis może rosnąć lub maleć rok do roku;
  - stawka za punkt, opcjonalnie wyższa przy 10+ punktach w meczu;
  - opcjonalna premia za medal lub awans i klauzula odstępnego.
  - Podpis wypłacany jest w 6 ratach od lutego do lipca.
  - Juniorzy mogą mieć kontrakt amatorski: klub płaci za sprzęt, zawodnik dostaje stypendium do 1000 zł miesięcznie. Pierwszy kontrakt adepta po egzaminie jest amatorski.
- **Ekran oferty** (`#/oferta/<id>`, bez okien modalnych) w stylu FM:
  - warunki podstawowe obok żądań zawodnika;
  - premie dodawane z listy, każda z własną kwotą: mistrzostwo, medal, play-off, awans, utrzymanie, średnia ≥ X, punkty ≥ X, mecze ≥ X;
  - klauzule: zmiana podpisu rok do roku, stawka przy 10+ pkt, stawka w zawodach młodzieżowych, odstępne, podwyżka po awansie, obniżka po spadku;
  - ocena oferty, koszty, limit płac i przebieg rozmów.
- **Pozostałe przepisy:**
  - w zawodach młodzieżowych wyłącznie wynagrodzenie za punkty (kontrakt amatorski bez stypendium: 100/150/250 zł);
  - potrącenie podpisu za mecze opuszczone przez kontuzję spoza ligi polskiej i zawodów PZM;
  - po 9 miesiącach kontuzji klub może rozwiązać kontrakt bez kosztów;
  - PRO Junior: po sezonie 8 mln zł dla klubów PGE według punktów juniorów-wychowanków;
  - od 2027 limit płac w PGE: 70% przychodów, umowa ponad limit nie zostanie potwierdzona.
- **Licencje klubów** (`js/licence.js`, zakładka Klub → Licencja; pierwszy cykl w grze: jesień 2026, licencje na 2027):
  - 20.10 wniosek, 31.10 termin spłaty zobowiązań;
  - 10.11 rekomendacja: „klub zagrożony finansowo” albo negatywna oznacza brak rejestracji w okienku 16–20.11;
  - 14.12 decyzja: licencja, licencja z nadzorem (zakaz umów zawodowych przy zaległościach, raporty miesięczne, nakaz obniżki wynagrodzeń z aneksami, zawieszenie licencji) albo odmowa (degradacja o ligę, w KLŻ brak startu; seniorzy mogą odejść).
  - Najwyżej jedna odmowa na ligę; KLŻ nie schodzi poniżej 6 drużyn.
  - Zaległości ponad 21 dni: zawodnicy mogą rozwiązać kontrakt z winy klubu, a klub nie podpisze prekontraktu.
- **Negocjacje trwają kilka dni.** Zawodnik porównuje wszystkie oferty na stole. Ma kilka ofert albo dużo czasu do końca okienka – dłużej czeka i żąda więcej; czas się kończy – obniża oczekiwania. Odpowiada przyjęciem, kontrpropozycją albo odmową. Ofertę można zmienić lub wycofać.
- **Wypożyczenia:**
  - do ostatniej rundy sezonu zasadniczego, do 31 października;
  - tylko zawodnik z najwyżej 12 punktami ligowymi w sezonie, raz w sezonie;
  - klub wypożyczający płaci według nowej umowy.
  - Zawodnika można udostępnić do wypożyczenia; kluby AI składają wtedy propozycje.
- **Oznaczenia przy nazwiskach** (jak ikony w FM):
  - lista transferowa, dostępny do wypożyczenia, wypożyczony;
  - zainteresowanie innych klubów, oferta kontraktu z innego klubu, oferta transferowa czekająca na zgodę klubu;
  - uzgodnione przejście, negocjacje z naszym klubem.
  - Legenda jest w zakładce Transfery → Okienka i przepisy.
- **Kluby AI:**
  - przedłużają umowy i składają oferty w okresie prekontraktów i zimą;
  - wystawiają zbędnych zawodników na listę i do wypożyczeń;
  - składają oferty za zawodników gracza (decyzja w skrzynce);
  - 30 grudnia uzupełniają brakujące miejsca w kadrach.

Odświeżenie danych:
- `python tools/fetch_calendar.py [--refresh]` pobiera terminarze GKSŻ/PZM i kalendarz FIM i generuje `js/calendar.js`.
- `python tools/fetch_rosters.py [--refresh]` pobiera kadry, sztaby, szkółki i osoby funkcyjne i generuje `js/rosters2026.js`.
- `python tools/fetch_riderstats.py [--refresh]` pobiera historię sezonów ligowych w Polsce i licencje zawodników z Polish Speedway Database (speedway.com.pl) i generuje `js/riderhistory.js`. Rok urodzenia jest weryfikowany, żeby nie pomylić zawodników o tym samym imieniu i nazwisku.
- `python tools/fetch_club_history.py [--refresh]` pobiera tabele lig 1961–2025 z Polish Speedway Database (ostateczna kolejność, runda zasadnicza, awanse/spadki) i dokłada sezony 1948–1961 ręcznie przepisane ze speedwayw.pl (`tools/sources/speedwayw/early.txt`); generuje `js/club-history.js`. Zakładka Historia klubu (własnego i każdego innego) łączy te sezony z sezonami rozegranymi w grze; nazwy lig jak w historii zawodników („Ekstraliga”, „1 liga”, „2 liga”, „3 liga”). Kluby są łączone z danymi po mieście, tak jak w PSD. Liga → Historia pokazuje medalistów, awanse i spadki od 1948 r. według poziomu: dawna 1 liga (do 1999) = PGE Ekstraliga, dawna 2 liga = 2. Ekstraliga, 3 liga (1957–59) = KLŻ. Test: `node tools/test-club-history-browser.cjs`.
- `python tools/fetch_club_managers.py` generuje `js/club-managers.js` – kolumnę „Menedżer” w historii klubu: lata 2020–2025 z protokołów meczów PSD, wcześniejsze z ręcznie zebranych okresów pracy w `tools/sources/club-managers.txt` (Wikipedia, speedwayw.pl; dane niepełne). W sezonach rozegranych w grze zapisuje się menedżer gracza albo główny trener klubu AI.
- `python tools/fetch_staff_born.py [--refresh]` pobiera z Polish Speedway Database daty urodzenia trenerów i osób ze sztabów szkoleniowych (wielu to byli zawodnicy) i generuje `js/staff-born.js`. Lista głównych trenerów 2026, ich oceny i pensje są w `js/coaches.js`.
- `python tools/fetch_coach_history.py [--refresh]` buduje historię osób ze sztabów i generuje `js/staff-history.js`:
  - kariera zawodnicza: sezony ligowe z Polish Speedway Database;
  - kariera trenerska 2020–2025: protokoły meczów PSD (kto był trenerem lub menedżerem drużyny);
  - kariera trenerska przed 2020: kluby i lata z polskiej Wikipedii;
  - bilans Z-R-P: ze wszystkich meczów ligowych drużyny (strony lig PSD, z play-offami); miejsce: z klasyfikacji końcowej.
- `python tools/import_xlsx.py [--dane ścieżka]` generuje `js/data.js`. Czyta bazę globalną, `Dane.xlsx` (z katalogu gry albo z `D:\speedway`) i `img/assets-map.json`.

## Dane

- `js/data.js` generuje się z pliku `globalna_baza_zuzlowcow_*.xlsx` poleceniem `python tools/import_xlsx.py` (wymaga `openpyxl`).
- Następujące elementy są generowane przez grę: atrybuty 1–20, sprzęt, sztaby, adepci szkółki oraz dzień i miesiąc urodzenia (w bazie jest tylko rocznik; brakujące roczniki są szacowane i oznaczone gwiazdką).
- Śląsk Świętochłowice (KLŻ) nie występuje w arkuszu xlsx. Dopisano go w `tools/import_xlsx.py` (lista `EXTRA_CLUBS`) z szacunkowym budżetem, stadionem i frekwencją; kadrę buduje z wolnych zawodników.
- Kolejarz Rawicz i WTS Warszawa (też w `EXTRA_CLUBS`, dane szacunkowe) nie startują na początku gry, podobnie jak Unia Tarnów. Od sezonu 2027 co roku mogą zgłosić się do KLŻ: Rawicz z szansą 35%, Warszawa 15% (pole `joinChance`). Unia Tarnów wraca do KLŻ zawsze. W starszych zapisach gry kluby dodaje `addMissingClubs()` przy wczytaniu. Herby: Wikimedia Commons (Rawicz) i logo WTS w wysokiej rozdzielczości (dostarczone przez użytkownika).
- Barwy klubów i długości torów w `tools/import_xlsx.py` są przybliżone. Barwy klubów to główne kolory herbów (`img/logos`), zaszyte na stałe w `CLUB_EXTRA` – w grze nie można ich zmieniać.
- Zdjęcia zawodników, herby klubów i logo lig: pliki w `img/riders` i `img/logos` (nazwy w formie slugów) są przypisane do identyfikatorów przez `img/assets-map.json`. Klucze w tej mapie to kolumna „Lp.” z arkusza „Baza globalna” dla zawodników oraz numer wiersza klubu w arkuszu „Kluby 2025” (1–23). Po zmianie mapy uruchom `python tools/import_xlsx.py`. Zawodnicy bez zdjęcia mają grafikę kasku w barwach klubu.

## Finanse klubów

Moduł finansów jest w plikach `js/finance.js` (logika), `js/finance-data.js` (parametry i baza firm) i `js/ui-finance.js` (ekrany). Research, kwoty i źródła opisuje `data/finance/README.md`.
- Rok finansowy trwa od 1 listopada do 31 października. Zakładka Przepływy pokazuje miesięczne wpływy i wydatki: wykonanie i prognozę do końca sezonu.
- Główne pozycje finansów klubu:
  - wypłaty ligi (TV), Fundusz Atrakcyjności (za mijanki), PRO Junior, nagrody za medale i fundusz rezerwowy;
  - karnety, bilety, loże, gastronomia, gadżety i imprezy;
  - dotacje miasta, opłaty licencyjne, organizacja meczów i Ekstraliga U24.
- Sponsorzy (js/sponsors.js): klub ustala cennik miejsc reklamowych na 3 sezony, firmy same zgłaszają się z propozycjami albo są zapraszane z rynku firm. Umowy są wieloletnie: kwota na każdy sezon, premie za wynik (medal, awans, utrzymanie, frekwencja), klauzule na awans i spadek, wyłączność branżowa. Miejsca na kolejny sezon można sprzedać przed wygaśnięciem obecnej umowy. Sponsor tytularny zmienia nazwę drużyny.
- Licencje „Ż” i kadry juniorskie: kluby AI zgłaszają na egzamin tylko najlepszych adeptów – roczny limit zdanych licencji: PGE 3, 2. Ekstraliga 2, KLŻ 2, szkółka 1 (kalibracja: ok. 25–35 licencji rocznie w Polsce); egzaminy z rejestru PZM 2026 i adepci gracza bez limitu. Przed nowym sezonem klub AI trzyma najwyżej 8 juniorów z licencją: słabi bez perspektyw tracą kontrakt, rokujący trafiają na listę transferową i do wypożyczenia. Na ekranach klubu zamiast wpisanego na starcie budżetu – planowane przychody sezonu (z wpłatą właściciela).
- Okno przedłużeń i prekontraktów: przypomnienie 8 czerwca, komunikat 15 czerwca z listą kończących się umów. Przed oknem i w jego trakcie można wybadać zawodnika („Porozmawiaj o przyszłości”, raz na 30 dni): chęć przedłużenia (morale, dotrzymanie obietnicy roli, zainteresowanie innych klubów) i oczekiwania. Wypożyczenia nie da się przedłużyć poza 31.10, ale od 15 czerwca można uzgodnić z klubem macierzystym i zawodnikiem wypożyczenie na kolejny sezon (start 1 listopada); alternatywy: wykup albo prekontrakt. Kluby niechętnie wypożyczają zawodników rywalom z tej samej ligi – zwłaszcza gdy rywalowi brakuje zawodnika do pierwszego składu (odmowa albo wyższa opłata). Kontrakt warszawski: tylko rola „Awaryjny”.
- Budżety (js/budget.js, Finanse → Budżet): plan sezonu (rok finansowy 1.11–31.10) = planowane przychody + zadeklarowana wpłata właściciela (stała od 1 grudnia; właściciel nie pokrywa już automatycznie deficytu) − koszty stałe − szkółka − tor i park maszyn − rezerwa 5%; resztę suwak dzieli między płace (zawodnicy: podpis + stawka × przewidywane punkty + premie; sztab) i transfery (odstępne, ekwiwalenty, opłaty za wypożyczenia). W PGE kontrakty zawodników ogranicza limit 70% przychodów (suwak zatrzymuje się na nim). Przewidywane punkty: rola (biegi na mecz), średnia z poprzedniego sezonu przeliczona na ligę i model z poziomu. Oferta ponad budżet jest zablokowana (prośba do zarządu o zwiększenie – najwyżej 2 na sezon). Kluby AI działają w tych samych budżetach (zakupy, przedłużenia w kolejności ról, oferty za naszych zawodników tylko przy potrzebie składu, uzupełnienia kadry tańszymi umowami, renegocjacje kontraktów klubów ponad budżetem). Panel „Wpływ na budżet” na ekranie oferty. Finanse → Podsumowanie: lata finansowe w grupach kategorii, saldo 31.10, plan vs wykonanie, ranking finansowy ligi (księga roczna wszystkich klubów).
- Role w drużynie (js/roles.js): Lider, Ważny zawodnik, Zawodnik podstawowy, Doparowy, Senior U24, Junior podstawowy, Talent, Junior DMPJ, Rezerwowy, Awaryjny, Niepotrzebny. Rola jest punktem kontraktu (obietnica startów): zawodnik oczekuje roli wynikającej z poziomu i składu klubu, niższa = wyższe żądania lub odmowa. Co miesiąc (maj–październik) starty są porównywane z obietnicą – złamana obniża morale (słabsza forma, prośba o transfer, trudniejsze przedłużenie). Rolę można zmienić jednostronnie w profilu (degradacja obniża morale). Klub nie odda lidera ani ważnego zawodnika, jeśli nie ma go kim zastąpić (uzgodniony kontrakt albo podobny zawodnik na rynku; Polaka – tylko Polak); przedłuża ich w pierwszej kolejności. Wykup i wypożyczenie są dwuetapowe: najpierw kwota z klubem, po jego zgodzie 14 dni na kontrakt z zawodnikiem.
- Licencja zawodnika (js/rider-licence.js, Regulamin szkolenia PZM): ważna do 31 grudnia, przedłuża się po co najmniej 5 biegach w roku – liczą się wszystkie starty z historii zawodnika (liga, DMPJ, MIMP, U24 i inne zawody, ligi zagraniczne), bez sparingów treningowych. Bez 5 biegów: status „licencja wygasła” – zawodnik może podpisać kontrakt, ale startuje dopiero po zdaniu egzaminu na licencję „Ż” (zgłoszenie w profilu, sesje z kalendarza PZM). Po roku i dłuższej przerwie traci część umiejętności, którą szybko odzyskuje w treningu. Status „licencja wygasła” trwa (także po długiej przerwie), dopóki zawodnik nie zda egzaminu albo nie ogłosi końca kariery – co sezon tym chętniej, im jest starszy i dłużej nie jeździ. Koniec kariery jest ostateczny – bez powrotów. Wyszukiwarka: filtr Licencja (z licencją / wygasła / zakończyli karierę / wszyscy).
- Liga i miasto: wypłaty ligi rozpisane na prawa TV, fundusz rezerwowy i sponsora rozgrywek; wsparcie miasta na składniki, w tym dotacje celowe (szkolenie młodzieży, organizacja imprez), które można wydać tylko na swój cel – niewykorzystane wracają do miasta 31 października.
- Klub może zdobyć pieniądze z kredytu, z poręczenia albo dotacji nadzwyczajnej miasta, od akcjonariuszy, ze zbiórki kibiców albo z przedpłaty od sponsora.
- 31 października odbywa się kontrola licencyjna. Klub z zaległościami dostaje licencję nadzorowaną i zakaz nowych kontraktów.
- `node tools/export-firms.cjs` zapisuje bazę firm do `data/finance/firmy.csv` i `sponsorzy-klubow.csv`.

## Kalibracja poziomu zawodników

Pliki w `data/kalibracja` (CSV: separator „;”, przecinek dziesiętny, UTF-8 z BOM).

- `node tools/export-calibration.js` zapisuje `zawodnicy_kalibracja.csv`: zawodników nowej gry, ich atrybuty i średnie ligowe 2023–2025 z PSD.
- `python tools/fetch_external_stats.py [--refresh]` pobiera wyniki 2025 spoza polskiej ligi i zapisuje je w `zrodla_zewnetrzne.json`:
  - średnie ligowe: Szwecja (SVEMO), Dania (DMU), Wielka Brytania (speedwaygbarchive);
  - zawody z Wikipedii: SGP, SGP2, podia SGP3, IME z eliminacjami, IME U19, IMP, Złoty Kask, Kryterium Asów, MIMP oraz mistrzostwa Szwecji, Danii, Wielkiej Brytanii i Australii.

  Strony trafiają do `tools/sources/ext`. Serwer GB odpowiada wolno, więc pierwsze pobranie trwa około 40 minut.
- `python tools/fetch_youth_stats.py [--refresh]` pobiera wyniki do oceny talentu i szczytu kariery i zapisuje je w `zrodla_mlodziez.json`:
  - protokoły PSD (Puchary Ekstraligi U-17 i 2. Ekstraligi U-19, Zaplecze Kadry) z lat 2024–2026;
  - relacje SportoweFakty (DMPJ, MIMP, kaski, U24 Ekstraliga, IMP);
  - klasyfikacje Grand Prix 2005–2024 z Wikipedii;
  - podia miniżużla z listy w skrypcie, ze źródłami;
  - protokoły miniżużla (85–140 cm³, 500R, 250 cm³) z relacji speedwaynews.pl z lat 2023–2026, w działach „Mini żużel/250cc” i „Juniorzy”.

  Zawodnicy miniżużla trafiają do pliku kalibracji z tymi samymi kolumnami CA i PA co seniorzy.

  Dane z 2026 służą tylko kalibracji. Gra startuje 15.10.2025 i ich nie pokazuje.
- `python tools/fetch_rus.py [--refresh]` zbiera wyniki ligi rosyjskiej i zapisuje je w `zrodla_rosja.json`:
  - protokoły zawodów 2025 i wcześniejszych z speedway.su (pobierane z archiwum web.archive.org, bo serwis bywa niedostępny; kopie w `tools/sources/rus`): Drużynowe Mistrzostwa Rosji, Indywidualne Mistrzostwa Rosji oraz zawody U21 i U19;
  - ranking ligi rosyjskiej 2019 z speedway-press.ru. Wtedy wielu zawodników jeździło jednocześnie w Rosji i w Polsce, więc ten sezon służy do przeliczenia ligi rosyjskiej na KSM;
  - daty urodzenia spoza PSD (Wikipedia) albo wiek szacowany z kategorii zawodów młodzieżowych.
- `node tools/fetch-usa.cjs` kopiuje amerykański żużel ze speedwaybikes.com do `data/usa/sources` (relacje i karty wyników 2023–2026, profile zawodników, regulamin AMA 2024 i regulaminy uzupełniające). `node tools/build-usa.cjs` (bez sieci) buduje z nich `data/usa/usa-2026.json` (zasady kategorii mistrzostw USA w klasycznym żużlu, medaliści, zawodnicy ze statystykami i wyborem do gry), `zrodla_usa.json` (wejście kalibracji) i `js/usa-data.js` (rok licencji AMA, krewni, regulamin). Opis i wyniki: `data/usa/README.md`.
- `python tools/calibrate_ability.py` czyta `KSM_Final.csv`, `zrodla_zewnetrzne.json`, `zrodla_mlodziez.json`, `zrodla_usa.json` i strony PSD z `tools/sources/psd`, a zapisuje:
  - `KSM_Final_kalibracja.csv` z kolumnami lig zagranicznych, wynikami zawodów, `KSM_zewn`, `CA` i `PA` (0–100) oraz dopisanymi zawodnikami spoza gry;
  - `dopasowania_nazwisk.txt` z przybliżonymi dopasowaniami nazwisk do sprawdzenia.

  Polska liga jest kotwicą: CA = KSM_FINAL × 5.

  USA: siła θ z zawodów 2023–2026 (odchylenie od pola w pkt/bieg) jest przeliczana jako KSM = a + 3·θ. Wyraz `a` pochodzi od Amerykanów, którzy mają też wyniki w Europie (Becker, Lightcap, Hohlbein, Manzares); goście z Europy na pożyczonych motocyklach służą tylko do kontroli. Zawodnicy znani tylko z USA mają priorytet poziomu swojej klasy (Division 1/2/3). Młodzież 250 i 150 cm³ trafia do modelu miniżużla, a tytuły mistrza USA młodzieży liczą się jak medale IMP.

  Liga rosyjska: KSM = a + b × średnia. Współczynniki dopasowano na sezonie 2019 (15 zawodników jeżdżących wtedy w obu ligach). Korekta zmiany poziomu ligi 2019 → 2025 wychodzi z danych ujemna (−0,37 pkt/bieg), ale jest ograniczona do zera: liga 2025 nie jest mocniejsza (bez czołówki i obcokrajowców), a niższe średnie oznaczają spadek poziomu zawodników w izolacji. Wyniki młodzieżowe przelicza się na równoważnik seniorski (×0,61). Zawodnicy z co najmniej 8 biegami w seniorach albo 12 w zawodach młodzieżowych 2025 są dopisywani do gry; ci, którzy już w niej byli (z PSD), dostają ocenę i ligę. PA to stały, docelowy talent. `PA_min` i `PA_max` to przedział niepewności (około 80%): szeroki u dzieci, wąski u seniorów. Ligi zagraniczne i zawody są przeliczane na KSM względem zawodników, którzy jeżdżą także w Polsce.

- `python tools/derive_attributes.py` przelicza CA i PA na atrybuty (28 atrybutów gry plus Przywództwo, Odporność, Regeneracja oraz ukryte Powtarzalność, Profesjonalizm i Ambicja; skala 1–20). Zapisuje `atrybuty_kalibracja.csv` i `atrybuty_kalibracja.json` (format dla gry).
  - Średnia ważona 28 atrybutów jest dopasowana tak, by 5 × średnia = CA.
  - Profil zawodnika wynika z wieku i statystyk ligowych PSD z lat 2023–2025 (upadki, wykluczenia, taśmy, defekty, bonusy, wygrane biegi, rozrzut punktów). Zawodnicy z USA bez PSD: statystyki z relacji (upadki, wykluczenia, taśmy, defekty; wyniki handicapów → mijanie; wygrane finały ponad poziom → start).
  - Dla czołówki uwzględnia też styl jazdy z artykułów (lista `STYLE` w skrypcie, ze źródłami).
- `python tools/build_calib.py` przenosi kalibrację do gry: z `KSM_Final_kalibracja.csv` i `atrybuty_kalibracja.json` generuje `js/calib-data.js`. Uruchom go po każdej zmianie plików kalibracji.

## Umiejętności zawodników w grze

Model jest w `js/ability.js`.

- **CA i PA (1–100)** są ukryte. CA = 5 × średnia ważona 28 atrybutów (wagi `ATTR_W`), PA to docelowy poziom w szczycie kariery. `skill` (= CA / 5, skala KSM) zostaje dla silnika meczu.
- **Atrybuty (1–20):**
  - Technika jazdy (11), Mentalne (10), Fizyczne (5), Warsztat (2);
  - poza średnią: Przywództwo, Odporność, Regeneracja;
  - ukryte: Powtarzalność, Profesjonalizm, Ambicja. Gracz widzi je tylko jako opis charakteru (np. „Wzorowy profesjonalista”, „Szalony talent”).
- **Nowa gra i stare zapisy:**
  - CA, PA i atrybuty pochodzą z kalibracji;
  - zawodnicy spoza bazy oraz dzieci z protokołów miniżużla są dopisywani do bazy (adepci tylko potwierdzeni, bez generowanych);
  - zawodnicy bez kalibracji dostają szacunek z dotychczasowej oceny i wieku.
- **Rozwój (co tydzień):** CA dąży do PA × krzywa wieku (szczyt 28–31 lat) przesunięta o indywidualne dojrzewanie. Tempo zależy od liczby startów, sprzętu, Profesjonalizmu i Ambicji (u adeptów: wsparcie rodziców, starty), a rozkład na atrybuty i wpływ sztabu – od treningu (niżej).

  Po 30. roku życia starzenie przyspiesza lub zwalnia zależnie od Odporności, Regeneracji i Profesjonalizmu. Słaba szkółka hamuje rozwój do 17. roku życia, a dobre środowisko pozwala nadrobić zaległości.
- **Zmiany PA (przeskoki klas):**
  - egzamin licencyjny (przejście na 500 cm³);
  - coroczny dryf talentu w wieku 14–23 lat (Ambicja, Profesjonalizm);
  - przełomowy sezon.

  Łączna zmiana w karierze to ±15. Ciężka kontuzja (od 30 dni) nie zmienia PA: rozwój stoi na czas leczenia, a potem przez kilka miesięcy jest wolniejszy, tym dłużej, im słabsza Odporność.
- **Tempo rozwoju:** CA podąża za przyrostem krzywej i domyka zaległość. Utalentowani zawodnicy (PA ≥ 60), którzy nie nadążają za krzywą, nadrabiają szybciej. Każdy atrybut ma indywidualną podatność na wzrost i spadek (stałą dla zawodnika, zgodną z jego stylem jazdy, plus akcent sezonu), więc zawodnicy rozwijają się nierówno.
- **Wiedza o zawodniku:** zależy od klubu i ligi zawodnika, startów w Grand Prix, liczby biegów w Polsce, wieku, obserwacji (lista obserwowanych, mecze z naszą drużyną) i oceny talentu u skautów. Od niej zależą:
  - gwiazdki CA i PA: żółte to pewna wiedza, białe to możliwy zakres;
  - atrybuty: wartość, przedział albo „?”.

  Stały błąd sztabu sprawia, że przedział nie musi zawierać prawdy, a słaby skaut przeszacowuje młodych. Kluby AI wybierają zawodników na podstawie własnej oceny.

## Trening

Model jest w `js/training.js`, ekrany w `js/ui-training.js` (Sztab → Trening, zakładka Rozwój zawodnika, strona adepta).

- **Budżet i okna:** tygodniowy przyrost CA z krzywej to budżet rozwoju. Dzielimy go na grupy atrybutów według fazy kariery, a każda grupa realizuje się w swoim oknie roku:

  | Faza | Okres | Technika | Fizyczne | Mentalne | Warsztat |
  |---|---|---|---|---|---|
  | Roztrenowanie | 15.10–30.11 | ×0,3 | ×0,3 | ×0,5 | ×1,0 |
  | Zima – motoryka | 1.12–28.02 | ×0,1 | ×2,8 | ×0,8 | ×0,8 |
  | Przedsezon – tor | 1.03–10.04 | ×2,5 | ×0,9 | ×0,6 | ×1,2 |
  | Sezon | 11.04–14.10 | ×1,3 × starty | ×0,3 | ×1,3 | ×1,0 |

  Mnożniki są znormalizowane, więc średnia w roku wynosi 1. W sezonie i przedsezonie technika zależy też od liczby biegów (u adeptów – zawodów) w ostatnim tygodniu.
- **CA wynika z atrybutów** (5 × średnia ważona). PA pozostaje sufitem. Dobra jakość treningu (do ~1,4) pozwala wyprzedzić krzywą (przełomowy rok), słaba (od ~0,5) zostawia zaległość, którą z wiekiem coraz trudniej odrobić.
- **Jakość treningu** w grupie: najlepsza osoba w obszarze + mniejszy wkład kolejnych, ograniczona poziomem obiektów i pojemnością (zarządzanie ludźmi, liczba podopiecznych).
  - Technika: trener / trener juniorów / trener miniżużla.
  - Fizyczne: trener przygotowania motorycznego + centrum motoryczne.
  - Mentalne: psycholog sportowy i motywacja.
  - Warsztat: kierownik parku maszyn + warsztat.
- **Wpływ klubu:**
  - juniorzy: 90%;
  - seniorzy: mniej za każdą ligę zagraniczną (z bazy startów), Grand Prix i zamieszkanie za granicą (min. 30%).
  - Resztę daje prywatny sztab zawodnika (rośnie z poziomem i profesjonalizmem). Trener bez autorytetu słabiej działa na gwiazdy.
- **Profile trenerów:** startowiec, ścieżki i mijanie, ślizg i nawierzchnie, motoryk, mentalny motywator, drużynowy, warsztatowiec, wychowawca. Profil decyduje, które atrybuty rosną szybciej; najszybciej te, do których zawodnik ma naturalne predyspozycje (styl jazdy).
  - Główny profil jest znany od razu.
  - Poboczny i cechy ukryte (autorytet, nowoczesność metod, determinacja) poznajemy po ~4 miesiącach współpracy albo z oceny dyrektora/skauta, która może się mylić.
- **Naturalny rozwój młodych:** do 14 lat część przyrostu przychodzi sama, niezależnie od okna i trenera (fizyczne 60%, mentalne 50%, warsztat 30%, technika 15%). Do 20 lat ten udział maleje; w mentalnych zostaje 20%. Wsparcie rodziców wzmacnia mentalne i warsztat.
- **Starzenie:** motoryka (jakość treningu fizycznego) spowalnia spadek atrybutów fizycznych weteranów.
- **Cechy ukryte:** Profesjonalizm, Powtarzalność i Ambicja zmieniają się co sezon o ułamki punktu, najbardziej do 23 lat. Zależą od dyscypliny w sztabie, psychologa, mentora (lider w drużynie) i przełomowego sezonu.
- **Historia atrybutów:** pomiar na początku każdego miesiąca (kolekcja `attrhist`, 6 lat).
  - Przy atrybutach własnych zawodników strzałki pokazują zmianę z ostatnich 3 miesięcy.
  - W zakładce Rozwój jest wykres z wyborem cech (do 8 serii), z przyciskami „największe zmiany” i grupami atrybutów.
- **Pomiar kalibracji:** `node tools/test-dev.js [katalog_js]` symuluje sezon i podaje zmiany CA i grup atrybutów według wieku i fazy roku. Z katalogiem starej wersji `js/` pozwala porównać modele.

## Terminarz, podróże i rytm zawodów

Model jest w `js/schedule.js` i `js/foreign.js`, ekrany w `js/ui-schedule.js` (profil zawodnika → Terminarz, Drużyna → Dostępność) i `js/ui-foreign.js`.

- **Ligi zagraniczne** (`js/foreign.js`, dane `js/foreign-data.js`, opis i źródła w `data/foreign/README.md`):
  - 15 lig w 7 krajach z prawdziwymi klubami, składami i terminarzami 2026: Premiership, Championship, NDL; Bauhaus-ligan, Allsvenskan, Division 1; SpeedwayLigaen, 1. i 2. division; Ligue Nationale (Francja); Extraliga i 1. liga (Czechy); 1. i 2. Bundesliga; Drużynowe Mistrzostwa Rosji;
  - każdy mecz jest rozgrywany bieg po biegu według regulaminowej tabeli biegowej ligi (15 tabel: SCB, Svemo, DMU, FFM, DMSB, МФР, AČR). Wyniki dają tabele, play-off (Szwecja: ćwierćfinały 1–6; Dania: czwórmecze półfinału i finału; Wielka Brytania i Allsvenskan: dwumecze) i mistrzów;
  - terminy z terminarzy 2026, w kolejnych sezonach przesunięte o 52 tygodnie. Ligi mają stałe dni: Premiership pn/cz, Bauhaus-ligan wt, SpeedwayLigaen śr, Allsvenskan cz, duńskie dywizje so. Play-off rusza w terminie z kalendarza, a zaległe mecze zasadnicze po jego starcie nie są rozgrywane;
  - skład meczowy to najlepsi dostępni zawodnicy składu. Nie jedzie zawodnik, którego klub gra tego dnia w Polsce albo który startuje w zawodach. Braki uzupełniają goście z kraju ligi, nie lepsi od typowego zawodnika składu;
  - limit lig według art. 216 Regulaminu Przynależności Klubowej: zawodnik PGE Ekstraligi i 2. Ekstraligi – 3 ligi łącznie z polską, od 2027 – 2; KLŻ – 4. Zostają ligi o najwyższym prestiżu, a ligi rozwojowe (NDL, 2. division, 1. liga czeska, 2. Bundesliga) nie wliczają się do limitu;
  - mecz męczy, zużywa silniki, liczy się do rytmu startów i licencji (5 biegów w roku) i niesie ryzyko urazu; kontuzja z ligi zagranicznej nie jest objęta ubezpieczeniem klubu. O startach naszych zawodników za granicą informuje dzienny komunikat;
  - nowy sezon: zawodnicy po zakończeniu kariery odchodzą, a składy uzupełniają wolni zawodnicy kraju ligi. Zawodnicy spoza bazy globalnej (ok. 210) są tworzeni przy nowej grze z poziomem szacowanym ze średniej albo z miejsca w składzie;
  - ekrany: Zawody → Ligi zagraniczne (tabela, terminarz, składy, regulamin z programem biegów), protokół meczu z biegami, strona klubu. W kalendarzu są terminy lig (zbiorczo, mecze naszych zawodników osobno).
  - profil zawodnika: starty za granicą są w „Ostatnich meczach” (forma, średnia z 5 ostatnich) i na liście startów. W Statystykach jest przełącznik lig: Wszystkie, Polska albo jedna z lig zagranicznych zawodnika (sezony w tej lidze: klub, średnia, wygrane biegi, upadki, defekty, najlepszy mecz; klub z miejscem w tabeli; starty tylko z tej ligi). Średnie lig zagranicznych są pokazywane osobno – nie sumują się z ligą polską.
- **Mistrzostwa krajowe za granicą** (`js/foreign.js`): 23 imprezy w 13 krajach, z terminami 2026, w zakładce Zawody (grupa „Mistrzostwa krajowe”) i w kalendarzu:
  - indywidualne: Wielka Brytania, Szwecja, Dania, Czechy, Niemcy, Francja, Finlandia, Norwegia, Łotwa, Słowenia, Włochy, Ukraina, Rosja, USA, Australia;
  - juniorskie: Wielka Brytania U21, Szwecja, Dania U21, Czechy, Niemcy U21, Słowenia, Rosja U19 i U21;
  - USA (`data/usa/README.md`): AMA National (Industry 8.08, Auburn 19.09), U.S. National (Costa Mesa 10.10), Jack Milne Cup, US Open i mistrzostwa stanu Nowy Jork (Owego), mistrzostwa toru i Best Pairs Fast Fridays, młodzież 150/250 cm³ (AMA Youth National, Silver Cup). W sezonie europejskim (marzec–październik) nie przylatują zawodnicy z kontraktami w Europie. Strona zawodów ma zakładkę Regulamin (format kategorii, licencje i klasy AMA, programy zawodów, medaliści 2023–2025; bez sidecarów i długiego toru). Do gry trafia ok. 50 Amerykanów – uczestnicy mistrzostw, którzy rokują; w karcie zawodnika rok licencji z dopiskiem „licencja federacji USA – American Motorcyclist Association (AMA)”, krewni w rodzinie;
  - jadą zawodnicy z krajem macierzystym (juniorzy w limicie wieku). W mistrzostwach otwartych dochodzą goście jeżdżący w ligach tego kraju albo z krajów sąsiednich (bez własnej ligi), nie lepsi od najlepszego zawodnika gospodarzy. Eliminacje (półfinał, kwalifikacje) dają 8 miejsc w finale; cykle mają stałą listę startową. Polskie zawieszenia FIM (`plBanned`) nie dotyczą zawodów za granicą.
- **Podróże:**
  - czas liczony z odległości (prom do Wielkiej Brytanii i Szwecji, samolot na dalekich trasach);
  - zmęczenie zależy od poziomu komfortu: sam prowadzi busa → bus z kierowcą → samolot, sprzęt busem → samolot i komplety sprzętu w kilku krajach (gwiazdy);
  - w dniu podróży regeneracja jest o połowę wolniejsza. Codzienna regeneracja zależy od atrybutu Regeneracja i fizjoterapeuty.
  - Baza zawodnika: w sezonie miasto klubu, poza sezonem dom (zawodnicy zagraniczni wyjeżdżają z Polski).
- **Rytm zawodów:** optimum 2–3 starty w tygodniu, liczone z ostatnich 14 dni; im lepsza Regeneracja i Wytrzymałość, tym wyższe optimum. Za mało startów daje „rdzę” (słabszy bieg), za dużo – spadek formy, a przez zmęczenie także większe ryzyko urazu. Przed sezonem kluby jeżdżą sparingi w soboty (14.03–10.04), jeśli pozwala pogoda.
- **Dostępność:** dzień jest dostępny do treningu w klubie, jeśli zawodnik nie startuje, nie podróżuje, nie jest za granicą ani kontuzjowany. Udział dni dostępnych wyznacza wpływ klubu na trening (`js/training.js`), więc gwiazdy kilku lig trenują głównie z prywatnym sztabem.
- **Pogoda:** rozkład sezonowy dla Polski (temperatura i dni z opadami według miesięcy), z układami trwającymi kilka dni. Deszcz w czasie zawodów oznacza mokry tor. Dni z torem zdatnym do jazdy (od ~4°C, bez opadów) decydują o tym, ile techniki zawodnicy zyskują przed sezonem: zimny marzec to mniej jazdy.

## Planer treningu i zima za granicą

Model jest w `js/planner.js`, a ekran w `js/ui-schedule.js` (Sztab → Trening → Kalendarz).

- **Kto prowadzi trening:**
  - „sztab (automatycznie)” to tryb domyślny, taki sam jak w klubach AI. Okna faz roku, treningi na torze i treningi punktowane w soboty przed sezonem liczą się automatycznie;
  - „własny plan”: gracz układa jednostki w kalendarzu dostępności. Automatyczne treningi na torze i soboty punktowane dla jego klubu wtedy znikają.
- **Jednostki:** tor, trening punktowany, motoryka, odnowa, wideo i taktyka, psycholog, testy motoryczne. Dziennie można zaplanować maksymalnie 2 jednostki.
  - Tor i trening punktowany są dostępne od 25 lutego do października i wymagają pogody (od ~4°C, sucho). Przy złej pogodzie jednostka przepada. Prognoza dnia jest widoczna w szczegółach dnia.
  - Uczestnicy to zawodnicy dostępni tego dnia (bez startu, podróży, pobytu za granicą i kontuzji). Grupę można zawęzić do seniorów albo juniorów U21 i wykluczać pojedyncze osoby.
  - Prowadzący jest domyślnie najlepszym w klubie w danej grupie atrybutów. Słabszy prowadzący obniża dawkę (60–100%).
- **Wpływ na rozwój:**
  - dawka z ostatnich 7 dni w każdej grupie atrybutów (technika, fizyczne, mentalne, warsztat) jest porównywana z normą fazy roku i daje 55–130% tempa okna;
  - plan klubu działa w takiej części, w jakiej zawodnik był w tym tygodniu w klubie. Zimą obcokrajowcy w domu trenują sami, tak jak w trybie sztabu.
- **Kondycja i obciążenie:**
  - jednostki zmieniają kondycję: motoryka i tor męczą, a odnowa regeneruje (lepiej z dobrym fizjoterapeutą);
  - trening punktowany buduje rytm zawodów, tor zużywa i dociera silniki, a psycholog lekko poprawia morale;
  - powyżej 9 jednostek tygodniowo (biegi w zawodach liczą się po ~5 na jednostkę) następuje przeciążenie: dodatkowe zmęczenie i ryzyko urazu.
- **Asystent układa miesiąc:** układa plan według szablonu fazy roku. Zimą jest to motoryka 3 razy, wideo, psycholog i odnowa; przed sezonem tor, motoryka i sobotni trening punktowany; w sezonie plan zależy od meczów (odnowa dzień po meczu, wideo dzień przed, tor dwa dni przed).
  - Pomija dni obozów i sparingów oraz dni, w których dostępnych jest mniej niż 35% kadry.
  - Słabszy asystent popełnia więcej błędów: pomija jednostki, myli rodzaj i sam prowadzi zajęcia.
- **Zima za granicą (Australia, Nowa Zelandia, Argentyna):**
  - 1 listopada zawodnicy proszą o zgodę na zimowe starty. Są to obcokrajowcy wracający na mistrzostwa kraju (Australijczycy, Nowozelandczycy, Argentyńczycy) oraz zawodnicy z niższej półki, którzy chcą zarobić;
  - zgoda: kilka startów od grudnia do stycznia, więcej techniki zimą i lepsze morale, ale zmęczenie i ryzyko urazu przed sezonem. Polak za oceanem jest w tym czasie niedostępny w klubie;
  - odmowa obniża morale, mocno (−15), gdy zawodnik chce wrócić na mistrzostwa kraju;
  - na decyzję jest czas do 25 listopada, potem decyduje asystent. Kluby AI decydują same.

## Skauting

Logika jest w `js/scouting.js`, ekrany w `js/ui-scouting.js` (Transfery → Skauting: Obserwowani, Zlecenia, Polecani, Raporty; strona raportu `#/raport/<id>`).

- **Kto obserwuje:**
  - skaut prowadzi 2 zlecenia naraz, ale podczas wyjazdu do kraju tylko to jedno;
  - trener (sztab trenerski) albo osoba zarządzająca drużyną prowadzi 1 zlecenie. Zbiera informacje wolniej (ok. 55% tempa skauta), a każde zlecenie obniża skuteczność jego treningu do 75%;
  - tempo zależy od atrybutu Ocena talentu.
- **Rodzaje zleceń:**
  - zawodnik: obserwacja jego startów, a bez startów nagrania; raport po 4 obserwacjach albo po czasie;
  - rozgrywki: liga polska lub zagraniczna, puchar, cykl zawodów; jeden mecz dziennie na żywo, reszta z nagrań; lista polecanych;
  - kraj: wyjazd na 1–8 tygodni, wszystkie zawody w kraju, ogólnie albo według profilu;
  - poszukiwanie: kryteria (rola, minimalne gwiazdki umiejętności i potencjału, wiek, koszt sezonu, narodowość), statystyki i nagrania, bez kosztów wyjazdów.
- **Obserwacja i koszty:** obserwacja odbywa się na prawdziwych zawodach dnia (liga polska, zawody, ligi zagraniczne). Wyjazdy kosztują: dojazd do 1200 km albo lot oraz pobyt za dzień. Koszty idą do kategorii „Skauting” w finansach.
- **Raport:**
  - ocena obserwatora w przedziałach gwiazdek, z własnym, stałym błędem wobec zawodnika (słaby obserwator zawyża ocenę młodych);
  - mocne i słabe strony, charakter (przy dobrej znajomości);
  - przedział punktów w sezonie u nas: umiejętności w ocenie obserwatora względem siły rywali w naszej lidze;
  - koszt sezonu: za podpis + stawka za punkt × środek przedziału.
- **Obserwowani** zostają jako pasywna i bezpłatna obserwacja. Wiedza z obserwacji podnosi ocenę sztabu (`G.scout`, do +0,5).
- **Kluby AI** oceniają zawodników własnym, obarczonym błędem okiem sztabu (`perceive` z ich klubem).
- Gracz sam ocenia, czy zawodnik spełnił oczekiwania. Gra nie ocenia trafności obserwatorów.

## Kalendarz: filtry

Kalendarz miesięczny (`js/ui-comp.js`) filtruje wpisy na trzy sposoby:

- **Pokaż:** wszystkie imprezy, imprezy z udziałem naszych zawodników (także adeptów szkółki) albo z udziałem obserwowanych.
- **Kraj:** imprezy w wybranym kraju; FIM bez stałego kraju jako „międzynarodowe”.
- **Rodzaje:** liga polska, ligi zagraniczne, puchary, mistrzostwa indywidualne, pary i drużyny, turnieje, FIM i FIM Europe, młodzież i miniżużel, sparingi i obozy, terminy.

Opcja „wszystkie mecze lig polskich” dodaje mecze innych klubów. Licznik pokazuje, ile wpisów ukrył filtr.

## Kwalifikacje i nominacje

Paczka `data/qualification` (opis w jej README) zawiera reguły obsady zawodów mistrzowskich na 2026:
- PZM/GKSŻ: IMP, MIMP, kaski, MPPK, MMPPK, DMPJ;
- FIM: SGP, kwalifikacje GP, SGP2–4, DPŚ, SoN2;
- FIM Europe: SEC i jego eliminacje, DME, MEP, IME U19, U24, 250 cm³;
- ścieżki krajowe Danii, Szwecji i Wielkiej Brytanii.

Paczka zawiera też nominacje z wyników, np. Złoty Kask → eliminacje GP i SEC. Kody zawodów są jak w `COMPS`. Test i przebudowa: `node tools/test-qualification.cjs`.

W grze paczkę stosuje `js/qualification.js`. Lista startowa (`buildStartList` w `js/competitions.js`) powstaje w kolejności:
1. **Awanse według regulaminów:** po 4 z każdych eliminacji IMP, 7 z challenge'u, po 5 z rund SEC i GP, 6 z SEC Challenge, po 4 z kwalifikacji SGP2, po 8 z półfinałów IME U19. Gdy liczbę ustala GKSŻ komunikatem – łącznie ok. 10 awansujących.
2. **Rozstawieni:**
   - medaliści IMP z poprzedniego roku;
   - stali uczestnicy GP;
   - mistrz MIMP;
   - czołowa szóstka SEC z poprzedniego roku;
   - uczestnicy eliminacji SGP2 w finale MIMP.
3. **Miejsce klubu organizatora** (finały IMP i MIMP).
4. **Nominacje GKSŻ z wyników kasków:**
   - Złoty Kask → rundy GP i SEC (z wyborami trenera kadry);
   - Srebrny Kask → SGP2;
   - Brązowy Kask → IME U19.

   Nominowani są rozdzielani między rundy tak, by mogli wystartować. Pozostali Polacy nie dostają już miejsc w tych zawodach.
5. **Uzupełnienie** nominacjami federacji i dzikimi kartami (`indField`), z etykietą według regulaminu.

Pozostałe zasady:
- Stali uczestnicy GP nie jadą w eliminacjach SEC.
- Zawodnik jest zgłaszany tylko do jednej rundy kwalifikacyjnej.
- Lista startowa jest ogłaszana dzień po ostatnich zawodach źródłowych.
- **Stawka GP na kolejny sezon:** 15 stałych uczestników: 7 najlepszych, 4 z GP Challenge, mistrz Europy, a resztę nominuje komisja SGP.
- **Na każdą rundę GP** (`sgpRoundExtras`, ogłoszenie ok. 30 dni wcześniej) dzika karta (nr 16) i 2 rezerwy toru (nr 17–18). Nominuje je federacja kraju gospodarza:
  - dzika karta to najlepszy zawodnik tego kraju spoza stałych uczestników, z pierwszeństwem dla zawodnika miejscowego klubu. W rundach w Polsce może to być także obcokrajowiec miejscowego klubu (Kvěch – Sparta, Wrocław 2025; Huckenbeck – Stal, Gorzów 2025);
  - rezerwy toru to zawodnicy kraju gospodarza w dowolnym wieku: najpierw z miejscowego klubu (Łódź 2026 – seniorzy Orła Nowak i Szlauderbach; Wrocław – Kowolik i Mikołajczyk ze Sparty), potem najlepsi zawodnicy kraju (Landshut – Wölbert, Grobauer; Ryga – Mihailovs, Kostigovs).

  Zasady wynikają z obsad rund SGP 2025–2026 (Wikipedia).

  Nieobecnych stałych uczestników zastępuje lista zastępców komisji SGP, a potem rezerwy toru.
- Zasady działają tak samo w każdym sezonie: kalendarz kolejnych lat to te same zawody przesunięte o rok.
- **Finał MPPK:** gospodarz, miejsca 1–4 PGE i zwycięzca 2. Ekstraligi z poprzedniego sezonu, najlepsza pozostała para poprzedniego finału. Para to zawodnicy z najwyższą średnią z poprzedniego sezonu, najwyżej 1 obcokrajowiec. W pierwszym sezonie gry, bez tabel 2025, finał tworzą najmocniejsze pary.
- **Bez zmian zostały:** DMPJ, mistrzostwa drużynowe i parowe FIM/FIME oraz zawody bez reguł w paczce.

- `node tools/calibrate-heats.js [poziomy] [powtórzenia]` sprawdza losowość biegu (`HEAT_NOISE` w `js/engine.js`). Porównuje średnie zawodników PGE w symulowanym sezonie zasadniczym z ich średnimi z Ekstraligi 2025 oraz punkty zwycięzcy rundy GP z rundami SGP 2025 (mediana 13 pkt w 20 biegach).

## Testy

- `node tools/test-sim.js [sezony]`: symulacja sezonów bez przeglądarki, z kontrolą spójności.
- `node tools/test-foreign-extra.cjs`: zawody za granicą: puchary brytyjskie, turnieje, pary (kluby, reprezentacje, pary dobrane), młodzież z adeptami spoza bazy, zima w Argentynie, okno transferowe lig zagranicznych.
- `node tools/test-track.js`: model toru (neutralność, komisarz toru, próba toru, przerwy techniczne, wpływ na mijanki i pola startowe); `node tools/test-track-browser.cjs`: ekrany toru w Chrome i zapis w SQLite.
- `node tools/test-scouting.cjs`: skauting (zlecenia, obserwacje, koszty, raporty, kara treningowa trenera).
- `node tools/test-staff-contracts.cjs`: umowy sztabu (negocjacje, kontroferty, zatrudnienie w kilku rolach, wygasanie, kluby AI).
- `node tools/test-planner.js`: planer treningu (plan asystenta, przebieg jednostek, tempo rozwoju, pogoda, zima za granicą).
- `node tools/test-browser.js`: przechodzi całą grę w Chrome w trybie headless (wszystkie ekrany, mecz bieg po biegu, zapis i wczytanie z SQLite). Zrzuty ekranu zapisuje w `tools/screenshots/`.
- `node tools/build-foreign.cjs`: buduje dane lig zagranicznych i mistrzostw krajowych z kopii źródeł (`data/foreign/sources`), z kontrolą tabel biegowych i dni meczowych.
- `node tools/test-foreign.cjs [data]`: sezon lig zagranicznych bez przeglądarki (mecze, tabele, play-off, mistrzowie, kolizje terminów, mistrzostwa krajowe).
- `node tools/test-foreign-browser.cjs`: ekrany lig zagranicznych i mistrzostw w Chrome, kalendarz, zapis i wczytanie nowych tabel `fclubs` i `ffix`.
- `node tools/test-usa.cjs [data]`: żużel w USA – zawodnicy i adepci z kalibracją, daty urodzenia, brak duplikatów, zawody w USA rozegrane z amerykańską obsadą. `node tools/test-usa-browser.cjs`: licencja AMA, data i miejsce urodzenia, krewni, adept, regulamin mistrzostw (zrzuty `tools/screenshots/usa-*.png`).

## Struktura

`js/world.js` (tworzenie świata), `js/nationality.js` (obywatelstwa, zawieszenia FIM), `js/manager.js` (postać menedżera, rola trenera, dzieci), `js/ui-start.js` (ekran startowy, kreator nowej gry, profil menedżera), `js/engine.js` (silnik biegów, meczu i Grand Prix), `js/game.js` (czas, finanse, rozwój, play-off), `js/training.js` (trening, okna, sztab, historia atrybutów), `js/schedule.js` (podróże, rytm, dostępność, pogoda, limit lig zagranicznych), `js/track.js` (tor: stan nawierzchni, przygotowanie, próba toru, prace torowe), `js/foreign.js` (ligi zagraniczne i mistrzostwa krajowe), `js/ui-foreign.js` (ich ekrany), `js/market.js` (rynek: okienka, kontrakty, negocjacje, wypożyczenia, kluby AI), `js/db.js` (zapis), `js/ui-*.js` (ekrany).

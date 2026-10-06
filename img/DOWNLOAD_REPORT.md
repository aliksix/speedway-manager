# Pobrane grafiki — 30.09.2026

- Nowe zdjęcia: **293**. Razem z 20 zastanymi: **313** plików.
- Nowe pliki z logotypami: **25**. Łącznie: **30**.
- Herby: komplet 23 klubów bazy + zastany Śląsk Świętochłowice.
- Rozgrywki: PGE Ekstraliga, Metalkas 2. Ekstraliga, Krajowa Liga Żużlowa i U24 Ekstraliga (oryginalny wektorowy PDF). PGE i M2E mają również białe warianty.
- Dopasowano zdjęcia do **249/583** rekordów bazy. Dla **334** rekordów nie ma dopasowanego zdjęcia; lista: [missing-riders.json](missing-riders.json). Baza obejmuje też zawodników spoza Ekstraligi.

## Pliki

- [Podgląd wszystkich grafik](gallery.html) — działa po otwarciu lokalnego pliku.
- [Źródła, daty pobrania i sumy SHA-256](sources.json). Pole errors zawiera historię nieudanych prób, w tym prób później zakończonych pobraniem miniatury.
- [Mapowanie ID zawodników i klubów na pliki](assets-map.json).

Zdjęcia pochodzą z publicznych profili, składów i list klasyfikacyjnych [Ekstraligi](https://ekstraliga.pl/) dla sezonów 2021–2026. Pobierano dostępne obecnie portrety; nie są gwarantowanym zdjęciem z sezonu bazy 2025. Herby pobrano z serwera [GKSŻ](https://gksz.pl/) wykorzystywanego przez [Polski Żużel](https://polskizuzel.pl/2ligazuzlowa/). Logo U24 udostępnia [Unia Leszno](https://unia.leszno.pl/dwie-zuzlowe-ligi-zawodowe-nowa-identyfikacja-wizualna/).

Zachowano 25 zastanych grafik. Odrzucono rozpoznane sylwetki zastępcze. Część profili udostępnia wyłącznie prawdziwą miniaturę 128×128 — jest zachowana w JPG. Pozostałe nowe portrety są głównie w PNG. Nazwy plików są oparte na nazwiskach ze źródła; mapowanie uwzględnia m.in. Sayfutdinov/Sajfutdinow, Ben/Benjamin Cook i Blödorn/Bloedorn.

To uzupełnienie zasobów. Kod gry nie został zmieniony; obecny avatar w js/util.js odwołuje się do img/riders/<id>.jpg, więc wykorzystanie zdjęć w interfejsie wymaga użycia mapowania.

## Uzupełnienie portretów — 2.10.2026

- Nowe portrety: **128** (z 333 zawodników z listy brakujących); pozostało **205** — [missing-riders.json](missing-riders.json).
- Źródła: [British Speedway](https://britishspeedway.co.uk/) (profile ligowe), [FIM Speedway](https://www.fimspeedway.com/) (portrety wycięte z tła), [Wikimedia Commons](https://commons.wikimedia.org/) (zdjęcia z biogramów Wikipedii). Każdy plik ma w [sources.json](sources.json) adres źródła, stronę profilu i sumę SHA-256.
- Format jak portrety Ekstraligi: PNG 850×550 z przezroczystym tłem. Tło usunięte modelem rembg (u2net_human_seg), skala i położenie głowy dopasowane do średniej z portretów Ekstraligi.
- Odrzucone po przeglądzie: zdjęcia w kasku / z zasłoniętą twarzą, z osobami w tle (lista REJECT w tools/make-rider-photos.py).
- Odtworzenie: `node tools/find-rider-photos.cjs`, `python tools/make-rider-photos.py`, `python tools/import_xlsx.py` (mapa zdjęć w js/data.js).
- Niedostępne źródła: szwedzki serwis Elit Speedway Sverige (sip.eventassistans.se) nie odpowiadał; dla zawodników ze Szwecji, Danii, Finlandii, Argentyny i polskich juniorów bez startów w Ekstralidze nie znaleziono ujednoliconych portretów.

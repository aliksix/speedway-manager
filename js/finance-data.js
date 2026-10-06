'use strict';
// Dane finansowe: parametry lig (wypłaty centralne, nagrody, opłaty), cennik miejsc reklamowych, finanse klubów (miasto, właściciel,
// nazwa bazowa, sponsor tytularny) i baza firm-sponsorów. Źródła i założenia: data/finance/README.md.
// Kwoty oznaczone w README jako „szac.” są szacunkami do gry, pozostałe pochodzą z publikacji prasowych z lat 2023–2026.

// ---------- Ligi ----------
// tv: udział klubu w prawach TV (Canal+), title: udział w umowie sponsora tytularnego rozgrywek (PGE / Metalkas), reserve: potrącenie z wypłaty TV
// na fundusz rezerwowy ligi (zwrot po 3 latach) – opisy i źródła: LEAGUE_PAY,
// attract: Fundusz Atrakcyjności (za mijanki w meczach domowych), proJunior: Ekstraliga Pro Junior System (za punkty wychowanków-juniorów),
// prizes: nagrody za medale DMP, licence: opłaty licencyjne i ligowe klubu, riderLic: licencja i ubezpieczenie zawodnika,
// matchCost: organizacja meczu domowego (sędzia, komisarz toru, 2 karetki, ochrona imprezy masowej, obsługa, energia);
// Stal Gorzów: organizacja imprez 4,3 mln zł/rok, ochrona 20 tys. zł/mecz, ubezpieczenie i karetki ok. 3 tys. zł/mecz; Gniezno (KLŻ): 270 tys. zł/sezon,
// admin / tech: administracja oraz tor i park maszyn (udział w budżecie, z minimum), u24: drużyna w Ekstralidze U24 (koszt w całości po stronie klubu),
// events: wynajem stadionu i imprezy pozasportowe (zawody żużlowe na stadionie klubu liczy js/stadium.js), gastro / merch: zł na widza, seasonShare: część widzów z karnetem,
// boxes / boxPrice: loże i skyboxy, adMult: mnożnik cennika reklam względem PGE Ekstraligi.
const FIN_LEAGUE = {
  PGE: { tv: 8.0e6, title: 0.84e6, reserve: 1.5e6, attract: 4.5e6, proJunior: 8e6, prizes: [500000, 300000, 200000], licence: 150000, riderLic: 4000, matchCost: 300000,
    admin: [0.05, 1.2e6], tech: [0.03, 0.7e6], u24: 450000, events: 300000, gastro: 6, merch: 3, seasonShare: 0.4, boxes: 8, boxPrice: 100000, adMult: 1 },
  '2E': { tv: 1.25e6, title: 0.075e6, reserve: 0, attract: 0, proJunior: 0, prizes: [150000, 80000, 40000], licence: 60000, riderLic: 3000, matchCost: 90000,
    admin: [0.12, 0.6e6], tech: [0.05, 0.3e6], u24: 0, events: 180000, gastro: 6, merch: 2, seasonShare: 0.3, boxes: 3, boxPrice: 40000, adMult: 0.35 },
  KLZ: { tv: 0, title: 0, reserve: 0, attract: 0, proJunior: 0, prizes: [50000, 30000, 15000], licence: 25000, riderLic: 2500, matchCost: 38000,
    admin: [0.16, 0.3e6], tech: [0.06, 0.15e6], u24: 0, events: 120000, gastro: 6, merch: 1.5, seasonShare: 0.25, boxes: 1, boxPrice: 15000, adMult: 0.13 },
};
// Miesiące wypłat: wypłaty ligi w 4 ratach, dotacja miejska w ratach od marca do września, właściciel kwartalnie
const FIN_MONTHS = { central: [3, 5, 7, 9], title: [4, 9], city: [3, 4, 5, 6, 7, 8, 9], cityPromo: [4, 7], youth: [3, 6, 9], equity: [2, 6], owner: [1, 4, 7, 10], karnety: { 12: 0.3, 1: 0.25, 2: 0.25, 3: 0.2 }, boxes: { 2: 0.5, 4: 0.5 },
  events: [5, 6, 7, 8, 9], licence: 12, riderLic: 2, u24: [4, 5, 6, 7, 8, 9], tech: { 3: 0.16, 4: 0.12, 5: 0.1, 6: 0.1, 7: 0.1, 8: 0.1, 9: 0.1, 10: 0.08, 11: 0.04, 12: 0.03, 1: 0.03, 2: 0.04 } };

// Wypłaty centralne – co klub dostaje i za co (ekran Finanse → Liga i miasto)
// PGE Ekstraliga: Canal+ 2026–2028 – 214,5 mln zł za 3 lata (71,5 mln zł/rok); po kosztach produkcji i ligi „nawet 8 mln zł” na klub;
// fundusz rezerwowy: 1,5 mln zł/rok z wypłaty każdego klubu zamrożone na 3 lata (4,5 mln zł); PGE – sponsor tytularny: 6,3 mln zł (2024) → 7 mln zł (2027)
// do podziału, ok. 0,8–0,9 mln zł na klub; Fundusz Atrakcyjności 4,5 mln zł/rok za mijanki; Ekstraliga Pro Junior System 8 mln zł; medale 500/300/200 tys. zł.
// Metalkas 2. Ekstraliga: Canal+ 2025–2027 – 10 mln zł/rok (wcześniej 1,5 mln zł łącznie), ponad 1 mln zł na klub; Metalkas 2027–2029: ponad 2 mln zł łącznie (ok. 70–85 tys. zł/klub/rok).
// Krajowa Liga Żużlowa: od 2025 bez umowy telewizyjnej (kluby transmitują mecze same w internecie) i bez sponsora rozgrywek płacącego klubom.
const LEAGUE_PAY = {
  PGE: { tv: 'Prawa TV i internet – Canal+ (2026–2028: 214,5 mln zł / 3 lata dla ligi)', title: 'Sponsor tytularny rozgrywek – PGE (6,3–7 mln zł/rok dla ligi)', reserve: 'Potrącenie na fundusz rezerwowy Ekstraligi (zwrot po 3 sezonach)' },
  '2E': { tv: 'Prawa TV – Canal+ (2025–2027: 10 mln zł/rok dla ligi)', title: 'Sponsor tytularny rozgrywek – Metalkas (ponad 2 mln zł / 3 lata dla ligi)' },
  KLZ: { tv: 'Brak umowy TV od 2025 – kluby transmitują mecze same', title: '' },
};

// Harmonogramy płatności sponsorów (miesiąc wpłaty, 15. dzień) i to, jak bardzo dana forma pasuje firmie (mnożnik gotowości do zapłaty)
const PAY_PLANS = {
  once: { name: 'jednorazowo (marzec)', months: [3], fit: 0.93 },
  pre: { name: 'jednorazowo przed sezonem (luty)', months: [2], fit: 0.9 },
  two: { name: '2 transze (marzec, lipiec)', months: [3, 7], fit: 0.98 },
  four: { name: '4 transze (luty, kwiecień, czerwiec, sierpień)', months: [2, 4, 6, 8], fit: 1 },
  monthly: { name: 'miesięcznie (marzec–październik)', months: [3, 4, 5, 6, 7, 8, 9, 10], fit: 1.03 },
};

// ---------- Miejsca reklamowe ----------
// Cennik PGE Ekstraligi (Interia, cennik klubu: klatka min. 500 tys., pagony 200/120 tys., brzuch i udo 120 tys., podudzie 80 tys., ramię 60 tys.,
// kolano 50 tys.; kierownica 200 i 70 tys., tłumik 100 tys., obszycie 60 tys.). Pozostałe pozycje szacunkowe. cap = liczba miejsc.
const AD_SLOTS = [
  { id: 'name', group: 'druzyna', name: 'Nazwa drużyny (sponsor tytularny)', price: 1200000, cap: 1, title: true },
  { id: 'chest', group: 'kevlar', name: 'Kevlar – klatka piersiowa', price: 500000, cap: 1 },
  { id: 'back', group: 'kevlar', name: 'Kevlar – plecy', price: 220000, cap: 1 },
  { id: 'shoulderR', group: 'kevlar', name: 'Kevlar – pagon prawy', price: 200000, cap: 1 },
  { id: 'shoulderL', group: 'kevlar', name: 'Kevlar – pagon lewy', price: 120000, cap: 1 },
  { id: 'belly', group: 'kevlar', name: 'Kevlar – brzuch', price: 120000, cap: 1 },
  { id: 'thigh', group: 'kevlar', name: 'Kevlar – udo', price: 120000, cap: 1 },
  { id: 'shin', group: 'kevlar', name: 'Kevlar – podudzie', price: 80000, cap: 2 },
  { id: 'arm', group: 'kevlar', name: 'Kevlar – ramię', price: 60000, cap: 2 },
  { id: 'knee', group: 'kevlar', name: 'Kevlar – kolano', price: 50000, cap: 2 },
  { id: 'bib', group: 'kevlar', name: 'Plastron (kamizelka z numerem)', price: 150000, cap: 1 },
  { id: 'bar1', group: 'motocykl', name: 'Motocykl – kierownica (główne logo)', price: 200000, cap: 1 },
  { id: 'bar2', group: 'motocykl', name: 'Motocykl – kierownica (drugie logo)', price: 70000, cap: 1 },
  { id: 'silencer', group: 'motocykl', name: 'Motocykl – tłumik', price: 100000, cap: 1 },
  { id: 'seat', group: 'motocykl', name: 'Motocykl – obszycie siedzenia', price: 60000, cap: 1 },
  { id: 'guard', group: 'motocykl', name: 'Motocykl – błotnik i osłony', price: 40000, cap: 2 },
  { id: 'stadium', group: 'stadion', name: 'Nazwa stadionu', price: 800000, cap: 1 },
  { id: 'startline', group: 'stadion', name: 'Baner na prostej startowej', price: 80000, cap: 2 },
  { id: 'banner', group: 'stadion', name: 'Baner na bandzie', price: 30000, cap: 40 },
  { id: 'screen', group: 'stadion', name: 'Telebim i spoty w przerwach', price: 45000, cap: 4 },
  { id: 'heat', group: 'stadion', name: 'Sponsor biegu (sezon)', price: 18000, cap: 15 },
  { id: 'park', group: 'stadion', name: 'Park maszyn / strefa kibica', price: 60000, cap: 2 },
  { id: 'media', group: 'media', name: 'Media klubu (www, social, wywiady)', price: 20000, cap: 20 },
  { id: 'vip', group: 'media', name: 'Pakiet VIP / biznes klub (4 karnety)', price: 15000, cap: 80 },
];
const AD_GROUPS = { druzyna: 'Drużyna', kevlar: 'Kevlar zawodników', motocykl: 'Motocykle zawodników', stadion: 'Stadion', media: 'Media i biznes klub' };

// ---------- Kluby ----------
// base: nazwa bez sponsora tytularnego, brand: sponsor tytularny w nazwie, titleUntil: koniec umowy (sezon),
// city: [wsparcie miasta i samorządów w zł/rok, zamożność miasta 1–5, przychylność władz 0–1, miasto jest właścicielem],
// spTotal: przychody od sponsorów w sezonie 2026 (mln zł; prasa i szacunki: PGE średnio 9–10 mln, od Grudziądza 4–5 mln do Sparty 15–18 mln;
// Polonia i Wilki skalibrowane do przychodów ze sprawozdań 2024/25 – data/finance/kalibracja-2025.md),
// stadium: firma z prawami do nazwy stadionu (miejsce „Nazwa stadionu”), owner: zdolność akcjonariuszy do dopłat (udział budżetu), sp: sponsorzy z oficjalnych stron klubów i prasy (strategiczni | główni | partnerzy);
// gwiazdka = firma, która podpisała umowę dopiero na sezon 2026 – na starcie gry (X 2025) jest zainteresowanym partnerem, a nie sponsorem.
// Kluby bez list (lub z krótkimi) uzupełniają firmy z szablonów LOCAL_FIRM_TEMPLATES – nazwy fikcyjne.
const CLUB_FIN = {
  1: { base: 'Sparta Wrocław', spTotal: 16, brand: 'Betard', titleUntil: 2027, city: [4.22e6, 5, 0.75, false], owner: 0.12,
    sp: ['UniCredit*|Immergas|Beckhoff|Wrocławski Port Lotniczy|Rosiek&Rosiek', 'Develia|Garcarek|AKME|Aquapark Wrocław|Hasco-Lek|Rexer|Magik|Helios Logistics|Milart|MPWiK Wrocław|Tauron',
      'Ampol|Płomyk|Tece|Meble Bodzio|Bissole|SLV Group|Baumatech|Leroy Merlin|Roma Bud|Haston City Hotel|Röben Polska|ARAD|Botland|Chemeko-System|TOI TOI Polska|Warka|Automax|Fit-Oil|YATO|Kam-Trans|Macron'] },
  2: { base: 'KS Toruń', spTotal: 11, brand: 'PRES Grupa Deweloperska', titleUntil: 2026, city: [2.1e6, 4, 0.6, false], owner: 0.25,
    sp: ['Fortuna|For Nature Solutions', '', ''] },
  3: { base: 'Falubaz Zielona Góra', spTotal: 7.5, brand: 'Stelmet', titleUntil: 2026, city: [3.0e6, 3, 0.7, false], owner: 0.25,
    sp: ['Novy Hotel|Arpol|Chery Fiałkowski|EBF Development|Streamsoft|PGE Zielona Góra|SECO/WARWICK', 'Boll|Lumel|Toyota Zielona Góra|Ramirent|Lotto|Dekoral|Mrówka|Novotel',
      'Gezet|Bader Kara|Pentel|Batcar|BHPEX|Biuro Podróży Odkrywca|Car SPA|Farbomix|Felgenhauer|Hallo Taxi BIS|Holger Lund|KSSSE|Marwis|MaxMar|Optimum Maschinen|Pivovar|Polaris Quady|Radio Zachód|Rajbud|Tartak Płoty|Termal|Ziel-Bruk'] },
  4: { base: 'Motor Lublin', spTotal: 9.5, brand: 'Orlen Oil', titleUntil: 2027, city: [4.0e6, 4, 0.75, false], owner: 0.12,
    sp: ['Maspo*|PGE|LW Bogdanka|Lubelskie – Smakuj życie', 'Lotto|Perła Browary Lubelskie|Mennica Polska|LV BET|BMW Best Auto', 'Grupa PBI|KOM-EKO|GC Energy|MPK Lublin|Galeria Olimp|Orto Sport|A4 Polska|Macron'] },
  5: { base: 'ROW Rybnik', spTotal: 4.5, brand: 'Innpro', titleUntil: 2026, city: [2.5e6, 3, 0.6, false], owner: 0.1,
    sp: ['Jastrzębska Spółka Węglowa', '', ''] },
  6: { base: 'Włókniarz Częstochowa', spTotal: 6.5, brand: 'Krono-Plast', titleUntil: 2026, city: [2.608e6, 3, 0.55, false], owner: 0.2,
    sp: ['Tauron|Orlen', 'FAKRO*|Pralnia Foka*|Golden Party*', ''] },
  7: { base: 'Stal Gorzów', spTotal: 5.8, brand: 'Gezet', titleUntil: 2025, stadium: 'GBS Gorzów', city: [2.27e6, 3, 0.35, false], owner: 0.1,
    sp: ['KGHM|Enea', 'ebut.pl|Pepsi|Browar Witnica|ICT Poland|GBS Gorzów', 'Gess|GoFin|iParts.pl|Corleonis|Brandmed*'] },
  8: { base: 'GKM Grudziądz', spTotal: 4.5, brand: 'Bayersystem', titleUntil: 2027, city: [7.2e6, 2, 0.95, true], owner: 0.05,
    sp: ['Visscher-Caravelle|Kujawsko-Pomorskie|Venture|Cleangang', 'Bona|Mercedes Auto Frelik|Agro Projects|Unitrak|Szulc-Bud|Kubiakpol|DPV Logistic|Warka|Case|Arriva',
      'ZOOLeszcz|Zalmet|3W Maszyny|Becker|Vet Puls|Magik|Młyny Szczepanki|Optyk Chojnowski|Edgaz|Skoda BS-Auto|Inpak|Wolf Transport|Ekobud|Rembud|Dachbud|Lotto|mBank|Kappa|Eurol|Ramirent|Epros|Radio PiK|Hotel Rad'] },
  9: { base: 'Unia Leszno', spTotal: 6.0, brand: 'Fogo', titleUntil: 2026, city: [2.0e6, 2, 0.7, false], owner: 0.12,
    sp: ['Enea|Agromix|Bank Spółdzielczy Leszno|Cieśla Auto Group|Duda Holding|Polcopper', 'Qmex Energy (Gulf)*|Almar|LFP|Magik|Budio|TT Chłodnictwo|Flixhome',
      'Adamietz|Agrorami|Fuchs|Gastersol|Gropex|Hibernus|Instal Perfekt|Inter Cars|Mactrans|Maxmetal|Aalberts|MPEC Leszno|MPWiK Leszno|PB Developer|Widmet|Przystanek Neapol'] },
  10: { base: 'Polonia Bydgoszcz', spTotal: 5.6, brand: 'Abramczyk', titleUntil: 2026, city: [2.48e6, 4, 0.6, false], owner: 0.12,
    sp: ['PRES Grupa Deweloperska|Enea', 'Lotto|AGRO Kwiatkowski Makowski|Hagric Woźniecki', 'InstaForex|Wise People|Event Total|Akademia Czarnego Gryfa'] },
  11: { base: 'Wilki Krosno', spTotal: 7.2, brand: 'Cellfast', titleUntil: 2026, city: [1.19e6, 2, 0.7, false], owner: 0.1,
    sp: ['Orlen|Merkury Market|Toyota Jasło', 'Nowy Styl|Marma Polskie Folie|Krosno Glass|Uzdrowisko Rymanów|Krośnieński Holding Komunalny|GC Energy|Warka',
      'Splast|Walbud|Fachbud|Ekodach|Stimo|Zniczplast|Flotex|Europel|WPM Group|Greinplast|Pelmet|Novum Electric|Jaś Wędrowniczek|Restauracja Portius|Pałac Polanka|Bank Spółdzielczy Rymanów|Agrotech/Case|JSF Inwestycje|KPB Development|Strefa ATV'] },
  12: { base: 'Stal Rzeszów', spTotal: 4.0, brand: 'Texom', titleUntil: 2025, city: [3.26e6, 4, 0.75, false], owner: 0.1,
    sp: ['Rzeszów Stolica Innowacji|Podkarpackie', 'Eurobud|Lotto|WodKanGaz|Handlopex', 'Cutline Wear Factory|GC Energy|Stanbest|Bristol|Baltica-Invest|Solvera|Grupa Expert|Stary Browar Rzeszowski|Case|Metkom|Hyundai Rzeszów|Ferrbud|MPWiK Rzeszów|MPGK Rzeszów|MPEC Rzeszów|Beton Servis|Motoluka|MPK Rzeszów|Grand Hotel Rzeszów|Silikony Polskie|NH Invest'] },
  13: { base: 'PSŻ Poznań', spTotal: 2.3, brand: 'Hunters', titleUntil: 2027, city: [1.25e6, 5, 0.4, false], owner: 0.1,
    sp: ['Investon|Investhouse|Agregaty', 'Eko Styl Plus|Ramirent|Lotto', 'Novotel|Nova|Black Water|Comerto|Solid Door'] },
  14: { base: 'KM Ostrów', spTotal: 2.4, brand: 'Moonfin Malesa', titleUntil: 2026, city: [2.32e6, 2, 0.8, false], owner: 0.1,
    sp: ['Enea|Bank Pocztowy', 'Magnus|Lotto', ''] },
  15: { base: 'Unia Tarnów', spTotal: 0.6, brand: 'Autona', titleUntil: 2025, city: [0, 2, 0.1, false], owner: 0.05,
    sp: ['Małopolska', 'Wesbud|Nowrem Group', 'ReDrog'] },
  16: { base: 'Orzeł Łódź', spTotal: 2.0, brand: 'H.Skrzydlewska', titleUntil: 2027, city: [1.85e6, 4, 0.5, false], owner: 0.2,
    sp: ['Cegielnia Grabarz|Beckhoff*|Varitex|Max-Pol', 'Enea|Lotto|Monitoring Krajowy|Promatbud', 'Dizj Tartak|Marvel Grupa|HD Punkt|Nastbud|Makis|ZOO Delfin|Auto Kuba|Jassa'] },
  17: { base: 'Wybrzeże Gdańsk', spTotal: 1.8, brand: null, titleUntil: 0, city: [1.5e6, 5, 0.55, false], owner: 0.15,
    sp: ['Port Lotniczy Gdańsk|GAIT Gdańska Agencja Inwestycji|Mielewczyk', 'Orlen', ''] },
  18: { base: 'Start Gniezno', spTotal: 1.4, brand: 'Ultrapur', titleUntil: 2026, city: [0.542e6, 2, 0.7, false], owner: 0.08,
    sp: ['Centrum Usługowe OMEGA Ochrona*|PEC Gniezno', 'Masarnia Czerniejewo*', ''] },
  19: { base: 'Lokomotiv Daugavpils', spTotal: 0.9, brand: 'Optibet', titleUntil: 2025, city: [0.5e6, 1, 0.6, false], owner: 0.08,
    sp: ['LV BET*|Visam|Eco Baltia Vide|Oil Recovery|Kärcher Latvija', 'Mežpils|Stokker|Latcarrier|Intergaz|MB Betons',
      'Tapetes visiem|PUFAS|Stragov|A.M. Company|Unomax|Yoggi Bear Gastrobārs|Gridas-M|Oleg Express|Gamma|Jumprava|Lucky Punch|AVER Latgale|Chartog|Luna|Ditton|Atramed|Muz Pro|Rubenis foto|Nash Gorod|Grani.lv|Sportacentrs.com'] },
  20: { base: 'Polonia Piła', spTotal: 1.3, brand: 'Pronergy', titleUntil: 2026, city: [1.27e6, 2, 0.6, false], owner: 0.08,
    sp: ['Hydropex', 'BoxPro', 'RDLP Piła'] },
  21: { base: 'Speedway Kraków', spTotal: 0.6, brand: null, titleUntil: 0, city: [0.2e6, 5, 0.2, false], owner: 0.06,
    sp: ['', '', ''] },
  22: { base: 'Kolejarz Opole', spTotal: 0.7, brand: null, titleUntil: 0, city: [0.7e6, 3, 0.3, false], owner: 0.06,
    sp: ['Stal-Met Nieczaj*', '', ''] },
  23: { base: 'Landshut Devils', spTotal: 1.2, brand: 'Trans MF', titleUntil: 2026, city: [0.1e6, 4, 0.2, false], owner: 0.1,
    sp: ['', '', ''] },
  24: { base: 'Śląsk Świętochłowice', spTotal: 0.5, brand: null, titleUntil: 0, city: [0.3e6, 1, 0.5, false], owner: 0.05, sp: ['', '', ''] },
  25: { base: 'Kolejarz Rawicz', spTotal: 0.3, brand: null, titleUntil: 0, city: [0.2e6, 1, 0.5, false], owner: 0.05, sp: ['', '', ''] },
  26: { base: 'WTS Warszawa', spTotal: 0.4, brand: null, titleUntil: 0, city: [0.1e6, 5, 0.1, false], owner: 0.05, sp: ['', '', ''] },
};

// ---------- Wsparcie miast: składniki ----------
// sport: dotacja na rozwój sportu / udział w rozgrywkach (środki ogólne), promo: umowa promocyjna (usługa reklamowa dla miasta / regionu),
// equity: dokapitalizowanie spółki przez miasto-właściciela, youth: dotacja celowa na szkolenie dzieci i młodzieży (tylko szkółka – niewydane środki wracają do miasta),
// own: dotacje celowe na własne turnieje klubu [nazwa, kwota, miesiąc] – tylko na organizację tej imprezy.
// Imprezy z kalendarza (Grand Prix, finał IMP, Złoty Kask…) – CITY_EVENT_GRANT, wypłata tylko gdy impreza odbywa się w mieście klubu.
// Kwoty z uchwał i umów miast 2024–2026 (data/finance/README.md, „Wsparcie miast”); sport + promo + equity + youth = city[0] w CLUB_FIN.
const CITY_PARTS = {
  1: { sport: 4.1e6, youth: 0.12e6 }, // Wrocław 2025: 4,1 mln (seniorzy + U24) + 1,75 mln Grand Prix
  2: { sport: 2.0e6, youth: 0.1e6 }, // Toruń 2026: 2,0 mln seniorzy + konkursy; 2025: 1,65 mln + 2,05 mln promocja imprez (GP)
  3: { sport: 2.2e6, promo: 0.7e6, youth: 0.1e6 }, // Zielona Góra 2026: 3,0 mln
  4: { sport: 3.0e6, promo: 0.85e6, youth: 0.15e6 }, // Lublin 2026: ok. 4 mln (1,9 mln w I półroczu)
  5: { promo: 2.35e6, youth: 0.15e6 }, // Rybnik 2025: 2,5 mln (konkurs na promocję miasta)
  6: { promo: 2.5e6, youth: 0.108e6 }, // Częstochowa 2025: 2,5 promocja + 0,3 finał IMP + 0,1 młodzież + 0,008 miniżużel
  7: { sport: 2.2e6, youth: 0.07e6 }, // Gorzów 2025: 2,2 liga + 0,07 młodzież + 2,5 GP (oraz akcje 2,5 mln i poręczenie kredytu 3,9 mln)
  8: { equity: 7.0e6, youth: 0.2e6 }, // Grudziądz 2024: 7,2 mln – dokapitalizowanie spółki miejskiej
  9: { sport: 2.0e6, own: [['Memoriał Alfreda Smoczyka', 40000, 9]] }, // Leszno 2025: 2,0 mln + memoriał + SEC
  10: { sport: 2.3e6, youth: 0.18e6 }, // Bydgoszcz 2025: 2,48 mln
  11: { sport: 1.1e6, youth: 0.09e6 }, // Krosno 2025: 1,19 mln
  12: { sport: 3.16e6, youth: 0.1e6 }, // Rzeszów 2025: 3,26 mln (organizacja zawodów)
  13: { sport: 1.15e6, youth: 0.1e6 }, // Poznań 2025: 1,25 mln
  14: { sport: 2.2e6, youth: 0.12e6, own: [['Turniej o Łańcuch Herbowy Ostrowa', 200000, 8]] }, // Ostrów 2025: 2,518 mln (liga, IMP, turniej, młodzież)
  15: {}, // Tarnów: brak wsparcia
  16: { sport: 1.75e6, youth: 0.1e6 }, // Łódź 2025: 1,853 mln
  17: { sport: 1.3e6, promo: 0.1e6, youth: 0.1e6 }, // Gdańsk (szac.)
  18: { sport: 0.5e6, youth: 0.042e6, own: [['Turniej o Koronę Bolesława Chrobrego', 50000, 4]] }, // Gniezno 2024: 0,5 liga + 0,042 szkolenie + 0,05 Korona Chrobrego
  19: { sport: 0.5e6 }, // Daugavpils (szac.)
  20: { sport: 0.5e6, promo: 0.75e6, youth: 0.02e6 }, // Piła 2024: 1,27 mln (0,5 rozwój sportu + 0,75 promocja + 0,02 młodzież)
  21: { sport: 0.2e6 }, // Kraków (szac.)
  22: { sport: 0.7e6 }, // Opole 2024: 0,7 mln liga (+ 0,04 mln Złoty Kask – CITY_EVENT_GRANT)
  23: { sport: 0.1e6 }, 24: { sport: 0.25e6, youth: 0.05e6 }, 25: { sport: 0.2e6 }, 26: { sport: 0.1e6 },
};
// Dotacja celowa miasta na organizację imprezy z kalendarza (zł); sgp: kwoty z uchwał miast (Gorzów 2,5 mln, Wrocław 1,75 mln, Toruń 2,05 mln)
const CITY_EVENT_GRANT = {
  sgp: { 1: 1.75e6, 2: 2.05e6, 7: 2.5e6, 16: 1.5e6, def: 1.2e6 },
  IMP: 300000, ZK: 40000, SEC: 60000, SGP2: 150000, SGP3: 80000, SWC: 400000, SON2: 120000, EPC: 80000, ETC: 80000, REP: 100000, MPPK: 50000,
  SK: 30000, BK: 25000, MIMP: 30000, IMME: 50000, GB: 30000, EU24T: 50000, EU19: 40000,
};

// ---------- Baza firm ----------
// [nazwa, branża, skala (k – krajowa, r – regionalna, l – lokalna, m – zagraniczna), budżet sportowy firmy w tys. zł/rok [od, do],
//  kluby z powiązaniem (miasto/region lub historia współpracy), może być sponsorem tytularnym, status, uwaga i źródło]
// status: 'aktualny' (sponsor w latach 2025–2026), 'byly' (dawny sponsor żużla), 'potencjalny' (hipoteza: siedziba w regionie klubu, branża, profil sponsoringu – bez potwierdzonych rozmów).
const COMPANY_DB = [
  // Spółki Skarbu Państwa i wielkie firmy obecne w żużlu
  ['PGE', 'energetyka', 'k', [500, 3000], [4, 3], 1, 'aktualny', 'sponsor tytularny PGE Ekstraligi do 2027; strategiczny Motor Lublin, PGE Zielona Góra (Falubaz)'],
  ['Orlen', 'paliwa', 'k', [500, 3000], [4, 11, 6, 17], 1, 'aktualny', 'Orlen Oil – sponsor tytularny Motoru (ok. 1 mln zł/rok); Wilki Krosno; reprezentacja i B. Zmarzlik'],
  ['Lotto', 'gry liczbowe (Totalizator Sportowy)', 'k', [100, 600], [4, 3, 8, 12, 16, 13, 14], 0, 'aktualny', 'partner kilkunastu klubów żużlowych'],
  ['LW Bogdanka', 'górnictwo', 'r', [300, 1500], [4], 1, 'aktualny', 'sponsor strategiczny Motoru Lublin'],
  ['Grupa Azoty', 'chemia', 'k', [300, 1700], [4, 15, 20, 22], 1, 'byly', 'Motor 2018–2023 (0,49–1,7 mln zł/rok), Unia Tarnów; wycofała się przy problemach finansowych'],
  ['Enea', 'energetyka', 'k', [200, 900], [9, 7, 10, 16, 18, 13, 14], 1, 'aktualny', 'strategiczny Unii Leszno (200–300 tys. zł/rok w 2023); wcześniej Gorzów, Poznań, Gniezno'],
  ['Tauron', 'energetyka', 'k', [300, 1000], [6, 1, 5], 1, 'aktualny', 'Włókniarz (900 tys. zł/rok, 2023), Sparta; prezes spółki znany jako kibic żużla'],
  ['KGHM', 'miedź', 'k', [200, 800], [7, 1], 1, 'aktualny', 'Stal Gorzów (250 tys. zł, 2023)'],
  ['Energa', 'energetyka', 'k', [200, 800], [17, 10], 1, 'byly', 'sponsor tytularny Wybrzeża w 2024 r.'],
  ['Jastrzębska Spółka Węglowa', 'górnictwo', 'r', [200, 700], [5], 1, 'aktualny', 'ROW Rybnik'],
  ['PGZ Polska Grupa Zbrojeniowa', 'zbrojeniówka', 'k', [100, 500], [14], 0, 'byly', 'Ostrów'],
  ['PKO BP', 'bank', 'k', [200, 800], [9], 1, 'byly', 'Unia Leszno (lista SSP w żużlu, 2023)'],
  ['Bank Pocztowy', 'bank', 'k', [50, 250], [14], 0, 'aktualny', 'Ostrów'],
  ['UniCredit', 'bank', 'm', [300, 1200], [1], 0, 'aktualny', 'nowy sponsor Sparty w 2026; wspiera Ferrari w F1'],
  ['Fortuna', 'bukmacher', 'k', [200, 1000], [2], 1, 'aktualny', 'partner PGE Ekstraligi i KS Toruń'],
  ['LV BET', 'bukmacher', 'k', [100, 500], [4, 19], 1, 'aktualny', 'sponsor główny Motoru Lublin; od 2026 sponsor tytularny Lokomotiv Daugavpils (LVBET Lokomotiv)'],
  ['Superbet', 'bukmacher', 'k', [200, 1200], [], 1, 'potencjalny', 'partner Grand Prix na PGE Narodowym 2023–2024; brak umowy klubowej'],
  ['STS', 'bukmacher', 'k', [200, 1500], [], 1, 'potencjalny', 'najszersza oferta zakładów na żużel wśród bukmacherów; aktywny sponsor sportu'],
  ['Betclic', 'bukmacher', 'm', [200, 1200], [], 1, 'potencjalny', 'legalny bukmacher, sponsoring piłki i siatkówki'],
  ['Mennica Polska', 'finanse', 'k', [100, 500], [4], 0, 'aktualny', 'sponsor główny Motoru Lublin'],
  ['Maspo', 'spożywcza (Lubella, Spiżarnia)', 'k', [300, 1200], [4], 1, 'aktualny', 'sponsor główny Motoru na 2026 (też piłka i siatkówka w Lublinie)'],
  ['Perła Browary Lubelskie', 'browar', 'r', [100, 500], [4], 0, 'aktualny', 'sponsor główny Motoru do 2027'],
  ['Warka', 'browar (Grupa Żywiec)', 'k', [30, 250], [1, 8, 11], 0, 'aktualny', 'sponsor biegów i partner kilku klubów'],
  ['Macron', 'odzież sportowa', 'm', [30, 150], [1, 4], 0, 'aktualny', 'sponsor techniczny (stroje)'],
  ['Metalkas', 'budownictwo stalowe (Bayersystem)', 'k', [500, 2500], [8], 1, 'aktualny', 'sponsor tytularny Metalkas 2. Ekstraligi (2027–2029: ponad 2 mln zł dla klubów) i GKM 2025–2027'],
  ['Betard', 'budownictwo, prefabrykaty', 'r', [1000, 3500], [1], 1, 'aktualny', 'sponsor tytularny Sparty od 2010, umowa do 2027'],
  ['PRES Grupa Deweloperska', 'deweloper', 'r', [1000, 3500], [2, 10], 1, 'aktualny', 'sponsor tytularny Torunia, strategiczny Polonii Bydgoszcz'],
  ['For Nature Solutions', 'inwestycje (P. Termiński)', 'r', [500, 3000], [2], 1, 'aktualny', 'właściciel KS Toruń – Przemysław Termiński'],
  ['Stelmet', 'drewno ogrodowe (S. Bieńkowski)', 'r', [1000, 4000], [3], 1, 'aktualny', 'Stanisław Bieńkowski (Forbes: ok. 2,3 mld zł) – przewodniczący RN Falubazu, wieloletni mecenas'],
  ['Boll', 'motoryzacja (W. Dalewski)', 'r', [200, 1500], [3], 1, 'aktualny', 'sponsoruje żużel od 31 lat; prezes Wojciech Dalewski ma przejąć Falubaz'],
  ['SECO/WARWICK', 'przemysł (piece)', 'r', [100, 500], [3], 0, 'aktualny', 'oficjalny sponsor Falubazu'],
  ['Innpro', 'dystrybucja elektroniki', 'r', [500, 2000], [5], 1, 'aktualny', 'sponsor tytularny ROW Rybnik'],
  ['Krono-Plast', 'systemy dachowe', 'r', [800, 2500], [6], 1, 'aktualny', 'Kłobuck; sponsor tytularny Włókniarza i stadionu (B. Januszka – właściciel klubu)'],
  ['Grupa Gezet', 'budownictwo', 'r', [800, 2500], [7], 1, 'aktualny', 'sponsor tytularny Stali Gorzów (2025, z opcją przedłużenia)'],
  ['Fogo', 'agregaty prądotwórcze', 'r', [800, 2500], [9], 1, 'aktualny', 'sponsor tytularny Unii Leszno od 2013'],
  ['Qmex Energy (Gulf)', 'paliwa, oleje', 'r', [100, 500], [9], 0, 'aktualny', 'licencjobiorca Gulf, sponsor główny Unii od 2026'],
  ['Abramczyk', 'transport, motoryzacja', 'r', [500, 1800], [10], 1, 'aktualny', 'sponsor tytularny Polonii od 2021'],
  ['Cellfast', 'ogród (węże, systemy)', 'r', [500, 1800], [11], 1, 'aktualny', 'partner tytularny Wilków Krosno 2026'],
  ['Texom', 'tekstylia', 'r', [500, 1500], [12], 1, 'byly', 'sponsor tytularny Stali Rzeszów do 2025 – wycofał się'],
  ['Dakar Development', 'deweloper', 'r', [500, 1800], [12], 1, 'aktualny', 'sponsor tytularny Stali Rzeszów od 2026'],
  ['Hunters', 'ochrona', 'r', [300, 1200], [13], 1, 'aktualny', 'sponsor tytularny PSŻ do 2027'],
  ['Moonfin Malesa', 'sprzęt wędkarski', 'r', [400, 1200], [14], 1, 'aktualny', 'sponsor tytularny Ostrowa'],
  ['Autona', 'motoryzacja', 'r', [200, 800], [15], 1, 'aktualny', 'Nowy Sącz; sponsor tytularny Unii Tarnów od 2024'],
  ['H.Skrzydlewska', 'usługi (kwiaciarnie, pogrzeby)', 'r', [400, 1500], [16], 1, 'aktualny', 'Witold Skrzydlewski prowadził klub przez 19 lat'],
  ['Grupa Zdunek', 'motoryzacja', 'r', [500, 1800], [17], 1, 'aktualny', 'Tadeusz Zdunek – prezes Wybrzeża; sponsor tytularny 2017–2023 i od 2026'],
  ['Ultrapur', 'uzdatnianie wody', 'r', [300, 900], [18], 1, 'aktualny', 'sponsor tytularny Startu Gniezno'],
  ['Centrum Usługowe OMEGA Ochrona', 'ochrona', 'r', [150, 500], [18], 1, 'aktualny', 'drugi sponsor tytularny Gniezna 2026'],
  ['Optibet', 'bukmacher', 'm', [200, 700], [19], 1, 'aktualny', 'sponsor tytularny Lokomotiv Daugavpils do 2025 (od 2026 LV BET)'],
  ['Pronergy', 'fotowoltaika', 'r', [300, 900], [20], 1, 'aktualny', 'sponsor tytularny Polonii Piła'],
  ['Trans MF', 'transport', 'm', [200, 700], [23], 1, 'aktualny', 'sponsor tytularny Landshut Devils'],
  ['Stal-Met Nieczaj', 'stal', 'r', [150, 600], [22], 1, 'potencjalny', 'Jelcz-Laskowice; wymieniany jako sponsor tytularny TS Kolejarz Opole'],
  ['Visscher-Caravelle', 'tkaniny techniczne', 'm', [150, 600], [8], 1, 'aktualny', 'sponsor główny GKM'],
  ['Develia', 'deweloper', 'k', [200, 900], [1], 1, 'aktualny', 'sponsor premium Sparty'],
  ['Ramirent', 'wynajem maszyn', 'm', [30, 150], [3, 8, 13], 0, 'aktualny', 'partner kilku klubów'],
  ['Beckhoff', 'automatyka', 'm', [50, 300], [1, 16], 0, 'aktualny', 'strategiczny Sparty, sponsor Orła 2026'],
  ['Arriva', 'transport publiczny', 'm', [30, 150], [8], 0, 'aktualny', 'sponsor GKM'],
  ['Case', 'maszyny rolnicze', 'm', [30, 200], [8, 12, 11], 0, 'aktualny', 'partner GKM, Stali Rzeszów, Wilków'],
  ['Inter Cars', 'części samochodowe', 'k', [50, 400], [9], 0, 'aktualny', 'partner Unii Leszno'],
  ['FAKRO', 'okna dachowe', 'k', [200, 1000], [6, 15], 1, 'aktualny', 'Nowy Sącz; sponsor Włókniarza 2026'],
  ['Merkury Market', 'markety budowlane', 'r', [100, 500], [11, 12], 1, 'aktualny', 'sponsor główny Wilków'],
  ['Nowy Styl', 'meble biurowe', 'k', [100, 800], [11, 12], 1, 'aktualny', 'Krosno; partner Wilków'],
  ['Marma Polskie Folie', 'folie', 'r', [100, 500], [11, 12], 1, 'aktualny', 'Rzeszów; partner Wilków (dawny sponsor Stali Rzeszów)'],
  ['Mielewczyk', 'deweloper', 'r', [100, 500], [17], 1, 'aktualny', 'sponsor strategiczny plus Wybrzeża'],
  ['Port Lotniczy Gdańsk', 'lotnisko', 'r', [100, 400], [17], 0, 'aktualny', 'partner główny Wybrzeża'],
  ['Wrocławski Port Lotniczy', 'lotnisko', 'r', [100, 400], [1], 0, 'aktualny', 'sponsor strategiczny Sparty'],
  ['Apator', 'aparatura pomiarowa', 'r', [200, 900], [2], 1, 'byly', 'historyczna nazwa toruńskiego klubu (KS Apator Toruń)'],
  ['Unibax', 'inwestycje (R. Karkosik)', 'r', [500, 3000], [2], 1, 'byly', 'Roman Karkosik przejął toruński klub i spłacił długi'],
  ['ebut.pl', 'e-handel budowlany', 'r', [200, 900], [7], 1, 'aktualny', 'wcześniej sponsor tytularny Stali Gorzów'],
  ['Zooleszcz', 'karma dla zwierząt', 'r', [100, 600], [8, 10], 1, 'byly', 'wcześniej sponsor tytularny Polonii Bydgoszcz, partner GKM'],
  ['Car Gwarant', 'motoryzacja', 'r', [100, 400], [18], 1, 'byly', 'wcześniej w nazwie Startu Gniezno'],
  // Potencjalni duzi inwestorzy – hipotezy na podstawie siedziby w mieście / regionie klubu i profilu sponsoringu (bez potwierdzonych rozmów)
  ['Dino Polska', 'handel spożywczy', 'k', [300, 2000], [14, 9], 1, 'potencjalny', 'siedziba w Krotoszynie (między Ostrowem a Lesznem)'],
  ['Amica', 'AGD', 'k', [200, 1000], [13, 9], 1, 'potencjalny', 'Wronki (Wielkopolska)'],
  ['Solaris Bus & Coach', 'autobusy', 'm', [200, 900], [13], 1, 'potencjalny', 'Bolechowo k. Poznania'],
  ['Asseco Poland', 'IT', 'k', [200, 1200], [12], 1, 'potencjalny', 'siedziba w Rzeszowie, sponsor sportu w regionie'],
  ['Synthos', 'chemia', 'k', [300, 1500], [21, 15], 1, 'potencjalny', 'Oświęcim (Małopolska)'],
  ['Comarch', 'IT', 'k', [200, 1000], [21], 1, 'potencjalny', 'Kraków, sponsor sportu w Krakowie'],
  ['Can-Pack', 'opakowania', 'm', [200, 800], [21, 12], 1, 'potencjalny', 'Kraków'],
  ['Neuca', 'dystrybucja leków', 'k', [200, 900], [2], 1, 'potencjalny', 'siedziba w Toruniu'],
  ['LPP', 'odzież', 'k', [300, 2000], [17], 1, 'potencjalny', 'siedziba w Gdańsku'],
  ['Polska Grupa Górnicza', 'górnictwo', 'k', [200, 800], [5, 24], 1, 'potencjalny', 'kopalnie w Rybniku i na Śląsku'],
  ['Signify (Philips) Piła', 'oświetlenie', 'm', [100, 400], [20], 0, 'potencjalny', 'duży zakład w Pile'],
  ['Mondi Świecie', 'papier', 'm', [100, 500], [8, 10], 1, 'potencjalny', 'zakład w Świeciu k. Grudziądza'],
  ['Pesa Bydgoszcz', 'tabor kolejowy', 'k', [100, 600], [10], 1, 'potencjalny', 'Bydgoszcz'],
  ['Lumel', 'elektronika', 'r', [50, 300], [3], 0, 'aktualny', 'Zielona Góra, partner Falubazu'],
  ['Herbapol Lublin', 'spożywcza', 'r', [100, 500], [4], 0, 'potencjalny', 'Lublin'],
  ['BMW Group Dingolfing', 'motoryzacja', 'm', [200, 900], [23], 1, 'potencjalny', 'fabryka w powiecie sąsiadującym z Landshut'],
  ['Selena FM', 'chemia budowlana', 'k', [100, 600], [1], 1, 'potencjalny', 'Wrocław'],
  ['Pratt & Whitney Rzeszów', 'lotnictwo', 'm', [100, 500], [12], 0, 'potencjalny', 'Rzeszów'],
  ['Elektrociepłownia Zielona Góra', 'energetyka', 'r', [100, 400], [3, 18], 0, 'aktualny', 'wspierała Falubaz i Start Gniezno'],
  // Branża wokół żużla: sprzęt, oleje, opony, motoryzacja (sponsorzy techniczni zawodników i klubów)
  ['Mitas', 'opony żużlowe', 'm', [30, 300], [], 0, 'potencjalny', 'czeski producent opon, kontrakty z zawodnikami'],
  ['Anlas', 'opony żużlowe', 'm', [30, 200], [], 0, 'potencjalny', 'turecki producent opon bezdętkowych z homologacją FIM'],
  ['Motul', 'oleje', 'm', [30, 250], [], 0, 'potencjalny', 'oleje motocyklowe'],
  ['Castrol', 'oleje', 'm', [50, 300], [], 0, 'potencjalny', 'oleje motocyklowe'],
  ['Fuchs', 'oleje', 'm', [20, 150], [9], 0, 'aktualny', 'partner Unii Leszno'],
  ['Eurol', 'oleje', 'm', [20, 120], [8], 0, 'aktualny', 'partner GKM'],
  ['Fit-Oil', 'oleje', 'l', [10, 60], [1], 0, 'aktualny', 'sponsor biegu w Sparcie'],
  ['Cutline Wear Factory', 'kevlary i odzież', 'l', [10, 80], [12], 0, 'aktualny', 'Rzeszów, sponsor Stali'],
  ['YATO', 'narzędzia', 'k', [30, 200], [1], 0, 'aktualny', 'partner Sparty'],
  ['iParts.pl', 'części samochodowe', 'k', [30, 200], [7], 0, 'aktualny', 'partner Stali Gorzów'],
  ['Polaris Quady', 'motocykle i quady', 'l', [10, 60], [3], 0, 'aktualny', 'partner Falubazu'],
  ['Strefa ATV', 'motocykle i quady', 'l', [10, 50], [11], 0, 'aktualny', 'partner Wilków'],
  ['Motoluka', 'motocykle', 'l', [10, 50], [12], 0, 'aktualny', 'partner Stali Rzeszów'],
  ['Monster Energy', 'napoje energetyczne', 'm', [100, 800], [], 1, 'potencjalny', 'sponsor sportów motorowych'],
];
// Szablony lokalnych firm z branż wokół żużla (do uzupełniania listy firm w miastach klubów)
const LOCAL_FIRM_TEMPLATES = [
  ['Auto-Serwis {c}', 'motoryzacja'], ['Moto-Części {c}', 'części motocyklowe'], ['Hurtownia Budowlana {c}', 'budownictwo'], ['Transport {c}', 'transport'],
  ['Deweloper {c} Invest', 'deweloper'], ['Browar {c}', 'browar'], ['Piekarnia {c}', 'spożywcza'], ['Hotel {c}', 'hotelarstwo'], ['Radio {c}', 'media'],
  ['Drukarnia {c}', 'poligrafia'], ['Okna {c}', 'budownictwo'], ['Fotowoltaika {c}', 'energetyka'], ['Kancelaria {c}', 'usługi prawne'], ['Stacja Paliw {c}', 'paliwa'],
  ['Agro {c}', 'rolnictwo'], ['Salon Samochodowy {c}', 'motoryzacja'], ['Meble {c}', 'meble'], ['Ochrona {c}', 'ochrona'],
];

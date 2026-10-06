'use strict';
// Zarządy i właściciele klubów (stan na start gry 15.10.2025 i znane zmiany po tej dacie: since / until).
// Źródła: KRS przez compabase.com (zarząd, prokurenci, rada nadzorcza, beneficjenci, sprawozdania za rok 1.11.2024–31.10.2025),
// BIP GKM, oficjalne strony klubów, prasa – szczegóły w data/finance/zarzady.md.
// role: prezes | wiceprezes | czlonek (zarząd) | prokurent | dyrektor | wlasciciel (bez funkcji w organach) | rn-przew | rn (rada nadzorcza)
// wage: wynagrodzenie miesięczne brutto, gdy znane; bez niego gra liczy szacunek (boardWage, js/board.js).
// link: powiązanie (krótko, do tabeli): firm – firma (nazwa jak w COMPANY_DB / listach sponsorów) albo city: true; text – np. „prezes Investon”.
// owner: type prywatny | miasto | stowarzyszenie | mieszany | rozproszony, text – akcjonariusze; cityShare – udział miasta.
// firms: firmy-akcjonariusze (związane z klubem jak sponsor z człowiekiem we władzach).
// fin: sprawozdanie [rok, przychody, wynik netto, kapitał własny] w mln zł. debt: zadłużenie na start gry (js/board.js: boardStartDebts) –
// overdue: zaległe zobowiązania (ujemne saldo), loan: [kwota, oprocentowanie, miesiące, nazwa] – ujemny kapitał własny ze sprawozdań.
const CLUB_BOARD = {
  1: { form: 'WTS S.A.', krs: '0000092365', owner: { type: 'rozproszony', text: 'Solpol – 30,2%, TOI TOI – 12,1%, Artur Jackowski – 8,9%, Krystyna Rusko – 4,0%, Andrzej Rusko – 2,7%, stowarzyszenie WTS – 2,4%, pozostali' },
    firms: ['Solpol', 'TOI TOI Polska'], fin: [2025, 34.35, 5.16, 23.35],
    people: [
      { name: 'Andrzej Rusko', role: 'prezes', since: '2018-01-22', link: { text: 'akcjonariusz (2,7%)' } },
      { name: 'Krystyna Rusko', role: 'prokurent', note: 'prezes klubu 2006–2017', link: { text: 'akcjonariusz (4,0%)' } },
      { name: 'Artur Jackowski', role: 'rn', since: '2007-04-30', link: { firm: 'ARAD', text: 'prezes ARAD, akcjonariusz (8,9%)' } },
      { name: 'Artur Rusko', role: 'rn' }, { name: 'Łukasz Klimczyk', role: 'rn' },
    ] },
  2: { form: 'KS Toruń S.A.', krs: '0000273592', debt: { loan: [1.9e6, 0.05, 48, 'Pożyczka właściciela'], note: 'ujemny kapitał własny −1,94 mln zł (2024)' }, owner: { type: 'prywatny', text: 'Przemysław Termiński – 100%' }, fin: [2024, 25.16, 0.05, -1.94],
    people: [
      { name: 'Ilona Termińska', role: 'prezes', since: '2015-11-20' },
      { name: 'Joanna Sikorska', role: 'prokurent' },
      { name: 'Przemysław Termiński', role: 'wlasciciel', since: '2014-01-01' },
      { name: 'Adam Krużyński', role: 'rn' }, { name: 'Jerzy Polaszek', role: 'rn' }, { name: 'Łukasz Szarszewski', role: 'rn' }, { name: 'Magdalena Wiszniowska', role: 'rn' },
    ] },
  3: { form: 'ZKŻ SSA', krs: '0000268296', cityShare: '33,71% akcji', owner: { type: 'mieszany', text: 'Miasto Zielona Góra – 33,71%, Stelmet (S. Bieńkowski), akcjonariusze prywatni' }, fin: [2025, 23.16, 0.68, 1.07],
    people: [
      { name: 'Adam Goliński', role: 'prezes', until: '2026-08-20', link: { firm: 'Stelmet', text: 'pełnomocnik Stelmet' } },
      { name: 'Michał Pepiński', role: 'prezes', since: '2026-08-20', note: 'członek rady delegowany do czasowego pełnienia funkcji prezesa' },
      { name: 'Rafał Prokopiuk', role: 'czlonek', since: '2026-08-20' },
      { name: 'Paweł Jarmużek', role: 'rn', link: { firm: 'Stelmet', text: 'przedstawiciel Stelmet' } },
      { name: 'Artur Haładyn', role: 'rn' }, { name: 'Michał Pepiński', role: 'rn', until: '2026-08-20' },
    ] },
  4: { form: 'Speedway Lublin S.A.', krs: '0000758978', owner: { type: 'prywatny', text: 'Jakub Kępa – 30%, Piotr Więckowski – 30%, Aleksandra Marmuszewska – 20%, Patryk Knapik – 20%' }, fin: [2025, 28.62, -1.95, 0.83],
    people: [
      { name: 'Jakub Kępa', role: 'prezes', since: '2018-11-22', wage: 30000, link: { text: 'akcjonariusz (30%)' } },
      { name: 'Piotr Więckowski', role: 'wiceprezes', since: '2018-11-22', wage: 20000, link: { city: true, text: 'akcjonariusz (30%), były radny Lublina' } },
      { name: 'Aleksandra Marmuszewska', role: 'wiceprezes', wage: 20000, link: { text: 'akcjonariusz (20%)' } },
      { name: 'Patryk Knapik', role: 'rn', since: '2018-11-22', link: { text: 'akcjonariusz (20%)' } }, { name: 'Maria Brus', role: 'rn', since: '2018-11-22' },
      { name: 'Katarzyna Płochocka', role: 'rn', since: '2020-05-26' }, { name: 'Elżbieta Kępa', role: 'rn', since: '2022-07-07' },
    ] },
  5: { form: 'KS ROW Rybnik S.A.', krs: '0000594658', owner: { type: 'stowarzyszenie', text: 'Stowarzyszenie ŻKS ROW Rybnik – 100%' }, fin: [2025, 14.46, 0.02, 3.77],
    people: [
      { name: 'Krzysztof Mrozek', role: 'prezes', link: { text: 'prezes stowarzyszenia – akcjonariusza' } },
      { name: 'Tomasz Budniok', role: 'rn-przew' },
      { name: 'Czesław Lajdamik', role: 'rn', link: { text: 'wiceprezes stowarzyszenia – akcjonariusza' } },
      { name: 'Andrzej Waliszewski', role: 'rn' },
    ] },
  6: { form: 'Włókniarz Częstochowa S.A.', krs: '0000652005', owner: { type: 'prywatny', text: 'Bartłomiej Januszka – 100%' }, fin: [2025, 21.01, 0.85, 0.06],
    people: [
      { name: 'Michał Świącik', role: 'prezes', until: '2025-10-16' },
      { name: 'Bartłomiej Januszka', role: 'prezes', since: '2025-10-16', link: { firm: 'Krono-Plast', text: 'właściciel Krono-Plast' } },
      { name: 'Jakub Michalski', role: 'dyrektor', since: '2025-10-16', note: 'przedstawiany jako prezes klubu' },
      { name: 'Patrycja Świącik-Jeż', role: 'rn' }, { name: 'Jarosław Całus', role: 'rn' }, { name: 'Marek Długosz', role: 'rn' },
    ] },
  7: { form: 'Stal Gorzów Wlkp. S.A.', krs: '0000307090', cityShare: '23% głosów', owner: { type: 'mieszany', text: 'Zbigniew Głuchy – 25,4%, Miasto Gorzów Wlkp. – 23% głosów, stowarzyszenie Stal Gorzów, wierzyciele (konwersja długu na akcje) i kibice' },
    fin: [2025, 21.06, -3.94, 0.12],
    // 2024: strata 10,06 mln zł; luka w budżecie 3,9–5,5 mln zł (2026), kredyt – prawie 1 mln zł rat rocznie, akcjonariusze dopłacili 3 mln zł w 2025 (gorzowianin.com)
    debt: { overdue: 2.5e6, loan: [3.0e6, 0.09, 36], note: 'zaległe zobowiązania i kredyt bankowy po stracie 10 mln zł w 2024 r.' },
    people: [
      { name: 'Dariusz Wróbel', role: 'prezes', since: '2024-11-15', until: '2025-12-08' },
      { name: 'Patryk Broszko', role: 'wiceprezes', since: '2025-02-28', until: '2025-12-08' },
      { name: 'Jacek Gumowski', role: 'wiceprezes', since: '2025-02-28', until: '2025-12-08' },
      { name: 'Monika Piaskowska', role: 'wiceprezes', since: '2025-02-28', until: '2025-12-08' },
      { name: 'Dariusz Maćkowiak', role: 'czlonek', since: '2025-02-28', until: '2025-12-08' },
      { name: 'Krzysztof Hauba', role: 'czlonek', since: '2025-02-28', until: '2025-12-08' },
      { name: 'Zbigniew Głuchy', role: 'rn', since: '2025-02-28', until: '2025-12-08', link: { firm: 'Gezet', text: 'właściciel Gezet' } },
      { name: 'Zbigniew Głuchy', role: 'prezes', since: '2025-12-08', wage: 0, link: { firm: 'Gezet', text: 'właściciel Gezet' } },
      { name: 'Krzysztof Nuckowski', role: 'wiceprezes', since: '2025-12-08', wage: 0 },
      { name: 'Dariusz Wróbel', role: 'prokurent', since: '2025-12-08' }, { name: 'Magdalena Ciszek-Kozłowska', role: 'prokurent', since: '2025-12-08' },
      { name: 'Łukasz Gałczyński', role: 'dyrektor', since: '2025-12-08' },
      { name: 'Krzysztof Hauba', role: 'rn', since: '2025-12-08' },
      { name: 'Jacek Wojciechowski', role: 'rn', since: '2025-02-28' }, { name: 'Ewa Staszak', role: 'rn', since: '2025-02-28' },
      { name: 'Grzegorz Lewandowski', role: 'rn', since: '2025-02-28' }, { name: 'Wojciech Maciejewski', role: 'rn', since: '2025-02-28' },
    ] },
  8: { form: 'GKM S.A.', krs: '0000459674', cityShare: '98% akcji', owner: { type: 'miasto', text: 'Gmina-Miasto Grudziądz – 98%, Z. Fiałkowski, Z. Cichoracki, stowarzyszenie GTŻ' }, fin: [2025, 12.76, -7.69, 2.10],
    people: [
      { name: 'Marcin Murawski', role: 'prezes' },
      { name: 'Grzegorz Nowak', role: 'prokurent' },
      { name: 'Marietta Pokrzywnicka', role: 'rn-przew', link: { city: true, text: 'przedstawiciel miasta' } },
      { name: 'Zbigniew Leszczyński', role: 'rn', link: { city: true, text: 'przedstawiciel miasta' } },
      { name: 'Zdzisław Cichoracki', role: 'rn', link: { text: 'akcjonariusz' } },
    ] },
  9: { form: 'Unia Leszno SSA', krs: '0000237219', owner: { type: 'prywatny', text: 'Waldemar Ciesiółka, Maciej Duda, Józef Dworakowski, Piotr Rusiecki – po 25%' }, fin: [2025, 15.59, 0.04, 0.03],
    people: [
      { name: 'Piotr Rusiecki', role: 'prezes', until: '2025-10-01' },
      { name: 'Józef Dworakowski', role: 'prezes', since: '2025-10-15' },
      { name: 'Marek Ślotała', role: 'wiceprezes', since: '2025-10-15' },
      { name: 'Maciej Duda', role: 'rn-przew', since: '2005-06-30', link: { firm: 'Duda Holding', text: 'prezes Duda Holding' } },
      { name: 'Waldemar Ciesiółka', role: 'rn', since: '2005-06-30' },
      { name: 'Karolina Dworakowska-Matuszewska', role: 'rn', since: '2025-11-28' },
    ] },
  10: { form: 'ŻKS Polonia Bydgoszcz S.A.', krs: '0000267772', owner: { type: 'prywatny', text: 'Jerzy Kanclerz – 100%' }, fin: [2025, 14.66, 0.60, 0.57],
    people: [
      { name: 'Jerzy Kanclerz', role: 'prezes', since: '2018-10-26' },
      { name: 'Mariola Sznyra', role: 'rn', since: '2019-03-22' }, { name: 'Karolina Gil', role: 'rn', since: '2019-03-22' }, { name: 'Marek Tomaszewski', role: 'rn', since: '2025-08-08' },
    ] },
  11: { form: 'Wilki Krosno S.A.', krs: '0000751340', owner: { type: 'prywatny', text: 'Daniel Dębosz – 58,2%, Grzegorz Leśniak – 33,33%' }, fin: [2025, 12.41, 0.01, 0.53],
    people: [
      { name: 'Grzegorz Leśniak', role: 'prezes', since: '2018-10-02' },
      { name: 'Robert Węgrzyn', role: 'wiceprezes' },
      { name: 'Daniel Dębosz', role: 'rn' }, { name: 'Andrzej Galak', role: 'rn' }, { name: 'Jacek Leśniak', role: 'rn' },
    ] },
  12: { form: 'H69 Speedway S.A.', krs: '0000953535', owner: { type: 'prywatny', text: 'Katarzyna Marszałek – 60%, Texom S.A., Jan Madej, Jakub Gibała, Rzeszowskie Towarzystwo Żużlowe' }, firms: ['Texom'], fin: [2025, 11.79, 0.86, 0.03],
    people: [
      { name: 'Michał Drymajło', role: 'prezes', until: '2025-04-14' },
      { name: 'Katarzyna Marszałek', role: 'prezes', since: '2025-04-14', link: { text: 'akcjonariusz (60%)' } },
      { name: 'Marcin Gąsior', role: 'czlonek', since: '2026-03-16' },
      { name: 'Monika Bułas', role: 'prokurent' },
      { name: 'Paweł Baszak', role: 'rn' }, { name: 'Michał Chmielik', role: 'rn' }, { name: 'Mateusz Idler', role: 'rn' }, { name: 'Jan Madej', role: 'rn', link: { text: 'akcjonariusz' } }, { name: 'Patrycja Madej', role: 'rn' }, { name: 'Jakub Gibała', role: 'udzialowiec', link: { text: 'akcjonariusz' } },
    ] },
  13: { form: 'PSŻ Poznań sp. z o.o.', krs: '0001072406', debt: { loan: [0.77e6, 0.05, 36, 'Pożyczka udziałowca'], note: 'ujemny kapitał własny −0,77 mln zł (2025)' }, owner: { type: 'prywatny', text: 'Jakub Kozaczyk – 100% udziałów' }, fin: [2025, 7.28, 0.04, -0.77],
    people: [
      { name: 'Jakub Kozaczyk', role: 'prezes', since: '2023-11-29', link: { firm: 'Investon', text: 'prezes Investon' } },
      { name: 'Grzegorz Struzik', role: 'czlonek', link: { firm: 'Nova', text: 'prezes Nova' } },
    ] },
  14: { form: 'TŻ Ostrovia S.A.', krs: '0000665663', debt: { loan: [0.46e6, 0.08, 24], note: 'ujemny kapitał własny −0,46 mln zł (2025)' }, owner: { type: 'prywatny', text: 'Waldemar Górski, Mariusz Staszewski, Krystian Wawrzyniak (beneficjenci rzeczywiści)' }, fin: [2025, 8.70, 0.15, -0.46],
    people: [
      { name: 'Waldemar Górski', role: 'prezes', since: '2020-10-08' },
      { name: 'Krystian Wawrzyniak', role: 'czlonek', since: '2023-09-12', link: { firm: 'Moonfin Malesa', text: 'przedstawiciel Moonfin i Frukta' } },
      { name: 'Mariusz Kołodziejczyk', role: 'prokurent', since: '2026-06-09' },
      { name: 'Krzysztof Malesa', role: 'rn', link: { firm: 'Moonfin Malesa', text: 'współwłaściciel Malesa Pokrycia Dachowe' } },
      { name: 'Łukasz Majchrzak', role: 'rn' }, { name: 'Radosław Spychała', role: 'rn' }, { name: 'Arkadiusz Rudowicz', role: 'rn' }, { name: 'Tomasz Przybył', role: 'rn' },
    ] },
  15: { form: 'Unia Tarnów ŻSSA', krs: '0000112674', debt: { overdue: 0.5e6, note: 'zaległości i ujemny kapitał (2023), upadłość wszczęta 1.07.2026' }, owner: { type: 'prywatny', text: 'Jacek Pocięgiel – 53,13%, Wiesław Frys – 31,15%, pozostali' }, fin: [2023, 2.41, 0.51, -0.30],
    people: [
      { name: 'Artur Kędziora', role: 'prezes', since: '2025-08-26' },
      { name: 'Agnieszka Ratowska', role: 'dyrektor', since: '2025-08-26' },
      { name: 'Marek Pieniążek', role: 'dyrektor', since: '2025-08-26' },
      { name: 'Jacek Pocięgiel', role: 'rn', link: { text: 'akcjonariusz (53,13%)' } }, { name: 'Artur Lewandowski', role: 'rn' },
      { name: 'Wiesław Frys', role: 'udzialowiec', link: { text: 'akcjonariusz (31,15%)' } },
    ] },
  16: { form: 'KŻ Orzeł Łódź S.A.', krs: '0001071602', owner: { type: 'prywatny', text: 'Witold Skrzydlewski – 80%' }, fin: [2025, 7.24, 0.45, 0.13],
    people: [
      { name: 'Witold Skrzydlewski', role: 'prezes', link: { firm: 'H.Skrzydlewska', text: 'właściciel H.Skrzydlewska' } },
      { name: 'Jakub Zborowski', role: 'dyrektor', since: '2025-01-15', note: 'przedstawiany jako wiceprezes' },
      { name: 'Jan Konikiewicz', role: 'dyrektor', since: '2025-01-15' },
      { name: 'Przemysław Bartusiak', role: 'rn' }, { name: 'Marcin Ulacha', role: 'rn' }, { name: 'Renata Piwowarska', role: 'rn' },
    ] },
  17: { form: 'Wybrzeże Gdańsk S.A.', krs: '0001076837', debt: { overdue: 0.4e6, loan: [0.35e6, 0.05, 24, 'Pożyczka akcjonariusza'], note: 'strata 0,82 mln zł i ujemny kapitał −0,74 mln zł (2025)' }, owner: { type: 'prywatny', text: 'Tadeusz Zdunek – 100%' }, fin: [2025, 4.99, -0.82, -0.74],
    people: [
      { name: 'Agnieszka Okolotowicz', role: 'czlonek' }, { name: 'Mariusz Kędzielski', role: 'czlonek' },
      { name: 'Tadeusz Zdunek', role: 'rn', link: { firm: 'Grupa Zdunek', text: 'właściciel Grupy Zdunek' } },
      { name: 'Agnieszka Ślusarek', role: 'rn' }, { name: 'Anna Jakubowska', role: 'rn' },
    ] },
  18: { form: 'SKS Start S.A.', krs: '0000837783', owner: { type: 'stowarzyszenie', text: 'Stowarzyszenie GTM Start Gniezno – 100%' },
    people: [
      { name: 'Tomasz Adamski', role: 'prezes' },
      { name: 'Paweł Siwiński', role: 'wiceprezes', note: 'do 30.10.2025 także prezes stowarzyszenia GTM Start' },
      { name: 'Radosław Majewski', role: 'dyrektor' },
      { name: 'Marek Lewandowski', role: 'czlonek', since: '2025-10-30', link: { text: 'zarząd stowarzyszenia GTM Start' } },
      { name: 'Jakub Kaczmarek', role: 'czlonek', since: '2025-10-30', link: { text: 'zarząd stowarzyszenia GTM Start' } },
      { name: 'Krzysztof Barański', role: 'rn-przew' }, { name: 'Krzysztof Brzostowicz', role: 'rn' },
      { name: 'Robert Konieczny', role: 'rn' }, { name: 'Artur Banach', role: 'rn' },
    ] },
  19: { form: 'Spīdveja klubs Lokomotiv', owner: { type: 'stowarzyszenie', text: 'Klub sportowy (partnerzy główni: miasto Dyneburg, Olimpiskais Centrs, Sporta Pārvalde)' },
    people: [{ name: 'Andris Morozovs', role: 'prezes' }, { name: 'Nikolajs Kokins', role: 'dyrektor' }] },
  20: { form: 'Pilski Klub Sportowy Polonia Piła sp. z o.o.', krs: '0001001255', debt: { overdue: 0.6e6, note: 'ujemny kapitał własny −0,63 mln zł (2024)' }, owner: { type: 'prywatny', text: 'Dariusz Pućka – 50%, Dariusz Słowiński – 50%' }, fin: [2024, 4.08, -0.27, -0.63],
    people: [
      { name: 'Dariusz Pućka', role: 'prezes', since: '2022-11-08', link: { text: 'udziałowiec (50%)' } },
      { name: 'Dariusz Słowiński', role: 'czlonek', since: '2022-11-08', link: { text: 'udziałowiec (50%)' } },
    ] },
  21: { form: 'Speedway Kraków sp. z o.o.', krs: '0001074848', owner: { type: 'prywatny', text: 'Mikołaj Frankiewicz – 34%, Paweł Piskorz – 33%, Adam Weigel-Milleret – 33%' }, fin: [2024, 0.34, 0.06, 0.06],
    people: [
      { name: 'Mikołaj Frankiewicz', role: 'prezes', since: '2023-12-12', link: { text: 'udziałowiec (34%)' } },
      { name: 'Adam Weigel-Milleret', role: 'czlonek', since: '2023-12-12', link: { text: 'udziałowiec (33%), trener drużyny' } },
      { name: 'Paweł Piskorz', role: 'udzialowiec', link: { text: 'udziałowiec (33%)' } },
      { name: 'Tomasz Nosek', role: 'dyrektor' },
    ] },
  22: { form: 'TS Kolejarz Opole', krs: '0000587406', owner: { type: 'stowarzyszenie', text: 'Stowarzyszenie' },
    people: [
      { name: 'Zygmunt Dziemba', role: 'prezes', since: '2018-04-05' }, { name: 'Lucjusz Bilik', role: 'wiceprezes', since: '2017-05-29' },
      { name: 'Wiesław Bednarz', role: 'czlonek', since: '2023-08-04' }, { name: 'Jarosław Dymek', role: 'dyrektor', since: '2025-10-01' },
    ] },
  23: { form: 'AC Landshut e.V.', owner: { type: 'stowarzyszenie', text: 'Automobilclub Landshut e.V.' },
    people: [
      { name: 'Gerald Simbeck', role: 'prezes' }, { name: 'Kerstin Rudolph', role: 'wiceprezes' },
      { name: 'Katharina Seemann', role: 'czlonek' }, { name: 'Klaus Zwerschina', role: 'dyrektor' },
    ] },
  24: { form: 'KS Śląsk Świętochłowice S.A.', krs: '0001167243', owner: { type: 'rozproszony', text: 'Główni akcjonariusze: Dariusz Rieger, Janusz Sichma' },
    people: [
      { name: 'Dariusz Rieger', role: 'prezes', since: '2025-04-11', link: { text: 'główny akcjonariusz' } },
      { name: 'Grzegorz Gabor', role: 'prokurent', since: '2025-04-11' },
      { name: 'Janusz Sichma', role: 'rn', link: { text: 'główny akcjonariusz' } }, { name: 'Marcin Zarzecki', role: 'rn' }, { name: 'Mirosław Tekiela', role: 'rn' },
    ] },
  25: { form: 'Stowarzyszenie Żużlowe Kolejarz Rawicz', owner: { type: 'stowarzyszenie', text: 'Stowarzyszenie' },
    people: [{ name: 'Artur Ostrowski', role: 'prezes' }, { name: 'Marcel Kajzer', role: 'wiceprezes' }, { name: 'Piotr Dym', role: 'czlonek' }] },
  26: { form: 'Warszawskie Towarzystwo Speedwaya', owner: { type: 'stowarzyszenie', text: 'Stowarzyszenie' },
    people: [{ name: 'Ireneusz Kurzyński', role: 'prezes' }, { name: 'Wojciech Jankowski', role: 'wiceprezes' }, { name: 'Aneta Kuźniar', role: 'wiceprezes' }] },
};
// Firmy, które realnie są związane z więcej niż jednym klubem (wyjątki od reguły wyłączności)
const SPONSOR_MULTI_OK = {
  'PRES Grupa Deweloperska': [2, 10], // tytularny Torunia, od 7 lat strategiczny Polonii Bydgoszcz
  'Gezet': [7, 3], // Z. Głuchy (prezes Stali) – Gezet nadal sponsorem Falubazu (Gazeta Lubuska)
};

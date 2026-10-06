// Licencje trenerów i instruktorów sportu żużlowego – tools/fetch_staff_licences.py (PZM 11.07.2025, kurs 28.03.2026)
const STAFF_LIC = {
"Adam Pawliczek": {
"cert": "I/29/2009",
"kind": "instruktor",
"lic": "2026",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2009
},
"Adam Skórnicki": {
"cert": "T/5/2018",
"kind": "trener",
"lic": "1831",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2018
},
"Adam Weigel-Milleret": {
"cert": "I/49/2015",
"kind": "instruktor",
"lic": "1908",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Adrian Cyfer": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Adrian Gomólski": {
"cert": "I/97/2022",
"kind": "instruktor",
"lic": "1800",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Adrian Miedziński": {
"cert": "I/134/2025",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Antoni Skupień": {
"cert": "I/14/2008",
"kind": "instruktor",
"lic": "1833",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2008
},
"Bartosz Świącik": {
"cert": "I/106/2022",
"kind": "instruktor",
"lic": "1457",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Błażej Skrzeszewski": {
"cert": "I/93/2019",
"kind": "instruktor",
"lic": "1784",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2019
},
"Cyprian Szymko": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Dariusz Śledź": {
"cert": "I/82/2017",
"kind": "instruktor",
"lic": "1781",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2017
},
"Dawid Lampart": {
"cert": "I/120/2023",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Eryk Jóźwiak": {
"cert": "I/121/2023",
"kind": "instruktor",
"lic": "1478",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Grzegorz Walasek": {
"cert": "I/128/2024",
"kind": "instruktor",
"lic": "1789",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Ireneusz Kwieciński": {
"cert": "T/16/2025",
"kind": "trener",
"lic": "850",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Jacek Folkert": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Jacek Woźniak": {
"cert": "I/12/2008",
"kind": "instruktor",
"lic": "1572",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2008
},
"Janusz Ślączka": {
"cert": "T/14/2023",
"kind": "trener",
"lic": "767",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Jarosław Gała": {
"cert": "I/11/2008",
"kind": "instruktor",
"lic": "971",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2008
},
"Józef Kafel": {
"cert": "I/98/2022",
"kind": "instruktor",
"lic": "1488",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Kacper Gomólski": {
"cert": "I/113/2023",
"kind": "instruktor",
"lic": "2033",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Kamil Brzozowski": {
"cert": "I/99/2022",
"kind": "instruktor",
"lic": "1533",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Kamil Walczak": {
"cert": "I/55/2015",
"kind": "instruktor",
"lic": "1173",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Krzysztof Bas": {
"cert": "I/70/2015",
"kind": "instruktor",
"lic": "1791",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Krzysztof Buczkowski": {
"cert": "I/126/2024",
"kind": "instruktor",
"lic": "1786",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Krzysztof Okupski": {
"cert": "I/122/2023",
"kind": "instruktor",
"lic": "1785",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Lech Kędziora": {
"cert": "T/13/2022",
"kind": "trener",
"lic": "1808",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Maciej Fajfer": {
"cert": "I/103/2022",
"kind": "instruktor",
"lic": "1796",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Maciej Gilowski": {
"cert": "I/132/2025",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Maciej Jąder": {
"cert": "I/109/2022",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Maciej Kuciapa": {
"cert": "I/90/2019",
"kind": "instruktor",
"lic": "1348",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2019
},
"Maciej Kuromonow": {
"cert": "I/129/2024",
"kind": "instruktor",
"lic": "1816",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Maciej Więckowski": {
"cert": "I/111/2023",
"kind": "instruktor",
"lic": "1838",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Marcel Kajzer": {
"cert": "I/135/2025",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Marcin Kowalik": {
"cert": "I/104/2022",
"kind": "instruktor",
"lic": "1562",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Marcin Kozdraś": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Marcin Sekulla": {
"cert": "I/80/2016",
"kind": "instruktor",
"lic": "1516",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2016
},
"Marek Kończyło": {
"cert": "I/130/2024",
"kind": "instruktor",
"lic": "1558",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Mariusz Staszewski": {
"cert": "T/6/2018",
"kind": "trener",
"lic": "1246",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2018
},
"Martyna Mróz": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Michał Widera": {
"cert": "T/3/2017",
"kind": "trener",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2017
},
"Mieczysław Woźniak": {
"cert": "I/39/2010",
"kind": "instruktor",
"lic": "1783",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2010
},
"Mirosław Cierniak": {
"cert": "I/56/2015",
"kind": "instruktor",
"lic": "892",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Norbert Kościuch": {
"cert": "I/107/2022",
"kind": "instruktor",
"lic": "1812",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Norbert Krakowiak": {
"cert": "I/137/2025",
"kind": "instruktor",
"lic": "2080",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Patryk Fajfer": {
"cert": "I/127/2024",
"kind": "instruktor",
"lic": "1795",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Paweł Baran": {
"cert": "I/59/2015",
"kind": "instruktor",
"lic": "870",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Paweł Parys": {
"cert": "I/61/2015",
"kind": "instruktor",
"lic": "1255",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Paweł Trześniewski": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Piotr Paluch": {
"cert": "I/40/2010",
"kind": "instruktor",
"lic": "901",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2010
},
"Piotr Protasiewicz": {
"cert": "I/117/2023",
"kind": "instruktor",
"lic": "1788",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Piotr Rembas": {
"cert": "I/27/2008",
"kind": "instruktor",
"lic": "1782",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2008
},
"Piotr Szymko": {
"cert": "I/13/2023",
"kind": "instruktor",
"lic": "1358",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Piotr Więckowski": {
"cert": "I/54/2025",
"kind": "instruktor",
"lic": "1171",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Piotr Świderski": {
"cert": "I/100/2022",
"kind": "instruktor",
"lic": "1787",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Piotr Świst": {
"cert": "I/114/2023",
"kind": "instruktor",
"lic": "1590",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Piotr Żyto": {
"cert": "T/4/2018",
"kind": "trener",
"lic": "411",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2018
},
"Przemysław Zarzycki": {
"cert": "I/119/2023",
"kind": "instruktor",
"lic": "1540",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Rafał Dobrucki": {
"cert": "T/10/2022",
"kind": "trener",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Rafał Koszałka": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Rafał Okoniewski": {
"cert": "I/133/2025",
"kind": "instruktor",
"lic": "1715",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Rafał Trojanowski": {
"cert": "I/124/2024",
"kind": "instruktor",
"lic": "1780",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
},
"Rafał Wojciechowski": {
"cert": "I/57/2015",
"kind": "instruktor",
"lic": "812",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Robert Jucha": {
"cert": "I/53/2015",
"kind": "instruktor",
"lic": "1181",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Robert Kempiński": {
"cert": "T/12/2022",
"kind": "trener",
"lic": "813",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Robert Kościecha": {
"cert": "T/7/2019",
"kind": "trener",
"lic": "1157",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2019
},
"Roman Jankowski": {
"cert": "I/9/2008",
"kind": "instruktor",
"lic": "785",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2008
},
"Sebastian Kowolik": {
"cert": "I/115/2023",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Stanisław Burza": {
"cert": "I/52/2015",
"kind": "instruktor",
"lic": "1857",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2015
},
"Stanisław Chomski": {
"cert": "T/11/2022",
"kind": "trener",
"lic": "260",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Stanisław Kępowicz": {
"cert": "I/83/2017",
"kind": "instruktor",
"lic": "1809",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2017
},
"Szymon Woźniak": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Tomasz Bajerski": {
"cert": "I/86/2018",
"kind": "instruktor",
"lic": "1448",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2018
},
"Tomasz Gapiński": {
"cert": "I/123/2025",
"kind": "instruktor",
"lic": "1797",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2025
},
"Tomasz Szupienko": {
"cert": "I/118/2023",
"kind": "instruktor",
"lic": null,
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2023
},
"Tomasz Szymankiewicz": {
"cert": "I/108/2022",
"kind": "instruktor",
"lic": "489",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2022
},
"Wiktor Jasiński": {
"cert": null,
"date": "2026-03-28",
"kind": "instruktor",
"lic": null,
"src": "kurs instruktorów PZM 28.03.2026 (speedwaysw.pl)",
"year": 2026
},
"Wojciech Kończyło": {
"cert": "T/15/2024",
"kind": "trener",
"lic": "1810",
"src": "PZM, lista trenerów i instruktorów (11.07.2025)",
"year": 2024
}
};

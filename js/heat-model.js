// Model wyniku biegu (Plackett–Luce) – kolejność na mecie: sortowanie po u + szum Gumbela, u = beta·forma dnia + pole + styl jazdy.
// Współczynniki pól i gospodarza: dopasowanie do protokołów lig szwedzkich (tools/fit_heat_model.py, tools/eval_heat_model.py);
// beta: strojenie silnika na biegach 2026 do 30 czerwca (tools/export-heat-engine.cjs), sprawdzian na biegach od 1 lipca.
// gate – użyteczność pól A–D względem A; track – wpływ stanu nawierzchni pod polem (js/track.js: surfFx().gate) ponad bazę.
const HEAT_MODEL = { beta: 0.36, gate: { A: 0, B: -0.322, C: -0.354, D: -0.227 }, track: 1, homeU: 0.315 }; // homeU – przewaga gospodarza w jednostkach użyteczności (w umiejętnościach: homeU / beta)
// legacy: dawny silnik (start + szum normalny) – tylko do porównań w tools/export-heat-engine.cjs (HM_LEGACY=1)

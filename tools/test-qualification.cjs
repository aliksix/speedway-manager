#!/usr/bin/env node
// Test paczki reguł kwalifikacji (data/qualification): walidacja i przykładowe nominacje. Uruchomienie: node tools/test-qualification.cjs
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const assert = require('assert');

execFileSync(process.execPath, [path.join(__dirname, 'build-qualification.cjs')], { stdio: 'inherit' });
const Q = require('../data/qualification/qualification-2026.js');
const A = require('../data/qualification/adapter.js');
const ok = (cond, msg) => { assert.ok(cond, msg); console.log('  ✓ ' + msg); };

const zk = ['Zmarzlik', 'Woryna', 'Kubera', 'Pawlicki', 'Dudek', 'Janowski', 'Musielak', 'Cierniak'];
const sgp = new Set(['Zmarzlik', 'Kubera']);
const skip = (id, rule) => rule === 'sgpPermanent' && sgp.has(id);
const coach = n => ['Przyjemski', 'Zengota'].slice(0, n);
const gp = A.pathwaysFrom(Q, 'ZK').find(p => p.id === 'POL-ZK-SGPQ'), sec = A.pathwaysFrom(Q, 'ZK').find(p => p.id === 'POL-ZK-SECQ');
ok(A.applyPathway(gp, zk, { season: 2025, skip }).nominated.join() === 'Woryna,Pawlicki,Dudek', 'ZK → eliminacje GP: miejsca 1–3 z pominięciem stałych uczestników SGP');
const bf = Q.pathways.find(p => p.id === 'GBR-BF-GPWC');
ok(A.applyPathway(bf, ['Lambert', 'Wright', 'Flint'], { skip: (id, r) => r === 'sgpPermanent' && id === 'Lambert' }).nominated.join() === 'Wright', 'British Final → dzika karta GP: najwyżej sklasyfikowany spoza stałych uczestników SGP');
ok(A.applyPathway(bf, ['Flint', 'Lambert'], { skip: (id, r) => r === 'sgpPermanent' && id === 'Lambert' }).nominated.join() === 'Flint', 'British Final → dzika karta GP: mistrz spoza SGP dostaje kartę');
ok(!JSON.stringify(Q).includes('"status"') && !JSON.stringify(Q).includes('variants'), 'jedna obowiązująca wersja zasad (bez statusów i wariantów)');
const r = A.applyPathway(sec, zk, { season: 2025, skip, coachPick: coach });
ok(r.nominated.length === 6 && r.coachPicks.length === 2, 'ZK → eliminacje SEC: 6 z finału + 2 nominacje trenera');
ok(A.competition(Q, 'IMPE') === Q.competitions.IMP && A.stage(Q, 'IMPC').id === 'challenge', 'kody etapów z COMPS (IMPE, IMPC) wskazują reguły IMP');
ok(A.describeStage(Q, 'IMP', 'final').length === 6, 'opis obsady finału IMP: 6 kategorii uczestników');
ok(A.pathwaysTo(Q, 'SGP').length >= 3, 'ścieżki do cyklu SGP: TOP7, GP Challenge, mistrz Europy');
ok(A.ageOk(Q.competitions.EU19, '2008-05-01', 2026, '2026-06-01') && !A.ageOk(Q.competitions.EU19, '2006-05-01', 2026, '2026-06-01'), 'limit wieku IME U19 (rocznikowo)');
console.log('Test reguł kwalifikacji zakończony.');

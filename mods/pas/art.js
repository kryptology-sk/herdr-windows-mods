// Kresba pásovej výroby: robot z obdĺžnikov, krabica, výkričník a pohyblivý pás.
// Postup „robot z pár obdĺžnikov v absolútnych súradniciach, blikajúce svetlo cez loop
// opacity" je prevzatý z herdr-sit-and-watch (funny-it-worked-last-time-gsv, art.js: r()
// a bot(), licencia MIT). Tvar robota a pás sú vlastné.

import { div, svg, image } from "gpui-kit";

// Rozmery robota v základných jednotkách (mierka 1). Menší roboti sú ten istý robot v mierke.
export const ROBOT_W = 36;
export const ROBOT_H = 60;
export const KRABICA_W = 18;
const KRABICA_H = 15;

// Písmo pásu: neproporcionálne písmo, má priečky aj plné bloky v jednej šírke.
const PISMO_PASU = "Cascadia Mono";
// Vzory pásu majú spoločnú periódu, aby sa priečky a krabice posúvali spolu.
const PRIECKY = "|     |     ";
const KRABICE = "     ██     ";
const PERIODA = PRIECKY.length;
const KROK_PASU_MS = 140;
const POCET_NOH = 6;

// Zaokrúhli na pol pixela, aby sa tenké časti nerozmazali.
const r1 = (x) => Math.round(x * 2) / 2;

// Obdĺžnik na pevnom mieste v robotovi, súradnice v jednotkách robota prenásobené mierkou.
function obd(s, x, y, w, h, farba) {
  return div().absolute().left(r1(x * s)).top(r1(y * s)).w(r1(w * s)).h(r1(h * s)).bg(farba);
}

// Ikona programu z tabuľky aplikácie: jednofarebný glyf (svg) alebo obrázok (vzor icon() v agents-tree).
export function ikona(p, size, farba) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(farba) : image(p.icon).w(size).h(size).flex_none();
}

// Farba svetla na anténe: pracuje zelená, čaká červená, hotovo farba témy pre hotovo.
export function farbaSvetla(stav, t) {
  if (stav === "working") return t.ansi2;
  if (stav === "blocked") return t.ansi1;
  if (stav === "done") return t.done;
  return t.idle ?? t.dim;
}

export const rozmerRobota = (s) => ({ w: r1(ROBOT_W * s), h: r1(ROBOT_H * s) });

// Svetlo na anténe; pri práci a čakaní bliká (natívny loop, potrebuje stabilné id).
function svetlo(id, s, stav, t) {
  const el = obd(s, 14, 0, 8, 8, farbaSvetla(stav, t)).rounded(r1(4 * s));
  if (stav === "working") return el.id(`${id}-sv`).loop("opacity", { from: 0.35, to: 1, period: 700 });
  if (stav === "blocked") return el.id(`${id}-sv`).loop("opacity", { from: 0.3, to: 1, period: 1000 });
  return el;
}

// Ruky: pri práci sa striedavo dvíhajú, akoby robot prekladal veci na páse.
// `z` je zoom aplikácie: hodnoty loop() pre polohu zoom nenásobí, ostatné rozmery áno.
function ruky(id, s, stav, telo, z) {
  const hore = r1(25 * s) * z, dole = r1(29 * s) * z;
  const ruka = (x, strana, od, po) => {
    const el = obd(s, x, 29, 4, 15, telo).rounded(r1(2 * s));
    return stav === "working" ? el.id(`${id}-${strana}`).loop("top", { from: od, to: po, period: 600 }) : el;
  };
  return [ruka(0, "rl", dole, hore), ruka(32, "rp", hore, dole)];
}

// Oko vo hľadí: pri práci prechádza zľava doprava, inak stojí v strede.
function oko(id, s, stav, t, z) {
  const farba = stav === "working" ? t.ansi2 : stav === "blocked" ? t.ansi1 : t.dim;
  const el = obd(s, 16, 17, 4, 4, farba).rounded(r1(2 * s));
  return stav === "working" ? el.id(`${id}-oko`).loop("left", { from: r1(12 * s) * z, to: r1(20 * s) * z, period: 1400 }) : el;
}

// Robot bez polohy: volajúci ho umiestni cez absolute/left/top. `plny`: s rukami a okom
// (hlavný agent a pracovník hc run), inak zjednodušený (subagent, príkaz na pozadí).
// `z`: zoom aplikácie pre hodnoty loop().
export function robot({ id, s, stav, program, t, plny, z = 1 }) {
  const telo = t.muted;
  const { w, h } = rozmerRobota(s);
  const znak = ikona(program, r1(12 * s), t.foreground);
  const casti = [
    obd(s, 10, 50, 6, 10, telo).rounded(1),
    obd(s, 20, 50, 6, 10, telo).rounded(1),
    obd(s, 5, 27, 26, 23, telo).rounded(r1(5 * s)),
  ];
  if (znak) casti.push(obd(s, 10, 30, 16, 16, t.background).rounded(r1(3 * s)), znak.absolute().left(r1(12 * s)).top(r1(32 * s)));
  if (plny) casti.push(...ruky(id, s, stav, telo, z));
  casti.push(obd(s, 8, 12, 20, 14, telo).rounded(r1(4 * s)), obd(s, 11, 16, 14, 6, t.background).rounded(r1(2 * s)));
  if (plny) casti.push(oko(id, s, stav, t, z));
  casti.push(obd(s, 17, 7, 2, 6, telo), svetlo(id, s, stav, t));
  return div().w(w).h(h).children(casti);
}

// Červený výkričník nad robotom, ktorý čaká na človeka; pulzuje.
export function vykricnik(id, x, y, t) {
  return div().id(`${id}-vk`).absolute().left(x).top(y).w(13).h(15).rounded(4).bg(t.ansi1)
    .flex().items_center().justify_center().text_size(11).font_bold().text_color(t.background).child("!")
    .loop("opacity", { from: 0.45, to: 1, period: 900 });
}

// Hotová krabica pri robotovi vo Výstupe: kartón s páskou.
export function krabica(x, podlaha, t) {
  return div().absolute().left(x).top(podlaha - KRABICA_H).w(KRABICA_W).h(KRABICA_H).rounded(2).bg(t.ansi3)
    .border_1().border_color(t.input)
    .child(div().absolute().left(6).top(0).w(4).h(KRABICA_H - 2).bg(t.background).opacity(0.55));
}

// Riadok vzoru posunutý o `posun` znakov doprava.
function riadok(vzor, znakov, posun) {
  let out = "";
  for (let i = 0; i < znakov; i++) out += vzor[(((i - posun) % PERIODA) + PERIODA) % PERIODA];
  return out;
}

// Text vzoru; keď pás ide, frames() strieda posunuté riadky natívne, bez časovača v skripte.
// loop() by kýval tam a späť, pás má ísť len jedným smerom (k Výstupu).
function textPasu(id, vzor, znakov, ide, farba) {
  const el = div().absolute().left(0).top(-3).whitespace_nowrap().font_family(PISMO_PASU).text_size(11).text_color(farba);
  if (!ide) return el.child(riadok(vzor, znakov, 0));
  const snimky = Array.from({ length: PERIODA }, (_, k) => riadok(vzor, znakov, k));
  return el.id(`${id}-${znakov}`).child(snimky[0]).frames(snimky, KROK_PASU_MS);
}

// Pás v strednej zóne: krabice na ňom, telo s priečkami a nohy k podlahe. `posun` je
// prechod pre zmenu polohy a šírky pri zmene zón.
export function pas({ x, y, w, podlaha, ide, t, posun }) {
  const znakov = Math.ceil(w / 5 / 20) * 20 + PERIODA;
  const sirka = Math.max(0, w);
  const krabice = div().id("pas-krabice").absolute().left(x).top(y - 12).w(sirka).h(12).overflow_hidden()
    .transition("left", posun).transition("width", posun)
    .child(textPasu("pas-krabice-t", KRABICE, znakov, ide, t.ansi3));
  const telo = div().id("pas-telo").absolute().left(x).top(y).w(sirka).h(10).rounded(5).overflow_hidden()
    .bg(t.raised).border_1().border_color(t.input)
    .transition("left", posun).transition("width", posun)
    .child(textPasu("pas-priecky-t", PRIECKY, znakov, ide, t.dim));
  // Pevný počet nôh: pri zmene šírky sa všetky posunú, žiadna nevyskočí nová.
  const nohy = Array.from({ length: POCET_NOH }, (_, i) => {
    const nx = x + 14 + (i * (w - 31)) / (POCET_NOH - 1);
    return div().id(`pas-noha-${i}`).absolute().left(Math.round(nx)).top(y + 10).w(3).h(Math.max(0, podlaha - y - 10)).bg(t.input)
      .transition("left", posun);
  });
  return [...nohy, krabice, telo];
}

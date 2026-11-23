// Pás — pásová výroba. Vodorovný pás cez celú šírku s tromi zónami zľava doprava:
// Depo (agenti nečinní), Pás (pracujú alebo čakajú na človeka) a Výstup (hotovo).
// Každý bežiaci agent je robot s ikonou programu na hrudi, jeho subagenti a príkazy
// na pozadí (záznamy `records` z terminals()) sú menší roboti pri ňom a pracovníci
// spustení cez `hc run` (terminál s `parent`) sú stredne veľkí roboti pri rodičovi.
// Len číta živé dáta Herdru, nič nespúšťa, nečíta súbory ani nezapisuje.
// props.demo = true v rozložení kreslí pevnú vymyslenú zostavu na overenie kresby.
//
// Plynulý presun robota do novej zóny: stabilné id prvku na agenta, kreslenie v pevnom
// poradí a transition("left") — postup z herdr-control-tower (lcalmsky, mod tower,
// licencia MIT). Zber subagentov a pracovníkov podľa records() v mode agents-tree.

import { View, div } from "gpui-kit";
import { agents, terminals, spaces, focused, run, theme, props, checking } from "herdr";
import { ROBOT_W, ROBOT_H, KRABICA_W, robot, rozmerRobota, vykricnik, krabica, pas } from "./art.js";

// Rozvrh scény v pixeloch karty (od jej horného ľavého rohu).
const OKRAJ = 8;
const NADPIS_Y = 6;
const PAS_Y = 78;
const PODLAHA = 108;
const MENO_W = 84;
const ROBOT_X = (MENO_W - ROBOT_W) / 2;
const ZONA_OKRAJ = 12;
const MIN_MEDZERA = 10;
const MAX_MEDZERA = 48;
const PLUS_W = 22;
const POSUN = { duration: 1000, easing: "ease-in-out" };

// Najviac pomocníkov pri jednom robotovi, potom „+N", a rozpočet prvkov na celú scénu.
const MAX_POMOCNIKOV = 6;
const ROZPOCET_PRVKOV = 250;
const PRVKY = { zaklad: 32, hlavny: 18, pracovnik: 14, maly: 10, malyBezIkony: 8, plus: 1 };

const MIERKA = { pracovnik: 0.8, subagent: 0.6, prikaz: 0.6 };
const ZONY = [
  { id: "depo", nazov: "Depo" },
  { id: "pas", nazov: "Pás" },
  { id: "vystup", nazov: "Výstup" },
];
const ZONA_STAVU = { idle: "depo", working: "pas", blocked: "pas", done: "vystup" };
const STAV_TEXT = { idle: "nečinný", working: "pracuje", blocked: "čaká na teba", done: "hotovo" };

// Subagent Claude Code má takéto id (ako SUBAGENT v agents-tree), príkaz na pozadí kratšie.
const SUBAGENT = /^a[0-9a-f]{12,}$/;

const obmedz = (x, od, po) => Math.max(od, Math.min(po, x));
const stavText = (s) => STAV_TEXT[s] ?? s ?? "neznámy";

// ---- živé dáta ---------------------------------------------------------------

// Stav pracovníka hc run: jeho riadok v agents(), inak holé slovo terminálu;
// chyba je čakanie na človeka, hotovo hlási rodičovi, takže stojí ako nečinný.
function stavPracovnika(k, uvedeni) {
  const s = uvedeni.get(k.address) ?? k.status;
  if (s === "error") return "blocked";
  return s === "working" || s === "blocked" ? s : "idle";
}

// Pracovníci spustení cez `hc run`: živé terminály s rodičom, zoskupení podľa adresy rodiča.
function pracovnici(vsetky, uvedeni) {
  const out = new Map();
  for (const k of vsetky) {
    if (!k.parent || k.state !== "live" || !uvedeni.has(k.parent)) continue;
    const popis = k.name || k.template || k.program?.name || k.address;
    const p = { id: k.address, druh: "pracovnik", stav: stavPracovnika(k, uvedeni), program: k.program, popis };
    out.set(k.parent, [...(out.get(k.parent) ?? []), p]);
  }
  return out;
}

// Záznamy agenta (subagenti a príkazy na pozadí), ktoré práve pracujú alebo čakajú.
function zaznamy(term, program) {
  if (term?.state !== "live" || !term.records || typeof term.records !== "object") return [];
  return Object.entries(term.records)
    .filter(([, r]) => r?.state === "working" || r?.state === "blocked")
    .map(([id, r]) => {
      const subagent = SUBAGENT.test(id);
      return { id: `${term.address}#${id}`, druh: subagent ? "subagent" : "prikaz", stav: r.state, program: subagent ? program : null, popis: r.title || id };
    });
}

// Krátky názov pod robotom: pomenovaná karta, inak priestor.
function kratkeMeno(a, karty) {
  const karta = karty.get(a.tab);
  if (karta?.named && karta.name) return karta.name;
  return a.space_name || a.tab_name || a.program?.name || a.address;
}

// Agenti ako skupiny robotov. Pracovník hc run, ktorý má aj vlastný panel, stojí len pri rodičovi.
function zivaZostava() {
  const zoznam = agents();
  const vsetky = terminals();
  const uvedeni = new Map(zoznam.map((a) => [a.address, a.status]));
  const terminal = new Map(vsetky.map((k) => [k.address, k]));
  const podRodicom = pracovnici(vsetky, uvedeni);
  const vnoreni = new Set([...podRodicom.values()].flat().map((p) => p.id));
  const karty = new Map(spaces().flatMap((s) => s.tabs).map((k) => [k.id, k]));
  const f = focused();
  return zoznam.filter((a) => !vnoreni.has(a.address)).map((a) => {
    const meno = kratkeMeno(a, karty);
    return {
      id: a.address,
      pane: a.pane,
      stav: a.status,
      program: a.program,
      meno,
      plne: [meno, a.space_name !== meno ? a.space_name : null, a.program?.name].filter(Boolean).join(" · "),
      fokus: a.focused || f?.terminal === a.address,
      pomocnici: [...(podRodicom.get(a.address) ?? []), ...zaznamy(terminal.get(a.address), a.program)],
    };
  });
}

// ---- ukážkový režim ----------------------------------------------------------

const PROGRAMY = {
  claude: { key: "claude", name: "Claude Code", icon: "icons/claude.svg", tint: false },
  codex: { key: "codex", name: "Codex", icon: "icons/codex.svg", tint: false },
  agy: { key: "antigravity", name: "Antigravity", icon: "icons/antigravity.svg", tint: false },
};

const subagent = (id, stav, popis) => ({ id, druh: "subagent", stav, program: PROGRAMY.claude, popis });
const prikaz = (id, popis) => ({ id, druh: "prikaz", stav: "working", program: null, popis });

// Pevná vymyslená zostava: všetky stavy, robot s tromi subagentmi, príkazom na pozadí
// a pracovníkom hc run, a robot so siedmimi záznamami (ukáže šesť a „+1").
function ukazkovaZostava() {
  const g = (id, meno, stav, program, pomocnici = []) => ({ id, pane: null, stav, program, meno, plne: `${meno} · ${program.name}`, fokus: false, pomocnici });
  return [
    g("u1", "web", "idle", PROGRAMY.claude),
    g("u2", "api", "working", PROGRAMY.claude, [
      { id: "u2-hc", druh: "pracovnik", stav: "working", program: PROGRAMY.codex, popis: "codex exec — review diffu" },
      subagent("u2#a1b2c3d4e5f6a7b8", "working", "Prehľadá testy"),
      subagent("u2#a2b3c4d5e6f7a8b9", "working", "Skontroluje migrácie"),
      subagent("u2#a3b4c5d6e7f8a9b0", "blocked", "Overí API kľúče"),
      prikaz("u2#b1x", "npm run build"),
    ]),
    g("u3", "dokumentacia", "working", PROGRAMY.codex),
    g("u4", "testy", "blocked", PROGRAMY.agy),
    g("u5", "analyza", "working", PROGRAMY.claude, [
      subagent("u5#a4b5c6d7e8f9a0b1", "working", "Inventár súborov"),
      subagent("u5#a5b6c7d8e9f0a1b2", "working", "Mŕtve odkazy"),
      subagent("u5#a6b7c8d9e0f1a2b3", "working", "Siroty"),
      prikaz("u5#b2x", "pytest -q"),
      prikaz("u5#b3x", "git log --stat"),
      prikaz("u5#b4x", "python audit.py"),
      prikaz("u5#b5x", "rg TODO"),
    ]),
    g("u6", "import", "done", PROGRAMY.claude),
  ];
}

// ---- rozvrh ------------------------------------------------------------------

const sirkaPomocnika = (p) => rozmerRobota(MIERKA[p.druh] ?? 0.6).w;

// Polohy pomocníkov v skupine (od ľavého okraja skupiny) a koniec obsadeného miesta.
function polohyPomocnikov(g, strop) {
  let x = ROBOT_X + ROBOT_W + 4;
  if (g.stav === "done") x += KRABICA_W + 6;
  const polohy = g.pomocnici.slice(0, strop).map((p) => {
    const poloha = { p, x, s: MIERKA[p.druh] ?? 0.6 };
    x += sirkaPomocnika(p) + 3;
    return poloha;
  });
  const navyse = g.pomocnici.length - polohy.length;
  const plusX = navyse > 0 ? x : null;
  if (navyse > 0) x += PLUS_W;
  return { polohy, navyse, plusX, koniec: x };
}

const sirkaSkupiny = (g, strop) => Math.max(MENO_W, polohyPomocnikov(g, strop).koniec);

// Odhad počtu prvkov scény pri danom strope pomocníkov na robota.
function odhadPrvkov(skupiny, strop) {
  let n = PRVKY.zaklad;
  for (const g of skupiny) {
    n += PRVKY.hlavny;
    for (const p of g.pomocnici.slice(0, strop)) n += p.druh === "pracovnik" ? PRVKY.pracovnik : p.program ? PRVKY.maly : PRVKY.malyBezIkony;
    if (g.pomocnici.length > strop) n += PRVKY.plus;
  }
  return n;
}

// Najvyšší strop pomocníkov (6, 4, 2, 0), pri ktorom sa scéna zmestí do rozpočtu prvkov.
function stropPomocnikov(skupiny) {
  for (const strop of [MAX_POMOCNIKOV, 4, 2]) if (odhadPrvkov(skupiny, strop) <= ROZPOCET_PRVKOV) return strop;
  return 0;
}

// Skupiny v zóne vycentrované s medzerou; keď sa nezmestia, medzera sa zmenší, až sa prekrývajú.
function rozmiestni(skupiny, sirky, zona, polohy) {
  const n = skupiny.length;
  if (!n) return;
  const vnutro = zona.w - 2 * ZONA_OKRAJ;
  const spolu = skupiny.reduce((s, g) => s + sirky.get(g.id), 0);
  const medzera = n > 1 ? Math.min(MAX_MEDZERA, (vnutro - spolu) / (n - 1)) : 0;
  let x = zona.x + ZONA_OKRAJ + Math.max(0, (vnutro - spolu - medzera * (n - 1)) / 2);
  for (const g of skupiny) {
    polohy.set(g.id, Math.round(x));
    x += sirky.get(g.id) + medzera;
  }
}

// Šírky zón: Depo a Výstup podľa potreby v medziach, Pás dostane zvyšok (vždy najširší).
function naplanuj(skupiny, sirka) {
  const strop = stropPomocnikov(skupiny);
  const sirky = new Map(skupiny.map((g) => [g.id, sirkaSkupiny(g, strop)]));
  const vZone = { depo: [], pas: [], vystup: [] };
  for (const g of skupiny) vZone[ZONA_STAVU[g.stav] ?? "depo"].push(g);
  const potreba = (z) => vZone[z].reduce((s, g) => s + sirky.get(g.id), 0) + MIN_MEDZERA * Math.max(0, vZone[z].length - 1) + 2 * ZONA_OKRAJ;
  const d = Math.round(obmedz(potreba("depo"), 0.17 * sirka, 0.3 * sirka));
  const v = Math.round(obmedz(potreba("vystup"), 0.14 * sirka, 0.3 * sirka));
  const zony = { depo: { x: 0, w: d }, pas: { x: d, w: sirka - d - v }, vystup: { x: sirka - v, w: v } };
  const polohy = new Map();
  for (const z of ZONY) rozmiestni(vZone[z.id], sirky, zony[z.id], polohy);
  const pocty = Object.fromEntries(ZONY.map((z) => [z.id, vZone[z.id].length]));
  return { strop, sirky, zony, polohy, pocty };
}

// ---- kresba ------------------------------------------------------------------

// Malý alebo stredný robot pri hlavnom. Pri práci poskakuje (loop top), pri čakaní má výkričník.
// `k`: { t: farby témy, demo, z: zoom aplikácie pre hodnoty loop() }.
function pomocnik(rodic, { p, x, s }, k) {
  const { t, demo, z } = k;
  const { w, h } = rozmerRobota(s);
  const y = PODLAHA - h;
  const plny = p.druh === "pracovnik";
  const id = `h-${p.id}`;
  let el = robot({ id, s, stav: p.stav, program: p.program, t, plny, z })
    .id(id).absolute().left(x).top(y).cursor_pointer()
    .transition("left", POSUN)
    .tooltip(`${p.popis} · ${stavText(p.stav)}`);
  if (p.stav === "working" && !plny) el = el.loop("top", { from: y * z, to: (y - 2) * z, period: 500 });
  if (p.stav === "blocked") el = el.child(vykricnik(id, w - 4, -14, t));
  if (demo) return el;
  // Pracovník hc run sa otvorí v náhľade, subagent a príkaz zameria panel rodiča.
  return el.on_click(() => (plny ? run("terminal.peek", { terminal: p.id }) : run("pane.focus", { pane: rodic.pane })));
}

// Meno pod hlavným robotom, orezané na šírku menovky.
function menovka(g, t) {
  return div().absolute().left(0).top(PODLAHA + 3).w(MENO_W).h(15).flex().justify_center()
    .child(div().min_w(0).truncate().text_size(11)
      .text_color(g.fokus ? t.foreground : t.muted)
      .when(g.fokus, (el) => el.font_semibold())
      .child(g.meno));
}

// Hlavný robot agenta: nečinný je tlmený, čakajúci má výkričník, hotový stojí pri krabici.
function hlavnyRobot(g, { t, demo, z }) {
  const id = `r-${g.id}`;
  const el = robot({ id, s: 1, stav: g.stav, program: g.program, t, plny: true, z })
    .id(id).absolute().left(ROBOT_X).top(PODLAHA - ROBOT_H).cursor_pointer()
    .opacity(g.stav === "idle" ? 0.45 : 1).transition("opacity", 400)
    .tooltip(`${g.plne} · ${stavText(g.stav)}`)
    .when(g.stav === "blocked", (el) => el.child(vykricnik(id, ROBOT_W - 6, -14, t)));
  return demo ? el : el.on_click(() => run("pane.focus", { pane: g.pane }));
}

// Celá skupina agenta: posúva sa ako celok, keď agent prejde do inej zóny.
function skupina(g, plan, k) {
  const { t } = k;
  const { polohy, navyse, plusX } = polohyPomocnikov(g, plan.strop);
  return div().id(`g-${g.id}`).absolute().left(plan.polohy.get(g.id) ?? 0).top(0)
    .w(plan.sirky.get(g.id)).h(PODLAHA + 20)
    .transition("left", POSUN)
    .when(g.stav === "done", (el) => el.child(krabica(ROBOT_X + ROBOT_W + 4, PODLAHA, t)))
    .children(polohy.map((poloha) => pomocnik(g, poloha, k)))
    .child(hlavnyRobot(g, k))
    .when(navyse > 0, (el) => el.child(div().absolute().left(plusX).top(PODLAHA - 16).text_size(11).text_color(t.dim).child(`+${navyse}`)))
    .child(menovka(g, t));
}

// „1 agent", „3 agenti", „5 agentov".
function pocetAgentov(n) {
  if (n === 1) return "1 agent";
  return n >= 2 && n <= 4 ? `${n} agenti` : `${n} agentov`;
}

// Nadpis zóny s počtom robotov, napríklad „Depo · 3 agenti".
function nadpisZony(z, plan, t) {
  return div().id(`nadpis-${z.id}`).absolute().left(plan.zony[z.id].x + ZONA_OKRAJ).top(NADPIS_Y)
    .transition("left", POSUN)
    .flex().gap(5).items_center().text_size(10.5)
    .child(div().font_semibold().text_color(t.dim).child(z.nazov))
    .when(plan.pocty[z.id] > 0, (el) => el.child(div().text_color(t.muted).child(`· ${pocetAgentov(plan.pocty[z.id])}`)));
}

// Zvislá deliaca čiara medzi zónami.
const hranica = (id, x, t) => div().id(id).absolute().left(x).top(NADPIS_Y).w(1).h(PODLAHA - NADPIS_Y + 18).bg(t.border).transition("left", POSUN);

function scena(skupiny, sirka, k) {
  const { t } = k;
  const plan = naplanuj(skupiny, sirka);
  const pasZona = plan.zony.pas;
  const ide = skupiny.some((g) => g.stav === "working");
  // Skupiny v pevnom poradí podľa id, aby si každá držala svoj prvok a posúvala sa.
  const poradie = [...skupiny].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [
    div().absolute().left(0).right(0).top(PODLAHA).h(1).bg(t.border),
    hranica("hranica-1", plan.zony.pas.x, t),
    hranica("hranica-2", plan.zony.vystup.x, t),
    ...ZONY.map((z) => nadpisZony(z, plan, t)),
    ...pas({ x: pasZona.x + ZONA_OKRAJ, y: PAS_Y, w: pasZona.w - 2 * ZONA_OKRAJ, podlaha: PODLAHA, ide, t, posun: POSUN }),
    ...poradie.map((g) => skupina(g, plan, k)),
    ...(skupiny.length ? [] : [div().absolute().left(0).w(plan.zony.depo.w).top(PODLAHA - 40)
      .flex().justify_center().text_size(12).text_color(t.dim).child("žiadni agenti")]),
  ];
}

// Šírka meradla zoomu v jednotkách rozloženia.
const MERADLO_W = 100;

export default class Pas extends View {
  init() {
    this.demo = props()?.demo === true;
    // Šírka koreňa a zoom, ako ich hlási on_size_change (v pixeloch už prenásobených zoomom).
    this.sirka = null;
    this.zoom = null;
  }

  // Prekreslí sa len pri skutočnej zmene hodnoty.
  nastav(kluc, hodnota, cx) {
    if (hodnota === this[kluc]) return;
    this[kluc] = hodnota;
    cx.notify();
  }

  // Meradlo: on_size_change hlási rozmery prenásobené zoomom aplikácie, ale .w() a .left()
  // zoom násobia samy. Neviditeľný prvok so šírkou MERADLO_W prezradí zoom bez settings().
  meradlo() {
    return div().id("pas-meradlo").absolute().left(0).top(0).w(MERADLO_W).h(1)
      .on_size_change((size, cx) => this.nastav("zoom", Math.round((size.width / MERADLO_W) * 100) / 100, cx));
  }

  render() {
    const t = theme();
    // Pri `herdr-app check` rozmery neprídu, scéna sa vykreslí pre 1000 px pri zoome 1.
    const sirka = this.sirka ?? (checking() ? 1000 : null);
    const zoom = this.zoom ?? (checking() ? 1 : null);
    const karta = div().id("pas-karta").size_full().relative().rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground)
      .child(this.meradlo());
    if (sirka == null || !zoom) return this.koren(karta);
    const vnutro = Math.floor(sirka / zoom) - 2 * OKRAJ - 2;
    const skupiny = this.demo ? ukazkovaZostava() : zivaZostava();
    return this.koren(karta.children(scena(skupiny, vnutro, { t, demo: this.demo, z: zoom })));
  }

  koren(karta) {
    return div().id("pas").size_full().px(OKRAJ).pt(OKRAJ)
      .on_size_change((size, cx) => this.nastav("sirka", Math.round(size.width), cx))
      .child(karta);
  }
}

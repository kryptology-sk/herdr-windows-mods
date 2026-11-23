# Roadmapa

Checklist funkcií projektu — čo je hotové a čo čaká. Bez dátumov (históriu drží git). Súbor je verejný — žiadne interné dohody. Detail rozpracovaných vecí je v CURRENT.md, zadanie v SPEC.md.

## Mody a rozloženia

- [x] `agents-tree` — subagenti Claude Code a príkazy na pozadí ako riadky pod agentom
- [x] `agents-tree` — vnorený subagent pod svojím rodičom na Windows
- [x] `limity` — čerpanie predplatného Claude, Codexu a agy s časom obnovy
- [x] `limity` — obnova čerpania Claude počas práce ktoréhokoľvek agenta
- [x] `limity` — hodinové čítanie čerpania Codexu a agy bez volania modelu
- [x] `historia` — minulé rozhovory Claude Code, Codexu a agy pre aktuálny priečinok
- [x] `historia` — hľadanie v názvoch a prepínač „všade"
- [x] `pas` — pásová výroba na predvádzanie
- [x] `panely` — horná lišta s tlačidlami Limity a História
- [x] rozloženia `vychytavky` a `pasova-vyroba`
- [ ] `pas` overený v tmavej téme
- [ ] `pas` overený s pracovníkmi `hc run`

## Inštalácia

- [x] `instalacia.ps1` kopíruje mody a rozloženia a nič neprepíše
- [x] odinštalovanie s výpisom nanečisto
- [x] odinštalovanie nechá na mieste mod a rozloženie, ktoré sa líšia od balíčka
- [ ] správy inštalátora po anglicky
- [ ] inštalácia overená na cudzom počítači
- [ ] inštalácia overená na čistom Windows 10
- [ ] inštalácia overená pri mene používateľa s medzerou

## Dokumentácia a licencie

- [x] README s tabuľkou, čo ktorý kus číta, spúšťa a zapisuje
- [x] POVOD.md s pôvodom cudzieho kódu
- [x] licencia Apache-2.0, súbory LICENSE a NOTICE
- [x] doložený pôvod časti zo žiadosti o zlúčenie #1212
- [x] README v angličtine, slovenské ako `README.sk.md`
- [x] pôvod kódu po anglicky (`ORIGIN.md`) aj po slovensky (`POVOD.md`)
- [x] poznámka o úprave na začiatku odvodených súborov `agents-tree` a `panely`
- [ ] texty v paneloch po anglicky aj po slovensky

## Zverejnenie

- [ ] verejný repozitár na GitHube
- [ ] kontrola súborov a snímok na osobné údaje pred prvým commitom

## Galéria Herdru

- [ ] `RECIPE.md` pre rozloženie `pasova-vyroba`
- [ ] `preview.png` s ukážkovými údajmi
- [ ] priečinky podľa pravidiel galérie
- [ ] téma repozitára `herdr-layout`

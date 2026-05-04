# 🧛 Game Design Document — Vampire Survivors Clone

## Spielkonzept

**Endless Survivor** — ein Auto-Attack Survival Game inspiriert von Vampire Survivors.

Der Spieler bewegt sich durch eine dunkle Fantasy-Welt, während Waffen automatisch auf nahende Gegner feuern. Getötete Gegner hinterlassen XP-Orbs, die der Spieler einsammelt. Bei jedem Level-Up wählt der Spieler aus zufälligen Upgrades (neue Waffen, Stat-Boosts, Passives).

**Kein manueller Angriff.** Nur Bewegung und Upgrade-Entscheidungen.

---

## Kern-Loop

```
Bewegen → Gegner töten → XP sammeln → Level-Up → Upgrade wählen → Wiederholen
```

- **Bewegen:** Spieler steuert Charakter per Touch-Joystick (mobil) oder WASD/Tastatur (Desktop)
- **Auto-Attack:** Waffen feuern automatisch auf Gegner in Reichweite
- **XP:** Gegner droppen XP-Orbs, Magnet-Range zieht sie zum Spieler
- **Level-Up:** 3 Upgrade-Optionen erscheinen, Spieler wählt eine
- **Upgrade-Typen:** Neue Waffe, Waffe verbessern, Stat-Boost (Speed, HP, Damage, Pickup-Range)
- **Chests:** Alle 60s spawnen Schätze mit Power-Ups

---

## Visueller Stil

**Dark Fantasy, minimalistisch.**

- Geometrische Shapes + Farben (keine komplexen Sprites nötig)
- 4 Biome-Zonen mit Farbwechsel: Graveyard, Dark Forest, Blood Moor, Catacombs
- Dekorative Elemente (Grabsteine, Bäume, Blutsümpfe, Säulen) für Atmosphäre
- Partikeleffekte für Treffer, XP-Sammeln, Level-Up
- Dunkles Farbschema mit leuchtenden Akzenten (XP-Orbs, Waffen-Effekte)

---

## Zielgruppe

- **Casual Gamer** — kurze Sessions (5–30 Minuten)
- **"Eine Runde schnell"-Mentalität** — perfekt für den Bus, die Pause, die Toilette 😄
- Mobile-First, Desktop sekundär
- Kostenlos spielbar (Ads oder Premium kosmetisch)

---

## Balance-Philosophie

### Difficulty Curve
1. **Minuten 0–2:** Sehr leicht — wenige, langsame Gegner (Bats, Slimes). Spieler lernt Steuerung.
2. **Minuten 2–5:** Warm werden — Skeletons dazu, Spawn-Rate steigt leicht.
3. **Minuten 5–10:** Erste echte Herausforderung — Zombies, mehr Gegner, HP steigt.
4. **Minuten 10–20:** Mid-Game Pressure — Ghosts, Spiders, Demons. Spieler braucht Upgrades.
5. **Minuten 20–30:** Endgame — Golems, relentless Spawns. Nur gut gebaute Builds überleben.

### Scaling
- Gegner-HP: +8% pro Minute
- Gegner-Speed: +4% pro Minute
- Spawn-Rate: +12% pro Minute
- Spieler skaliert durch Upgrades (exponentieller) vs. Gegner (linear) → guter Build gewinnt

### Waffen-Design
- Starter-Waffe: schwach aber zuverlässig
- 6–8 Waffen gesamt (Projektile, AoE, Orbit, Dash, etc.)
- Evolutions: Kombination bestimmter Waffen + Passiv → mächtige Ultimate-Version

---

## Technische Specs

| Feature | Wert |
|---|---|
| Engine | HTML5 Canvas |
| Map-Größe | 4000×4000 Pixel |
| Max Gegner | 150 |
| Target FPS | 60 |
| Game-Dauer | ~30 Minuten |
| Steuerung | Touch-Joystick + WASD |
| Plattform | Mobile (primär), Desktop (sekundär) |

---

## Datei-Referenzen

| Datei | Inhalt |
|---|---|
| `src/data/gameConfig.js` | Zentrale Konstanten (Spawn, XP, Player, Camera, World) |
| `src/data/levelProgression.js` | Gegner-Typen über Zeit, Difficulty-Scaler, Enemy-Stats |
| `src/data/biomeDesign.js` | 4 Biome-Zonen, Decoration-Typen, Biome-Enemy-Affinität |

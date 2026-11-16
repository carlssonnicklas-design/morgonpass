# Morgonpass

En personlig träningsapp (PWA) för morgonpass på 20–30 minuter i militär kalistenik.

- **Struktur:** uppvärmning (PRT Preparation Drill) → cirkelpass med arbete/vila → stretchning (PRT Recovery Drill).
- **Röstcoach** på svenska (telefonens talsyntes): annonserar övningar, "byt sida", "tio sekunder kvar" och nedräkning.
- **Progress:** stapel för hela passet och för det aktuella momentet.
- **Animerad tränare** för varje övning (84 övningar, 60 rörelseanimationer).
- **Veckoplan:** på måndagen väljer du fokusområden. Passen varieras över veckan för helkroppsträning.
- **Claude** (valfritt): planerar veckan utifrån fokus och historik, och analyserar dina framsteg. Utan Claude används en inbyggd regelmotor.

## Köra lokalt

```bash
node tools/serve.mjs 8765
```

Öppna http://localhost:8765. `tools/gallery.html` visar alla animationer.

## Installera på telefonen

Appen måste ligga på en https-adress (t.ex. GitHub Pages). Öppna adressen i telefonen:

- **iPhone (Safari):** Dela → Lägg till på hemskärmen.
- **Android (Chrome):** meny → Installera app.

## Claude-nyckeln

Skapa en API-nyckel på console.anthropic.com och klistra in den under Inställningar. Nyckeln sparas bara i telefonens lokala lagring och skickas direkt till Anthropic. Lägg aldrig in den i koden.

## Uppdatera Claude-biblioteket

```bash
npm install
npx esbuild tools/sdk-entry.js --bundle --format=esm --platform=browser --minify --outfile=vendor/anthropic.js
```

## Filer

| Fil | Innehåll |
|---|---|
| `js/exercises.js` | Övningsbiblioteket |
| `js/animations.js` | Tränarfiguren (SVG-poser och animationer) |
| `js/planner.js` | Regelmotor: veckoteman, val av övningar, tidsanpassning, tidslinje |
| `js/player.js` | Passpelaren: timer, röst, progress |
| `js/claude.js` | Veckoplanering och analys via Claude (structured outputs) |
| `js/app.js` | Gränssnittet |
| `sw.js` | Offlinestöd. Höj `VERSION` när filer ändras. |

Övningarna bygger på US Army Physical Readiness Training (FM 7-22) och klassiska kroppsviktsövningar.

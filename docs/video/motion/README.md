# Source du spot motion design EduLoc (15 s, 1920×1080, 60 i/s)

Animation HTML/SVG pilotée par `render(t)` (rendu déterministe image par image), bande son synthétisée en Python.
Charte : `CHART VISUEL.md` (violet #332E86, émeraude #0E9C82, Space Grotesk + Inter).

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'animation ; chronologie dans l'objet `T`, repères sonores dans `window.CUES` |
| `render.js` | Rend 900 images avec Playwright/Chromium, encode en H.264 via ffmpeg, écrit `cues.json` |
| `audio.py` | Synthèse de la bande son à partir de `cues.json` (numpy) |

```bash
node render.js video_silent.mp4          # génère aussi cues.json
python3 audio.py cues.json audio.wav
ffmpeg -i video_silent.mp4 -i audio.wav -af loudnorm=I=-14:TP=-1.5:LRA=7 -c:v copy -c:a aac -b:a 192k -shortest EduLoc_Motion_15s.mp4
```

Prérequis : Node 22 avec `playwright`, ffmpeg, Python 3 avec numpy, police Inter installée sur la machine de rendu.

Contenu à vérifier avant diffusion : noms de tuteurs, notes et lieux sont fictifs ; le paiement et la réservation affichés
doivent correspondre aux fonctionnalités réellement livrées (voir `../STORYBOARD-PRESENTATION.md` §7).

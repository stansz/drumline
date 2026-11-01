# DrumlineTD

A tower defense game where your defense plays the music.

## How to play

Choose **Easy** or **Hard** to start the audio clock. Enemies march along the path while
your instruments sit on a looping 16-step sequencer. Each column of the board is
one step: towers fire when the playhead reaches their column.

- **Kick** (50): heavy splash damage, fires once per bar.
- **Hat** (35): fast chip damage, fires four times per bar.
- **Synth** (70): long-range damage that chains to nearby enemies.

Towers that fire on the same step form a chord and deal bonus damage. Build,
then press **Start wave** to send wave 1. With **Auto** on, each later wave
starts 4 bars after the last one clears, which is 8 seconds at 120 BPM. Press
the button during the countdown to send the wave early, or turn **Auto** off to
start every wave yourself. Every leaked enemy costs lives; clear all 30 waves
before your lives run out to win. A boss arrives every 10 waves, and one that
gets through costs 20 lives. Select **Sell** and click a tower to refund 70% of
its cost.

| Mode | Lives | Starting money | Wave bonus | Enemy health |
| --- | --- | --- | --- | --- |
| Easy | 30 | $150 | $40 | 70% |
| Hard | 20 | $100 | $20 | 100% |

[docs/balance.md](docs/balance.md) explains how the difficulty curve works and how
to retune it.

Press **Theme** to switch between the Neon, Chiptune, Lo-fi, Techno, and Funk soundtracks at any time. Themes change the music and tower sounds, never the tempo or the game. [docs/themes.md](docs/themes.md) explains how to add a theme and match its volume.

## Controls

- **E** Easy or **H** Hard on the difficulty screen
- **1** Kick, **2** Hat, **3** Synth, **4** Sell
- Click a buildable cell to place the selected tower
- **Space** start the next wave, or send it early during the countdown
- **A** turn automatic waves on or off
- **F** change speed: 120, 180, or 240 BPM
- **M** mute or unmute
- **T** change the music theme
- **R** restart and choose a difficulty again

The on-screen buttons provide the same actions, and the slider beside the theme
button sets the volume. Your theme, volume, and **Auto** setting are remembered
between visits. Speed and mute reset when you start a new run.

## Commands

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run playtest -- --job tools/playtest/jobs/smoke.json --out playtest-out/smoke.jsonl
npm run playtest:report -- --in playtest-out/smoke.jsonl
npm run playtest:sweep -- --sweep tools/playtest/sweeps/boss-cap.json --out playtest-out/boss-cap
```

`npm run build` type-checks the project and writes a static site to `dist/`.
Pushing to `main` deploys that site to GitHub Pages through the included
workflow. [docs/references.md](docs/references.md) describes how the code fits
together.

## Credits

The Silkscreen and VT323 fonts are used under the SIL Open Font License. Their licenses are in `src/fonts/`.

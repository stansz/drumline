# Drumline

A tower defense game where your defense plays the music.

## How to play

Choose **Easy** or **Hard** to start the audio clock. Enemies march along the path while
your instruments sit on a looping 16-step sequencer. Each column of the board is
one step: towers fire when the playhead reaches their column.

- **Kick** (50): heavy splash damage, fires once per bar.
- **Hat** (35): fast chip damage, fires four times per bar.
- **Synth** (70): long-range damage that chains to nearby enemies.

Towers that fire on the same step form a chord and deal bonus damage. Build
before a wave, then press **Start wave**. Every leaked enemy costs lives; clear
all 30 waves before your lives run out to win. A boss arrives every 10 waves, and
one that gets through costs 20 lives. Select **Sell** and click a tower to refund
70% of its cost.

| Mode | Lives | Starting money | Wave bonus | Enemy health |
| --- | --- | --- | --- | --- |
| Easy | 30 | $150 | $40 | 70% |
| Hard | 20 | $100 | $20 | 100% |

[docs/balance.md](docs/balance.md) explains how the difficulty curve works and how
to retune it.

Press **Theme** to switch between the Neon, Chiptune, Lo-fi, Techno, and Funk soundtracks at any time. Themes change the music and tower sounds, never the tempo or the game.

## Controls

- **E** Easy or **H** Hard on the difficulty screen
- **1** Kick, **2** Hat, **3** Synth, **4** Sell
- Click a buildable cell to place the selected tower
- **Space** start the next wave
- **F** change speed: 120, 180, or 240 BPM
- **M** mute or unmute
- **T** change the music theme
- **R** restart and choose a difficulty again

The on-screen buttons provide the same actions.

## Commands

```sh
npm install
npm run dev
npm test
npm run build
```

`npm run build` type-checks the project and writes a static site to `dist/`.
Pushing to `main` deploys that site to GitHub Pages through the included
workflow.

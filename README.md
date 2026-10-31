# Drumline

A tower defense game where your defense plays the music.

## How to play

Click the overlay to start the audio clock. Enemies march along the path while
your instruments sit on a looping 16-step sequencer. Each column of the board is
one step: towers fire when the playhead reaches their column.

- **Kick** (50): heavy splash damage, fires once per bar.
- **Hat** (35): fast chip damage, fires four times per bar.
- **Synth** (70): long-range damage that chains to nearby enemies.

Towers that fire on the same step form a chord and deal bonus damage. Build
before a wave, then press **Start wave**. Every leaked enemy costs lives; clear
all five waves without losing all 20 lives to win. Select **Sell** and click a
tower to refund 70% of its cost.

## Controls

- **1** Kick, **2** Hat, **3** Synth, **4** Sell
- Click a buildable cell to place the selected tower
- **Space** start the next wave
- **F** toggle 2× speed
- **M** mute or unmute
- **R** restart

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

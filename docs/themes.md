# Music themes

Each theme is one entry in `src/themes.ts`. It sets the arrangement, tower sounds, space, and tone.
Themes never change the tempo, tower timing, or game balance.

## Keeping volume consistent

Neon is the loudness reference, stored in `tests/loudness-baseline.ts`. Every other theme has a
`space.trim` value that matches it, and Neon's trim stays at 1.

The target is an average within 1 dB of Neon across the test boards. Average level is measured,
not peak level, because short sounds can peak high and still sound quiet. The limiter also absorbs
part of any boost, so a trim of 2 adds less than 6 dB in practice.

The player's volume slider comes after the limiter and only turns the sound down, so it doesn't
change the mix. The loudness page renders at full volume and doesn't depend on the slider.

## Adding or changing a theme

1. Add or edit the theme in `src/themes.ts`, and add it to `THEMES`.
2. Run `npm test`.
3. Run `npm run dev` and open `/tests/loudness.html?theme=funk`, using the theme's `id`. This takes
   about 20 seconds.
4. Read `offsets` at the top of the results. It shows the theme's difference from Neon in dB.
5. If it's outside the target, set `space.trim` to the value in `suggestedTrims` and run the page
   again. The limiter's effect varies, so it may take a second try.

Open `/tests/loudness.html` with no theme to run every board and theme. This takes a few minutes
and also runs the worst-case Neon boards, so use it before a big audio change ships.

The page title shows `PASS` when nothing clips and the theme is within 1 dB of Neon. Otherwise it
shows `FAIL`.

If you change Neon or the shared audio chain, open `/tests/loudness.html?theme=neon` and copy its
`baseline` output into `tests/loudness-baseline.ts`.

If a theme needs a very high trim, its sounds are probably too short or thin. Lengthening its tower
decays will usually sound better than pushing the limiter harder.

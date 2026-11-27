# For You, Mimi

A small interactive scrapbook made for Mimi. The site combines a personal archive, public-domain artwork, photographs, music, a gallery, and a playful question page.

## Live site

- Main scrapbook: <https://nickle-creator.github.io/mi/>
- Interactive question page: <https://nickle-creator.github.io/mi/index.html>

## What is inside

- `home.html` — the main scrapbook experience with four sections: opening, story, reasons, and snapshots.
- `index.html` — the interactive “Are you Batman?” question page. The moving **No** button leads into the scrapbook.
- `ascii-jellyfish.js` and `ascii-jellyfish.css` — Jerry, the custom canvas-rendered ASCII moon jellyfish.
- `fish-school.js` — the small school of fish that can interact with Jerry.
- `site-polish.css` and `site-polish.js` — visual refinements, local parallax, the music control, and scroll polish.
- `fonts.css` and `fonts/` — self-hosted Instrument Serif and Inter font files. Keeping the fonts local avoids the extra Google Fonts connection while matching the intended design.
- `art/` — torn-paper textures, artwork cutouts, frames, grain, and collage elements.
- `ARTWORK-SOURCES.md` — artwork and public-domain source notes.

## Jerry the jellyfish

Jerry is not a static image. He is generated in the browser on a canvas using an ASCII character grid. His behavior includes:

- translucent bell shading, canals, gonad loops, oral arms, and trailing tentacles;
- cursor awareness, scrolling movement, clicks, and fish reactions;
- random tricks such as spins, flips, ripples, hearts, sparkles, and barrel rolls;
- a sleepy state after inactivity, including `Z` particles;
- night/paper theme color changes;
- reduced-motion support; and
- a short arrival introduction when the question page sends the visitor to the scrapbook.
- story-aware expressions: bright eyes, curiosity, sunglasses at “Real homie,” a wave, and a dreamy finale;
- section changes that wait for the reader to pause, so fast scrolling does not trigger a chain of tricks.

The jellyfish is decorative and is marked `aria-hidden` so it does not interrupt the main reading experience.

## Run locally

This is a static site and does not require a build step or package manager.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/home.html> for the scrapbook or <http://localhost:8000/index.html> for the question page.

Opening the files directly with `file://` may prevent some browser features from working consistently, so a local HTTP server is recommended.

## Performance notes

The main page lazy-loads most below-the-fold artwork and keeps Jerry’s animation at a modest canvas resolution. The typography is self-hosted as WOFF2 files, so the site no longer needs to contact Google Fonts. Music is loaded only when the visitor presses Play.

The site intentionally favors visual atmosphere over minimum payload size. The largest optional asset is `Dexys_Midnight_Runners.mp3`; it is not fetched until the music control is used.

## Accessibility and motion

The pages include semantic headings, button labels, focus-visible states, image alt text for personal photographs, keyboard-reachable controls, and `prefers-reduced-motion` handling. Decorative artwork and Jerry are hidden from assistive technology where they do not add information.

## Credits and artwork

Artwork captions appear throughout the scrapbook. The public-domain source and museum notes are collected in [`ARTWORK-SOURCES.md`](ARTWORK-SOURCES.md).

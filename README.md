# youaremisaligned

Source for [youaremisaligned.org](https://youaremisaligned.org) — an interactive web
experience. Best experienced without reading the source first. Enter through the
front door: [youaremisaligned.org](https://youaremisaligned.org).

## Development

Static site, no build step. Serve locally and open `index.html`:

```sh
python3 -m http.server 8000
```

- `shared.css` / `shared.js` — site-wide styles and behavior (loaded by every page)
- `style.css` / `main.js` — used by `game.html` only
- `images/` — scene artwork

Deployed via GitHub Pages (`CNAME` points the custom domain).

Markdown files other than this one are working notes and are deliberately not
committed — they spoil the experience.

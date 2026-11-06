Self-hosted webfonts for the HNFT PEPE site. All five families are licensed
under the SIL Open Font License 1.1 (texts beside this file).

  anton.woff2         Anton Regular            signage: the hub + collection menus
  asul-400.woff2      Asul Regular             titles: rooms, walls, card names
  dm-sans.woff2       DM Sans, variable 300-700 (optical size pinned at 14)
                                               all interface and body text
  dm-mono-400/500     DM Mono                  the two terminal rooms (FAKE, GAMES)
  jersey-10.woff2     Jersey 10 (pixel face)   the arcade (GAMES): the marquees,
                                               the plate and the console's names
                                               (Oct 18 2026; Basic Latin, Latin-1
                                               and general punctuation, 206 glyphs)

Each file is a subset: Basic Latin, Latin-1, a few Latin Extended letters,
general punctuation and (DM Sans, Anton) the arrows the interface uses. Built
with fontTools from the upstream TTFs in github.com/google/fonts:

  fonttools varLib.instancer "DMSans[opsz,wght].ttf" opsz=14 wght=300:700
  pyftsubset <ttf> --flavor=woff2 --unicodes=<the list in site.css's header>

They are declared once, in assets/site.css. Nothing is fetched from a third
party at view time.

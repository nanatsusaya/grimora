# Legal boundary — DSA5 plugin content

- **Status:** Binding constraint
- **Date:** 2026-07-05 · **Revised:** 2026-07-13 (Scriptorium / Regel-Wiki posture)

## Summary

*Das Schwarze Auge 5* (DSA5) is published by **Ulisses Spiele**, who hold copyright on its
**expressive content** (prose, flavour/setting text, adventures, artwork) and trademarks on its
**names/branding**. Grimora holds **no** license to redistribute that expressive content.

However, Ulisses operates an official community-content programme — **Scriptorium Aventuris**
([overview](https://ulisses-spiele.de/das-ulisses-scriptorium/)) — whose content guidelines
([summary](https://rezensionen.nandurion.de/2016/12/01/inhaltsrichtlinien-fuer-das-scriptorium/))
are directly relevant to a rules-only helper application like Grimora:

- The prohibition on "video & audio productions and **digital games**" **explicitly does not cover
  helper programs such as character generators** ("Hilfsprogramme wie Charaktergeneratoren fallen
  nicht unter das Verbot"). Grimora is a character/campaign **management tool**, i.e. a helper
  program — not a digital game.
- The **sanctioned source of rules** is the official, free **DSA Regel-Wiki**
  (<https://dsa.ulisses-regelwiki.de/>). Guidelines: authors may use rules from the Regel-Wiki; "the
  use of other official texts of any kind is explicitly not permitted" (so DSA4.1 and book PDFs are
  out — the Regel-Wiki is the reference).

This revises the original (2026-07-05) blanket "no proprietary values" line: **functional rule
content sourced from the DSA Regel-Wiki may be encoded in the plugin**, under the conditions below.

## Rule

The `plugins/dsa5` package **may** contain, sourced from the official **DSA Regel-Wiki**
(<https://dsa.ulisses-regelwiki.de/>):

- data **schemas** — which attributes / skills / derived values / abilities exist and their types;
- **rule mechanics & logic** — probe/roll resolution, generation rules;
- **formulas and their numeric constants** — e.g. derived-value formulas (LeP, SK, ZK, …), attribute
  bounds, talent/attribute associations. Game **mechanics and functional values are rules, not
  protected expression**; the Regel-Wiki is additionally Ulisses's own sanctioned source for them;
- neutral labels needed for the mechanics to function (kept as **i18n keys**, not embedded prose).
- Place/setting **names** that the Scriptorium guidelines permit (Aventurien, Dere, Myranor, …), used
  sparingly and only where functionally needed.

The package **must not** contain:

- **verbatim descriptive / flavour / setting prose** (spell descriptions, ability fluff, adventure or
  world text) — only the mechanical crunch, never the copyrighted expression around it;
- **artwork or graphic-design elements** from Ulisses publications;
- rules or values from **non-Regel-Wiki sources** (DSA4.1, purchased PDFs, other official texts);
- large verbatim **compilations** shipped as data where a compilation right could attach — prefer the
  user **import** path for bulk third-party data (see *How to apply*).

## Attribution obligation

Operating under the Scriptorium umbrella carries obligations (Scriptorium logo, a specific disclaimer
in the imprint, trademark notices). Because Grimora is distributed as software (not a storefront
publication), the **exact required attribution text and its placement must be confirmed against the
current CCA before release** (see *Open items*). Until confirmed, carry a clear trademark/attribution
notice: *Das Schwarze Auge* and related names are trademarks of Ulisses Medien und Spiele Distribution
GmbH; rules content is used from the DSA Regel-Wiki.

## How to apply

- Reviews of any `plugins/dsa5` change confirm: rule content traces to the **Regel-Wiki**; no verbatim
  prose/flavour/artwork; names limited to the permitted, functional set.
- Provide an **import** mechanism so users can bring their own (legally obtained) bulk data / content
  packs (ADR 0006 §8) rather than shipping it.
- Keep this boundary in mind for any future rule-system plugin: mechanics/structure + a sanctioned
  open/community source only, unless a license explicitly permits shipping more.

## Open items (confirm before first release relying on this)

1. **Cross-read the current Scriptorium CCA full text** directly from Ulisses (the primary source used
   here is a 2016 third-party reproduction; the official help page blocks automated fetching). Verify
   the digital-games/helper-program clause and the media-format list still read as summarised.
2. **Confirm the exact required disclaimer/attribution string** and whether the Scriptorium logo
   obligation applies to a distributed application (the CCA is written around storefront publications).
3. **Confirm the Regel-Wiki's own terms of use** permit machine-encoding its rule values into an app.

## Related compliance

Broader compliance targets (current EU + German law) are tracked separately: DSGVO/BDSG,
DDG/TTDSG (imprint & telemedia), EU AI Act (label AI output), EU Cyber Resilience Act, BFSG
(accessibility).

## Sources

- Scriptorium overview — <https://ulisses-spiele.de/das-ulisses-scriptorium/>
- Content-guidelines summary — <https://rezensionen.nandurion.de/2016/12/01/inhaltsrichtlinien-fuer-das-scriptorium/>
- Official DSA Regel-Wiki — <https://dsa.ulisses-regelwiki.de/>

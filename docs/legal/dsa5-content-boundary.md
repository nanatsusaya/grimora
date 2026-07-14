# Legal boundary — DSA5 plugin content

- **Status:** Binding constraint
- **Date:** 2026-07-05 · **Revised:** 2026-07-13 (fan-project / mechanics-not-expression basis)

> This is our own assessment of Ulisses's published policies + German IP law, **not legal advice**. It
> deliberately errs conservative. The gates in *Written permission required* below must be honoured
> before the project grows past a small mechanics-only slice or changes its commercial/OSS posture.

## Summary

*Das Schwarze Auge* (DSA) is published by **Ulisses Spiele**, who hold **copyright** on its expressive
content (rule prose, flavour/setting text, tables, adventures, artwork) and **trademarks** on its names
and branding (*Das Schwarze Auge*, *Aventurien*, *Dere*, …). Grimora holds **no** license to
redistribute that content.

What Grimora **may** rely on, without a license, is that **abstract game rules and mechanics are not
themselves protected by copyright** — only their concrete *expression* (wording) and the *selection /
arrangement / compilation* of elements are (German idea/expression line, § 2 UrhG; cf. LG Köln, 14 O
441/23, 2024-01-11). So we may **re-implement the mechanics ourselves, in our own words and code** — we
may **not** copy the rule texts, tables, examples, or bulk data compilations that express them.

### Why the Ulisses community programmes do **not** grant us more

- **Scriptorium Aventuris** is a **commercial publication programme for the Ulisses eBooks
  marketplace** (you upload titles there and earn from sales) — *not* a general open-source or web-app
  license. Its "helper programs like character generators are not caught by the digital-games ban" line
  applies *within* a marketplace publication; it does **not** license a distributed application. We do
  **not** rely on Scriptorium and do **not** use its logo/imprint.
- The **Fan-Richtlinie** (fan policy) covers *private, non-commercial homepages*: it allows summarising
  content **in your own words**, short quotes/covers for review, and use of the **fan logos** (never the
  official logo); it **forbids** text archives, image galleries, copying the products' look-and-feel,
  and **licensing DSA-derived material under CC or any other license**. It does **not** explicitly cover
  web apps / interactive tools — for those Ulisses asks for a **direct inquiry**
  (feedback@ulisses-spiele.de).

## Rule

`plugins/dsa5` (and any DSA UI) **may** contain:

- **self-implemented rule mechanics & logic** — probe/roll resolution, generation rules, derived-value
  **formulas and their functional numeric constants**, written as our own code (mechanics are rules,
  not protected expression);
- data **schemas** — which attributes / skills / derived values / abilities *exist* and their types;
- the **mechanical roster** of the rule system — *which* skills / spells / abilities exist together with
  their **mechanical parameters** (a skill's governing attribute triple, its category, its improvement
  factor; a spell's mechanical fields) and their names as **i18n keys** — but **without** their
  descriptions, application/flavour text, values-with-expression or example content. This is rules
  structure (an extension of "which … exist and their types" above), not the data-rich compilation the
  *must-not* list bars;
- neutral, functional labels as **i18n keys** (`dsa5.attr.courage`), never embedded rulebook prose;
- **our own-words** short explanations where a hint is needed, and **links to the official DSA Regel-Wiki**
  (German <https://dsa.ulisses-regelwiki.de/>, English *The Dark Eye* <https://tde.ulisses-regelwiki.de/> —
  both official Ulisses references) for the authoritative rule detail instead of reproducing it;
- **source references** on each implemented mechanic pointing at the **DSA5 rule-fidelity SSOT**
  ([ADR 0029](../adr/0029-dsa5-rule-fidelity-ssot.md)) — a two-layer pointer: the public Regel-Wiki id
  (above) plus the note path in the owner's **private** DSA5 vault (`github.com/nanatsusaya/dsa5`), which
  share one stable `regelwiki:` key. These are **pointers only**: the private vault (which does hold
  verbatim copyrighted text) is **never imported, vendored, or reproduced** into this repo — referencing
  a stable id/path carries no protected expression, consistent with the Regel-Wiki-link allowance above.

It **must not** contain:

- **verbatim rule / flavour / setting text**, headings, examples, or tables copied from the books or the
  Regel-Wiki (the Regel-Wiki is a *reference to link to and re-word*, **not** a data source to import);
- **artwork, official logos, or the products' look-and-feel** (the UI stays our own, neutral design);
- **bulk *data-rich* compilations** shipped as data — the **descriptions, effect / flavour text,
  values-with-expression, stat blocks, and improvement-cost prose** behind the entries (full spell /
  talent / special-ability / item *content*). Those are the compilation-right / permission concern; they
  come via the user **import** path / content packs (ADR 0006 §8), not shipped in the repo. (The bare
  mechanical *roster* — names + attribute triples + category + improvement factor — is **not** this; see
  the *may* list above.)
- DSA-derived content placed **under Grimora's OSS license, CC, or any other license** (the Fan-Richtlinie
  forbids re-licensing DSA material — the repo license must not purport to cover it).

## Trademark & labelling

- Mark the project clearly as an **unofficial fan project**; carry the trademark notice (*Das Schwarze
  Auge*, *Aventurien*, … are trademarks of Ulisses Medien und Spiele Distribution GmbH).
- Use the **fan logo**, never the official DSA logo.

## Written permission required (feedback@ulisses-spiele.de) — gates

Obtain **written permission from Ulisses before** any of the following ships:

1. a **comprehensive DSA database** (all/most spells, liturgies, special abilities, items, …) or a
   **full character generator** producing complete rules-legal characters;
2. **importing / shipping extensive Regel-Wiki data** as bundled content rather than user-supplied;
3. any **commercial** turn — ads, subscription, in-app purchases, paid access, donations-for-reward
   (this collides with the non-commercial fan basis; cf. ADR 0015 §9 paid-tier trigger);
4. publishing the **DSA data itself as part of the open-source repo**.

Until then Grimora stays a **free, non-commercial** helper with **self-implemented mechanics only**.

## How to apply

- Reviews of any `plugins/dsa5` change confirm: mechanics are our own code; no verbatim text/tables;
  no artwork/logos/look-and-feel; no bulk data compilation; names limited to functional i18n keys +
  the trademark notice.
- Provide an **import** mechanism (ADR 0006 §8) so users bring their own legally-obtained bulk data.
- Same rule for any future rule-system plugin: mechanics/structure only unless a license explicitly
  permits more.

## Related compliance

Broader targets (EU + German law) are tracked separately: DSGVO/BDSG, DDG/TTDSG (imprint & telemedia),
EU AI Act (label AI output), EU Cyber Resilience Act, BFSG (accessibility).

## Sources

- Ulisses Fan-Richtlinie — <https://ulisses-spiele.de/fan-richtlinie/>
- Ulisses Scriptorium (overview) — <https://ulisses-spiele.de/das-ulisses-scriptorium/>
- Scriptorium content guidelines (summary) — <https://rezensionen.nandurion.de/2016/12/01/inhaltsrichtlinien-fuer-das-scriptorium/>
- Official DSA Regel-Wiki — <https://dsa.ulisses-regelwiki.de/>
- § 2 UrhG (protected works) — <https://www.gesetze-im-internet.de/urhg/__2.html> · § 51 UrhG (quotation) — <https://www.gesetze-im-internet.de/urhg/__51.html>
- § 14 MarkenG (trademark rights) — <https://www.gesetze-im-internet.de/markeng/__14.html>
- LG Köln, 14 O 441/23 (2024-01-11), free game idea vs. protected concrete expression — <https://nrwe.justiz.nrw.de/lgs/koeln/lg_koeln/j2024/14_O_441_23_Urteil_20240111.html>

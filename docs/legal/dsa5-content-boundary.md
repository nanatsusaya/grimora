# Legal boundary — DSA5 plugin content

- **Status:** Binding constraint
- **Date:** 2026-07-05

## Summary

*Das Schwarze Auge 5* (DSA5) rule **content** — texts, stat blocks, spell/advantage values,
setting material — is copyrighted by **Ulisses Spiele**. Grimora does **not** hold a license to
redistribute that content.

## Rule

The `plugins/dsa5` package may contain **only rule mechanics and structure**:

- data **schemas** (which attributes/skills/derived values exist and their types),
- **logic** (probe/roll resolution, formulas, generation rules),
- neutral labels needed for the mechanics to function.

It must **not** contain copyrighted Ulisses texts or concrete proprietary values (e.g. published
NPC stat blocks, spell descriptions, adventure/setting text). Users enter their own content, or
import data they are themselves licensed to use.

## How to apply

- Reviews of any `plugins/dsa5` change must confirm no copyrighted content was added.
- Provide an **import** mechanism so users can bring their own (legally obtained) data.
- Keep this boundary in mind for any future rule-system plugin: mechanics/structure only unless a
  license explicitly permits shipping content.

## Related compliance

Broader compliance targets (current EU + German law) are tracked separately: DSGVO/BDSG,
DDG/TTDSG (imprint & telemedia), EU AI Act (label AI output), EU Cyber Resilience Act, BFSG
(accessibility).

# Dual-root architecture decision

Generated: 2026-08-06T09:56:41.736Z
Status: DECISION REPORT ONLY — no schema change

## Options

### A) Current: mirrored Category trees (ZERO + SECOND_HAND)

- Commercial nodes ≈ **1375 × 2 = 2750** Category rows (plus 2 system roots)
- CategoryBrand / CategoryAttribute / CategoryModel typically duplicated per side if linked per category instance
- Estimated link multiplication if naively copied:
  - Brands links: ~2×
  - Attribute links: ~2×
  - Model links: ~2×
- Pros: matches existing `sifir-urun` / `ikinci-el` filters, Listing categoryId semantics, form ladder
- Cons: admin edits twice; drift risk; seed size doubles

### B) Shared commercial Category + condition/policy

- Single ~1375 commercial nodes (+ policies)
- Condition NEW/USED on Listing/Offer or policy table
- commerceMode per root policy overlay
- Pros: half the taxonomy maintenance; Brand/Attr/Model linked once
- Cons: **breaking** for current Listing.categoryId + browse filters; large migration; Product.categoryId ambiguity for used vs new

## Compatibility with current Product / Listing

- Product.categoryId today points at shopping categories (often sifir side)
- Listing.categoryId used for classic listings including ikinci-el
- SellerOffer does not own category; inherits via Product

## Recommendation (this phase)

- **Keep A (dual Category instances)** for rollout to avoid breaking Listing/Product filters
- Treat MD tree as SHARED_TEMPLATE generator that upserts both roots
- Do **not** duplicate Brand / Product / Attribute entities
- Attach CategoryBrand/Attribute/Model primarily on ZERO leaf; SECOND_HAND inherits via resolve services or explicit lighter links
- Revisit B only after commerceMode + alias layer is stable

## Cost snapshot (template size)

| Metric | Shared template | Dual instances (A) |
|--------|-----------------|--------------------|
| Ana | 14 | 28 |
| Ara | 250 | 500 |
| Leaf | 1111 | 2222 |
| Total commercial nodes | 1375 | 2750 |

## Migration risk

- A: medium (parent moves + creates) — compatible
- B: high/critical — defer

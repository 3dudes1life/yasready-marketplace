# Marketplace | YasReady — Catalog Management v0.7

## Ownership boundary

Publishing remains the production system of record for ISBNs, formats, artifacts, production status, provider identifiers and source metadata provenance.

Marketplace owns the commercial presentation layer: reader-facing title/subtitle overrides, descriptions, cover override, category, excerpt, SEO, visibility, planned launch date, edition price/status and author storefront profile.

Marketplace presentation fields are stored on `listings` rather than overwriting the original `books` production fields.

## Draft workflow

1. `GET /api/me/books/:bookId/editor` loads the effective listing plus the current working draft.
2. The browser autosaves a complete working draft using `PATCH /api/me/books/:bookId/editor`.
3. Each autosave increments `catalog_drafts.draft_revision`; stale browser tabs receive `409 stale_catalog_draft`.
4. Validation runs are persisted in `catalog_validation_runs`.
5. `GET /api/me/books/:bookId/preview` returns the effective preview without changing the live listing.
6. `POST /api/me/books/:bookId/apply-draft` requires the draft's base listing revision to still match the live listing revision.
7. Successful application increments `listings.editor_revision` and writes a field-level summary into `catalog_change_history`.
8. No-op applies do not manufacture a new revision.

## Safety rules

- An author can only edit books owned by their Marketplace author identity.
- Draft edition IDs must already belong to the book.
- Production fields are not accepted by the editor payload.
- Physical editions selected as live require an ISBN.
- Live editions require a positive price.
- A bad author website or cover URL blocks apply.
- A failed/blocked/incomplete production edition cannot be made live through the catalog editor.
- Applying a draft does not bypass the listing-level author launch gate for a draft book.
- Planned launch date is metadata only in v0.7; it does not automatically publish a listing.

## Data model

`catalog_drafts` holds one working draft per book. `catalog_change_history` is the applied revision audit trail. `catalog_validation_runs` preserves validation provenance. Marketplace presentation overrides live on `listings`; source production metadata remains on `books` and `editions`.

# Seed assets

`placeholder-receipt.jpg` is the tiny 1x1 placeholder JPEG used for every
non-draft seeded expense. The exact same bytes are also embedded as a
base64 constant in `../seed.ts` (`PLACEHOLDER_RECEIPT_JPEG_BASE64`) so the
seed action can store the blob without filesystem access at deploy time.

If you want richer demo receipts, drop more JPGs here and update
`seed.ts` to embed/reference them.

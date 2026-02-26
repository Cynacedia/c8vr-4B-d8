# Wired-New: Pop-Up Card Theme

## How It Works
Hides the normal profile layout and surfaces the Blurbs card as a centered pop-up dialog that inherits the site's native theme. The pop-up is styled as a fake "profile unavailable" error page.

## Files
- `custom.css` — Paste into MyOshi's **Custom CSS** editor
- `custom.html` — Paste into MyOshi's **Custom HTML** blurb editor
- `notes.md` — This file. Documentation only, not pasted anywhere.

## CSS Notes
The prefixer prepends `.profile-page.profile-custom-css` to every selector automatically. All selectors in custom.css are written WITHOUT that prefix.

### What the CSS does (in order):
1. **Hide all page content** — breadcrumb bar, left sidebar, all right-column cards
2. **Un-hide the Blurbs card** — targeted via `.card:has(.profile-custom-html)` so it works regardless of card order. Repositioned as `position: fixed` centered pop-up with `transform: translate(-50%, -50%)`
3. **Clean up inside the card** — hides "About Me" / "Who I'd Like to Meet" sections (via `:has(.blurb-title)`), hides section-links footer. Keeps the card-header as a dialog title bar.
4. **Flatten layout** — removes container/layout constraints so the fixed-positioned card isn't clipped
5. **Style content area** — `.profile-custom-html` gets padding, font size, line height

### Selector notes
- `:has()` is used in two places: `.card:has(.profile-custom-html)` to find the right card, and `.blurb-section:has(.blurb-title)` to hide labeled sections. If `:has()` breaks with the prefixer, fallback to nth-child selectors.
- The card header text ("ᵂᶤʳᵉᵈ's Blurbs") comes from the platform — can't change it via CSS/HTML. Could be hidden if it doesn't fit the error page illusion.

## HTML Notes
- First div: full-viewport backdrop overlay (fixed, z-index 999, semi-transparent black)
- Second div: fake error message content with a "Return" button linking to `/` (myoshi.co home)
- The "Return" button uses `--vs-blue` background with pill/capsule shape (`border-radius: 999px`)
- Uses `--vs-*` CSS variables for native theme colors throughout

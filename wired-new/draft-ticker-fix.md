# Ticker Pseudo-Element Fix — Draft

## Summary
Move .abt ticker animations from HTML (inside re-rendered zone) to CSS
pseudo-elements on .card-body (stable platform wrapper, not re-rendered).

## Budget
| | Chars |
|---|---|
| Current CSS | 48,844 |
| Remove @keyframes blurb-drift-a/b/c/d | -890 |
| Change overflow:visible → hidden (1 char) | -1 |
| Add ::before ticker rule | +557 |
| Add ::after ticker rule | +541 |
| **New total** | **49,051** |
| **Remaining** | **949** |

## Trade-offs
**Lost:**
- Drift diamonds (◇◆ floating) — removed to free CSS space
- Bottom ticker pair (only 2 pseudo-element slots = top pair only)
- Glitch-blocks + glitch-tear on blurb card (pseudo-elements repurposed)

**Kept:**
- Top ticker pair (now on stable .card-body, won't restart)
- .g glitch-slice animations (still restart, but subtle/brief)
- All other effects unchanged

## CSS Changes

### 1. CHANGE: card-body overflow (visible → hidden)
Existing rule:
  .container:has(~ .modal-overlay) .profile-right .card:has(.blurb-content) > .card-body{overflow:visible !important}
Change to:
  .container:has(~ .modal-overlay) .profile-right .card:has(.blurb-content) > .card-body{overflow:hidden !important}

### 2. REMOVE: 4 drift keyframes (890 chars)
@keyframes blurb-drift-a{...}
@keyframes blurb-drift-b{...}
@keyframes blurb-drift-c{...}
@keyframes blurb-drift-d{...}

### 3. ADD: ticker ::before (557 chars)
.container:has(~ .modal-overlay) .profile-right .card:has(.blurb-content)>.card-body::before{content:"\2591\2591 SCANNING \2591\2591 FREQUENCY LOCKED \2591\2591 OBSERVER PROTOCOL ACTIVE \2591\2591 MONITORING \2591\2591 SIGNAL PERSISTS \2591\2591\a0\a0\a0\a0\a0\a0\2591\2591 SCANNING \2591\2591 FREQUENCY LOCKED \2591\2591 OBSERVER PROTOCOL ACTIVE \2591\2591 MONITORING \2591\2591 SIGNAL PERSISTS \2591\2591\a0\a0\a0\a0\a0\a0";position:absolute;top:0;left:0;white-space:nowrap;font-size:.65em;letter-spacing:3px;opacity:.25;line-height:1.3;animation:blurb-ticker-left 32s linear infinite;z-index:2;pointer-events:none}

### 4. ADD: ticker ::after (541 chars)
.container:has(~ .modal-overlay) .profile-right .card:has(.blurb-content)>.card-body::after{content:"\2591\2591 MONITORING \2591\2591 CHANNEL OPEN \2591\2591 DECRYPT FAILED \2591\2591 ARCHIVE PENDING \2591\2591 TRACE ACTIVE \2591\2591\a0\a0\a0\a0\a0\a0\2591\2591 MONITORING \2591\2591 CHANNEL OPEN \2591\2591 DECRYPT FAILED \2591\2591 ARCHIVE PENDING \2591\2591 TRACE ACTIVE \2591\2591\a0\a0\a0\a0\a0\a0";position:absolute;top:1.3em;left:0;white-space:nowrap;font-size:.65em;letter-spacing:3px;opacity:.15;line-height:1.3;animation:blurb-ticker-right 40s linear infinite;z-index:2;pointer-events:none}

## HTML Changes (custom.html)

### REMOVE from .abt:
1. Top ticker pair (2 divs with spans) — after the <br><br><br>
2. Bottom ticker pair (2 divs with spans) — after "END TRANSMISSION"
3. Drift diamond container div (7 spans) — between the two <hr>s

### KEEP in .abt:
- blockquote, status table, poem text (.g spans), hr dividers
- BEGIN/END TRANSMISSION labels
- "A projection of your perception" text

## Open Questions
- Is the log-report-status positioning (-18px top) still visible with
  card-body overflow:hidden? Should be fine since it's deep in the content
  flow with space above it.
- Could we recover the bottom ticker pair later using .blurb-section
  pseudo-elements if we confirm blurb-section is stable?

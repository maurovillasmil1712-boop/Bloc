# Bloc design system: Fosforito (v6.0)

This file is the source of truth for how Bloc looks. If `styles.css` and this file disagree, this file wins. Every token lives at the top of `styles.css`.

## What Bloc is

- **Artifact:** a phone-first study planner (web app at myib.app, also wrapped as the iPhone app). Students work in it, so it's an Operate surface: the task comes first, the look second.
- **Audience:** 16 to 18 year olds at a Madrid school (IB, Bachillerato, ESO, university). They check it between classes, on the metro, at the desk at night.
- **Feel, in three words:** studious, sharp, yours.

## The world

The student's desk in Spain: squared *cuadrícula* paper, blue-black ballpoint ink, and highlighters (*fosforitos*) used to colour-code subjects. The world gives Bloc four things and only these: type, palette, density, and one signature move. It never changes the navigation, the controls or the layout grammar.

**Signature move:** a chisel-tip highlighter stroke marks only what matters *right now*:

- the class that's on (its "33m left" tag) and the "Now" cell in the timetable
- today in the month grid, the timetable header and the date chips
- the next exam or deadline on Today (the heads-up line)
- the section you're on in the tab bar and the top nav
- text selection

Keep it rare. One or two highlights per screen. If everything is highlighted, nothing is.

**Runner-up:** "Línea", the school day drawn as a Madrid metro line. A coin flip chose Fosforito. Línea kept one rule: every mark has to carry information. That's why Today's classes are one continuous time column instead of a card per class.

## Type

- **One face:** Schibsted Grotesk (variable, 400 to 900), self-hosted in `fonts/` (CSP is `font-src 'self'`). The licence is `fonts/OFL.txt`.
- **Fixed scale, no fluid type in the app:** 12 / 13 / 15 (body) / 16 / 17 / 19 (section) / 30 (screen title). The Today date runs 30 to 44 px.
- **Titles:** weight 800, tracking -0.02 to -0.025em. **Section heads:** weight 800, 19 px, sitting on a 2 px ink rule. **Labels:** sentence case, never tracked caps.
- **Numbers that line up** (times, countdowns, counts) use `font-variant-numeric: tabular-nums`.

## Colour

| Role | Light | Dark |
|---|---|---|
| Paper (`--bg`) | #FFFFFF | #111318 |
| Sunken paper (`--paper-2`), for grids and grouped panels | #F3F4F6 | #191C22 |
| Ink (`--label`), for text, buttons and selection | #191D29 | #ECEEF2 |
| Ink 2 (`--label-2`), for secondary text | #535A69 | #A3A9B5 |
| Rules (`--separator`) | #E2E5EA | #262A31 |
| Cuadrícula (`--grid`), on time grids only | #E7EBF1 | #22262D |
| Highlighter (`--hl`) | #FFE14D | #F4D53E |
| Red pen (`--red`), for overdue and errors | #C7302A | #FF7A6E |
| Amber (`--orange`), for "soon" | #A86200 | #F2AE45 |
| Green ink (`--green`) | #1D7A4C | #5ACB91 |

- **Ink does the work.** `--accent` is ink, so primary buttons are solid ink with white text (light text on dark in dark mode). Links are ink with an underline.
- **Highlighter text** is always `--hl-ink` (near-black), in both modes.
- **Subject colours** stay as the student picked them (the 13 colours in `PALETTE`, app.js). They show as highlighter fills (`color-mix` with paper at `--tint` or `--tint-strong`) and as small slanted strokes (`.sw`). Subject names are always set in ink, never in the subject colour.
- **Bloc Plus picks the highlighter**, not the ink: Yellow (default), Green, Pink, Orange, Blue, Violet, Mint, Pencil. The saved keys are still the MyIB ones (`green`, `pink`, `orange`, `teal`, `purple`, `indigo`, `graphite`).

## Shape, space, depth

- **Two corner sizes:** `--r` 12 px for groups, sheets, inputs and buttons; `--r-s` 6 px for tags, chips, small buttons and timetable cells. Circles only for avatars, checkboxes and the timer controls.
- **Surfaces:** a screen is paper. Sections sit on it with a heading, a 2 px ink rule and space. Lists are ruled (1 px). A sunken panel (`--paper-2`) appears only for things that hold a grid or a group: the month, the timetable, the day panel, subject panels, the task form, grouped settings.
- **No shadows at rest.** Only things that float get one: sheets, the toast, the drag ghost, the "new messages" pill.
- **No glass, no blur, no gradients as decoration.** The highlighter is drawn with a hard-stop gradient so its ends lean like a chisel tip. That's the only gradient on screen, and it renders as a flat shape.
- **Squared paper** appears only where time is measured: the desktop timetable, the day's hourly plan and the Siri tutorial pictures.

## Motion

- Ease-out `cubic-bezier(.2,.8,.2,1)`, 140 to 220 ms. Nothing bounces, nothing overshoots.
- Motion only answers the student: presses give a little (scale .97), sheets slide up 14 px, toasts fade up, tabs crossfade.
- Ticking a task off draws an ink line through it (`.task.pop`). There's no confetti. The phone still gets the haptic tap.
- `prefers-reduced-motion` turns the travel off.

## Components

- **Buttons:** primary is ink, secondary is fill, tertiary is an underlined link. Heights: 40 (normal), 32 (small), 44 to 50 (sheet and log-in actions).
- **Tab bar (phone):** docked to the bottom edge, full width, paper with a top rule. Six sections. The current one is ink with a highlighter stroke behind its label. Inactive tabs are `--label-3`.
- **Header:** wordmark (icon plus "Bloc"), then "Ask" (the assistant, with the marker icon), chats and settings. The theme switch lives in Settings, Appearance.
- **Today's classes:** a timetable coloured in with highlighters. Coming classes are filled. The class that's on gets a 2 px ink outline, a highlighted "time left" tag and a thin ink progress line along its foot. Finished classes lose their colour.
- **Countdowns:** a ruled list. The exam row leads at 28 px. No giant hero number.
- **Filters:** one chip row that scrolls sideways, never a wall.
- **Log in:** left-aligned. Visible labels above every field (`.row.stack`). The level list is a ruled list with no coloured tiles.
- **Assistant:** opens with words, no badge. Suggestions are a ruled list. The change card has an ink border and an Approve button in ink.

## Icons and pictures

- The hand-drawn SVG set stays, at a 1.75 stroke, in ink.
- The assistant's icon is a marker drawing a line. It replaced the sparkle.
- The Study Pet illustrations are the one place with pictures. Their sky, grass and colours stay as drawn.
- **App icon:** an ink tile with the white Bloc "b" blocks, the lower block in highlighter yellow (`icons/favicon.svg`, PNGs rendered from it). The iPhone app's icon in Xcode still has the old orange one.

## Accessibility

- Ink on paper measures about 16:1. Ink 2 on paper is 7:1. Highlighter text is ink on yellow.
- Focus is a 2 px ink outline. Targets are at least 44 px on phones.
- Exams on the phone month grid are ringed in ink, so they don't depend on colour.

## Slop audit (v6.0)

Removed:

- cream paper with a terracotta accent
- five gradient blobs and film grain
- glass cards, rims and a light that followed the pointer
- 22 to 34 px corners
- tracked all-caps labels
- the giant countdown hero number
- side stripes on class blocks
- one coloured word in headings
- icon tiles above headings
- the sparkle AI icon
- gradient icon fills and glow shadows
- overshoot springs, staggered rising cards, numbers counting up and confetti
- placeholder-as-label on log in

Still there, and why:

- Six tabs on phones: iOS suggests five. Changing the sections is a product decision, not a visual one.
- About 50 middle dots in deep sheets and admin screens: low on the list.

## Changelog

- **v6.0, 23 Nov 2026:** Fosforito replaces "paper notebook under glass" (v5.0 to v5.4).

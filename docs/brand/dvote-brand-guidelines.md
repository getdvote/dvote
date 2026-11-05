# dvote brand guidelines and design system

**Version 3.0. 5 November 2026.**
The hero colour is decided: dvote Blue. This version will replace brand v2.0 (coffee palette) when the rollout ships. Nothing in the product has changed yet.

Reference: the structure and working method of the [Global Payments brand guide](https://www.gpbrandguide.com/). Every name, colour value, line of copy and graphic device here belongs to dvote. Appendix A lists what was adapted and what must never be copied.

Companion files in this folder:

- [theme.css](theme.css): all tokens, light and dark
- [contrast-audit.py](contrast-audit.py): recalculates every approved colour pair

---

## Contents

**Part 1: Brand**
1. [How to use this guide](#1-how-to-use-this-guide)
2. [Positioning](#2-positioning)
3. [Voice](#3-voice)
4. [Arabic and English](#4-arabic-and-english)

**Part 2: Identity**

5. [Logo](#5-logo)
6. [Colour](#6-colour)
7. [Typography](#7-typography)
8. [Photography](#8-photography)
9. [Graphic elements](#9-graphic-elements)
10. [Motion](#10-motion)

**Part 3: Design system**

11. [Tokens](#11-tokens)
12. [Layout](#12-layout)
13. [Components](#13-components)
14. [Data visualisation](#14-data-visualisation)
15. [Accessibility](#15-accessibility)
16. [The merchant's brand](#16-the-merchants-brand)

**Part 4: Applications and rollout**

17. [Applications](#17-applications)
18. [Rollout plan](#18-rollout-plan)
19. [Release checklist](#19-release-checklist)
20. [Open decisions](#20-open-decisions)

[Appendix A: what came from the reference](#appendix-a-what-came-from-the-reference)
[Appendix B: audit results](#appendix-b-audit-results)

---

# Part 1: Brand

## 1. How to use this guide

This guide is for anyone who writes, designs or builds for dvote: the team, freelancers, printers and AI tools.

Rules are written so they can be checked. **Must** and **never** are firm. **Prefer** leaves room for judgment. If a case isn't covered, simplify first, then ask at getdvote@gmail.com.

**What changes from v2.0**

| Area | v2.0 (coffee) | v3.0 (this guide) | Why |
|---|---|---|---|
| Hero colour | Orange `#FF5500`, used sparingly | dvote Blue `#1F3DFF`, used as a clear accent | White text passes on blue (6.63:1). On orange it fails (3.21:1) |
| Orange | The accent | One of five accents | Keeps a link to the old look and sets dvote apart from other blue brands |
| Neutrals | Latte, Cortado | Froth, Oat, Line, Stone, Taupe | dvote now serves salons, gyms and any shop with regulars, so coffee-coloured fills no longer fit |
| Latin type | Inter | DM Sans | Rounder and warmer, with a strong Black weight |
| Arabic type | Cairo, and IBM Plex Sans Arabic in `apps/web` | Alexandria everywhere | One Arabic voice, with a bold, modern character |
| Headlines | Weight varied by surface | Black headlines, Light subheads | A clear, ownable contrast |
| Layout device | Cards | Bento grid | Tells a story in blocks and matches the product |
| Graphic device | Patterns and curves | Blade and Star, taken from the logo | The brand's story sits inside its mark |

**What doesn't change**

- The logo artwork
- Lowercase `dvote`
- Espresso as the text colour
- Froth as the light canvas
- Solar icons
- The token names in code
- Merchants' saved card designs

---

## 2. Positioning

### Who we are, in one line

> **dvote is how local businesses bring their regulars back.**

### The problem

Customers visit once and the business never hears from them again. Paper cards get lost. Nobody installs an app for one shop. The owner can't tell who their regulars are.

### What dvote lets a business do

| Know them | Reach them | Bring them back |
|---|---|---|
| See every member, their visits and their spend | Put a message on the lock screen, with no cost per send | Give points on every visit and a reward worth returning for |

### Proof

Use facts the product can back up today:

- No app to install, for customers or staff
- A free QR and NFC stand for every branch, on every plan
- No cost per message
- Arabic and English throughout
- 14 days free, no card needed

**Never invent numbers.** dvote has no published customer, visit or revenue figures yet. When real ones exist, add them here in this form: "*X* businesses, *Y* members, *Z* visits."

**Check before claiming Apple Wallet.** The landing page promises Apple Wallet, but `CLAUDE.md` still lists Apple passes as not built. See [Open decisions](#20-open-decisions).

### The rally cry

> ***Good things come back.***

It works on three levels: customers come back, rewards come back to them, and the business gets its investment back. It already closes dvote's emails, but isn't on the landing page yet.

**How to write it**

- In running text: sentence case, italic, with the full stop. "Your regulars, your rewards. *Good things come back.*"
- In design: use the approved artwork, set in DM Sans Black. Never redraw it in another font.
- Arabic has no italics, so set it upright in Alexandria Black, with the full stop.

**Do**

- Use it as a sign-off on campaigns, stands and video endings
- Say it with warmth and confidence

**Don't**

- Change the words, or drop the full stop
- Lock it tightly to the logo; it keeps the logo's clear space
- Use it in error messages or anything serious, such as billing or account closure
- Use it more than once in a layout

### Who we speak to

| | Merchants | Customers |
|---|---|---|
| Who | Owners and managers of cafés, restaurants, salons, gyms and shops with regulars, from one branch to a chain | People who visit those places |
| What they want | More repeat visits, without more work | Their usual, with a little extra |
| Lead with | A useful outcome | A clear benefit |
| Where dvote appears | Front and centre | Quietly. The merchant's brand comes first ([section 16](#16-the-merchants-brand)) |

### Personality

**Warm.** Like a good host who remembers your order.
**Quick.** Short sentences, one action at a time, nothing to install.
**Sure.** We state things plainly and we don't oversell.

---

## 3. Voice

dvote sounds like two places in a customer's day.

### At the counter

Warm and human.

- Everyday words, the way a helpful person speaks
- *You*, *your* and *we*
- Name real things: the till, the stand, the regular, the latte
- Show the merchant and customer winning. dvote stays in the background

### On the lock screen

Quick and sure.

- Lead with the point. Readers give us seconds
- Short sentences and short paragraphs
- Active verbs
- Turn a problem into the next step

### Before and after

| Instead of | Write |
|---|---|
| Maximise customer retention | Give your regulars a reason to come back. |
| Omnichannel engagement platform | Your message, on their lock screen. |
| Enrollment successful | You're in. Your card is ready. |
| Unlock unparalleled benefits | 60 more points to a free latte. |
| Invalid request | That didn't work. Try again, or ask a team member. |
| Leverage customer insights | See who came back this month. |

### Tone by moment

| Moment | Tone | Example |
|---|---|---|
| Reward earned | Celebrate, briefly | Free latte ready. Enjoy! |
| Teaching a step | Calm and direct | Show your card at the counter to collect points. |
| Something failed | Honest, with a way forward | We couldn't add your points. Try again, or ask a team member. |
| A limit | Plain, no blame | This reward isn't available at this branch right now. |
| Plan limit | Factual, with the option | 3 of 5 active rewards on Regular. See plans to add more. |
| Billing or closing an account | Serious and clear, no wit | Your plan ends on 30 November. |

### Two kinds of writing

**Boilerplate** is for press, partners and legal pages, when a neutral summary is needed.

> dvote helps local businesses bring their regulars back. Customers join in seconds and keep a points card in their phone's wallet, with no app to install. Businesses use dvote to give rewards, see who returns and send offers to the lock screen, in Arabic and English.

**Brand story** is for the website, decks and marketing. Cut it to fit.

> Everyone has a place they go back to. The café that knows your order. The barber who remembers your name.
>
> Those places deserve better than a paper card that dies in a pocket. So we put their card where people already look: on the phone, in the wallet, one tap from the till.
>
> No app. No hassle. Just a good reason to come back, and a simple way for owners to see that it's working. *Good things come back.*

### Words we use

| Use | Not |
|---|---|
| dvote (always lowercase, even at the start of a sentence) | Dvote, DVote, DVOTE |
| merchant, business, shop | vendor (code only), client |
| regulars, members, customers | users, consumers, end-users |
| card, points card | loyalty instrument, membership asset |
| points | stamps, credits, coins |
| reward | prize, gift, perk |
| branch | location, outlet, store unit |
| the stand | the device, the hardware |
| Wallet (Apple Wallet, Google Wallet) | passbook, e-wallet |
| broadcast, message, offer | blast, campaign push |
| EGP 499 | LE499, 499 pounds |

**Plan names:** Regular, Loyal and Chain, capitalised.

### Writing rules

- Sentence case for headlines, buttons and menus
- One idea per sentence, one main action per screen
- Buttons start with a verb and say what happens: "Start free trial", "Give the reward"
- Numbers as digits: "3 staff seats", "14 days"
- Never mix up points and money
- State reward terms exactly; no vague promises
- No jargon, buzzwords, exclamation runs or fake urgency
- Friendly, not over-familiar. No slang in anything about money or accounts
- Emoji only in merchant-written offers, and at most one

---

## 4. Arabic and English

Arabic is a first language for dvote, not a translation.

- **Merchant marketing and customer campaigns:** natural Egyptian Arabic
- **Operational instructions and legal text:** clear, simple Arabic
- `dvote` stays in lowercase Latin letters inside Arabic text
- Write Arabic first when the idea is cultural. Translate meaning, never word for word
- Every public Arabic line needs a native review before release

**Layout in Arabic**

- `dir="rtl"` on the page; use logical properties (`ms-`, `pe-`, `start-`, `end-`) only
- Text aligns to the start edge: left in English, right in Arabic
- Mirror direction: back and forward arrows, progress, sliding motion
- Don't mirror: the logo, the Star, media controls, phone numbers, prices in Latin digits, QR codes

**Arabic rally cry:** the emails use الأشياء الجميلة تعود دائمًا. A more Egyptian option is الحاجات الحلوة بترجع. Pick one in native review, then use it everywhere.

---

# Part 2: Identity

## 5. Logo

### The idea

The dvote symbol is five blades turning around a star. Each blade is a visit. The star at the centre is the reward they add up to. That story drives the graphic system ([section 9](#9-graphic-elements)) and the motion ([section 10](#10-motion)).

The supplied master artwork is final: proportions 665 × 208. Never redraw it.

### Versions

| Version | Colours | Use on | Share of use |
|---|---|---|---|
| **Primary** | All white | dvote Blue or Night Blue | Most brand moments |
| **Secondary** | Blue symbol, Espresso wordmark | White or Froth | When a blue background isn't possible, including most product screens |
| **Dark** | Lifted Blue `#6F86FF` symbol, Froth wordmark | Espresso | Dark mode only |
| **Photo** | All white | Calm, dark areas of a photo | Photography only |
| **Mono** | All Espresso or all white | Single-colour jobs: engraving, stamps, receipts, embossing | Print limits only |

**Lockup or symbol?** Lead with the full lockup. Use the symbol alone when dvote is already named nearby, or in small square spaces: app icon, avatar, favicon, sign-off.

### Clear space

Keep at least **H/4** clear on all sides, where H is the symbol's height. On a 160 px wide lockup that's about 13 px.

### Minimum size

| Asset | Screen | Print |
|---|---|---|
| Full lockup | 128 px wide | 30 mm wide |
| Symbol | 24 px | 6 mm |

The 16 px favicon is the only exception, and needs its own simplified version ([Open decisions](#20-open-decisions)). Always inspect final output at actual size.

### Optical centring

The blades make the symbol look off-centre when it's centred mathematically. Align it by eye in icons, avatars and buttons, and build this offset into exported PNGs.

### Containers

The logo is never placed in a shape, with two exceptions:

- **App icon:** white symbol on a Blue rounded square, symbol at about 69% of the width
- **Avatar:** white symbol on a Blue circle, at the same ratio

### Product names and partners

- Product names are plain text beside the logo, never new logos: "dvote Staff"
- **Co-branding:** give both logos equal visual weight, with a divider between them and at least H/2 of space on each side
- A merchant's logo always leads on merchant surfaces

### Never

- Stretch, squash or rotate it, except by 90° on tall formats
- Change its colours, or mix colours in the wordmark
- Use orange or any other accent colour for it
- Add shadows, outlines, glows or gradients
- Change the letter spacing or the gap between symbol and wordmark
- Split the symbol's blades in the logo itself (the Blade device is separate artwork)
- Use it as a loading spinner, or give it a face
- Put it inside a sentence. In text, write `dvote`
- Put it on busy images, or on an accent colour
- Theme it for seasons or events
- Use an old version, including the orange or lime logos

---

## 6. Colour

Colour says *confident and modern* through blue, and *human and warm* through the accents and neutrals. Every design starts from white and dvote Blue.

### Core palette

| Colour | HEX | RGB | Role |
|---|---|---|---|
| **White** | `#FFFFFF` | 255 255 255 | Space, cards, text on blue |
| **dvote Blue** | `#1F3DFF` | 31 61 255 | The hero: primary actions, links, active states, one brand block per marketing view |
| **Night Blue** | `#142AB8` | 20 42 184 | Depth: pressed states, info messages, occasional marketing blocks |
| **Espresso** | `#18100F` | 24 16 15 | Text, dark surfaces |

### Accent palette

Accents add warmth and are always used lightly.

| Colour | HEX | RGB | Good for |
|---|---|---|---|
| **Sky** | `#6EC1FF` | 110 193 255 | The link between blue and the other accents |
| **Orange** | `#FF5500` | 255 85 0 | Reward moments, highlights, the dvote heritage colour |
| **Egg Yolk** | `#FFCA48` | 255 202 72 | Points, warnings, highlights |
| **Mint** | `#B8D9C5` | 184 217 197 | Success tints, calm panels |
| **Plum** | `#5F2B4B` | 95 43 75 | Depth, chart series |

**The Sky rule:** whenever a layout uses two or more accents, Sky must be one of them. It ties the accents back to blue.

### Neutral palette

Warm neutrals stop the blue from feeling cold and keep dvote distinct from cool-grey fintech.

| Colour | HEX | Role |
|---|---|---|
| **Froth** | `#F8F4F1` | Light page background |
| **Oat** | `#EFE9E3` | Soft fills, hover, holding shapes |
| **Line** | `#E4DCD4` | Dividers and card edges (decorative only) |
| **Stone** | `#8C7B6E` | Control borders, placeholders on large inputs |
| **Taupe** | `#6B5E57` | Secondary text, legal copy |

### Status colours

| Meaning | Text or icon | Soft background |
|---|---|---|
| Success | `#1F6B47` | `#E2EFE7` |
| Warning | `#8A5A00` | `#FFF1CC` |
| Error | `#B42318` | `#FEF3F2` |
| Info | `#142AB8` | `#E8EBFF` |

**Red only ever means something negative.** Never use it for decoration, promotions or a positive number. Orange is not a status colour.

### Proportions

**Marketing and brand surfaces**

| Share | What |
|---|---|
| 50% or more | Mostly White, with dvote Blue for the one brand block |
| Supporting | Photography, neutrals, Night Blue |
| 5–15% | Accents, one or two per layout |

**Product screens are neutral:** a Froth canvas and sidebar, White cards and Espresso text. Blue is an accent that guides the eye, reserved for the one main action, active and selected states, links, focus rings and the lead chart series. **Never use blue for sidebars, page frames or large panels in the product.** The less of it there is, the faster people find what matters.

**On marketing surfaces, use one blue block per view.** The landing page's hero is blue. Its frame, header and footer are neutral Espresso.

### Approved combinations

| Background | Headlines | Body | Accents allowed |
|---|---|---|---|
| White | Espresso or Blue | Espresso | Yes, as shapes |
| Froth or Oat | Espresso or Blue | Espresso, Taupe for secondary | Yes, as shapes |
| dvote Blue (marketing blocks only) | White | White | Yes, as shapes |
| Night Blue | White | White | Yes, as shapes |
| Espresso | Froth | Froth | Yes, as shapes |
| Photo | White, on a calm area | Avoid body text | Blue shapes first |

### Text on accents

Use Espresso on Sky, Orange, Egg Yolk and Mint. Use White on Plum.

**These fail contrast. Never use them for text:**

| Pair | Ratio |
|---|---|
| White on Orange | 3.21:1 |
| Espresso on Blue | 2.83:1 |
| Orange on Blue | 2.07:1 |
| Sky on Blue | 3.39:1 |
| Egg Yolk on Blue | 4.35:1 |
| Sky on White | 1.96:1 |

### Gradients

- Allowed in one place: the Blade device, Blue to Night Blue
- Never on backgrounds, type, icons, buttons or product UI, and never in print
- Merchants' card designs may use gradients. That's their brand, not dvote's

### Print

dvote Blue is a screen colour. Bright RGB blues don't reproduce in CMYK, so print needs its own recipe.

**Print Blue starts at about CMYK 88 76 0 0. This is a conversion estimate, not a tested value.** Before the first stand or poster run, get a physical proof and pick the nearest Pantone with the printer, then record both here. Do the same for Orange and Sky.

### Never

- Use colours outside this guide, or pairs below WCAG AA
- Use an accent as a full background
- Set text in an accent colour
- Use Night Blue for type on white, except for info messages
- Lean on one accent across a whole campaign; rotate them
- Use colour alone to carry meaning
- Tint photos so heavily that they stop looking real

---

## 7. Typography

Type should feel friendly but exact. **DM Sans** is the Latin font and **Alexandria** the Arabic. Both are free under the SIL Open Font License, and both are on Google Fonts.

The signature is contrast: **Black headlines against Light subheads.**

### Weights

| Weight | Marketing | Product |
|---|---|---|
| **Black 900** | Headlines | Page titles, big metrics |
| Bold 700 | Not used | Card titles |
| SemiBold 600 | Not used | Section titles, labels |
| Medium 500 | Not used | Buttons, tabs, menu items |
| Regular 400 | Body text | Body text, tables |
| Light 300 | Subheads, eyebrows, intros, at 18 px or larger | Not used |

Never use Thin or ExtraLight, or any Light text under 18 px. Alexandria uses the same weights.

### Marketing scale

The scale steps by roughly 1.414 from a 16 px base.

| Style | Desktop size / line | Mobile size / line | Weight | Colour |
|---|---|---|---|---|
| Hero | 90 / 96 | 45 / 50 | Black | White, Blue or Espresso |
| Display | 64 / 72 | 40 / 46 | Black | White, Blue or Espresso |
| Headline 1 | 45 / 52 | 32 / 38 | Black | Blue or Espresso |
| Headline 2 | 32 / 40 | 26 / 32 | Black | Blue or Espresso |
| Headline 3 | 23 / 30 | 20 / 28 | Black | Espresso |
| Subhead | 23 / 34 | 20 / 30 | Light | Espresso or White |
| Eyebrow | 18 / 26 | 16 / 24 (Regular) | Light | Espresso or White |
| Body | 16 / 24 | 16 / 24 | Regular | Espresso or White |
| Small and legal | 14 / 21 | 14 / 21 | Regular | Taupe |

### Product scale

| Style | Size / line | Weight |
|---|---|---|
| Metric, large | 32 / 40 | Black |
| Page title | 24 / 32 | Black |
| Card title | 18 / 26 | Bold |
| Section title | 16 / 24 | SemiBold |
| Body | 14 / 21 | Regular |
| Label, button | 14 / 20 | Medium |
| Caption | 12 / 18 | Regular |

Customer screens and the staff app use a 16 px body. Inputs on phones must be 16 px or more, so iOS doesn't zoom in.

### Presentations and print

- **Slides:** title 54–64 Black, section 36 Black, body 20–24 Regular, footnote 12 Regular
- **Print:** headline 36–72 pt Black, subhead 18–24 pt Light, body 9–11 pt Regular, legal 6.5–7 pt Regular

### Treatments

- **Alignment:** start-aligned. Left in English, right in Arabic. Centre only on short hero lines and single-line buttons
- **Case:** sentence case everywhere. Never all caps, including eyebrows
- **Line height:** 150% for body text. Headlines tighten to about 110–125%
- **Letter spacing:** default for body. Headlines may tighten to −2% at 45 px and up. Never tighten body text
- **Line length:** 45–75 characters
- **Numbers:** DM Sans has no tabular figures, so numbers that must line up (tables, tills, metrics, count-ups) use Alexandria with `tabular-nums`. In code, the `tabular-nums` class applies both
- **Arabic digits:** Alexandria's Arabic digits aren't tabular. Where Arabic numerals must line up in columns, use Latin digits
- **Emphasis:** a heavier weight. Italic is for the rally cry only

### Arabic rules

- Line height 160–170% for body, about 130% for headlines
- No letter spacing, ever; it breaks the joins between letters
- No italics and no underlines through descenders
- Arabic reads smaller than Latin, so use one step larger where it shares a line with English
- Prefer Regular over Light on small screens
- Alexandria is wide, so check that Arabic labels and buttons fit, especially at 320 px

### Fallbacks

| Situation | Latin | Arabic |
|---|---|---|
| Web, app | DM Sans | Alexandria |
| Google Docs and Slides | DM Sans | Alexandria |
| PowerPoint, Word, email clients | Arial | Tahoma |

DM Sans is also the free fallback font named in the Global Payments guide. It's open source and fine to use. The distinct look comes from pairing it with Alexandria and dvote's own colours.

The merchant's chosen font (`BRAND_FONTS`) applies only on their own storefront.

### Never

- Mix typefaces in one surface, beyond DM Sans with Alexandria
- Mix weights or colours inside one paragraph
- Use accent colours or gradients for type
- Rotate copy, or use tight or loose body leading
- Stretch, outline or shadow text
- Use the rally cry in any other font

---

## 8. Photography

Photography shows the human side of coming back: the owner behind the counter, the regular who feels known, the small pleasure of a reward. It should look like real Egyptian streets and shops.

**dvote has no photo library yet.** Until there's a shoot, use product UI, illustration and bento compositions rather than stock.

### What to shoot

| Type | What it shows | Direction |
|---|---|---|
| **Owners and teams** | Real merchants at work | Busy hands, a shared laugh, serving someone they know |
| **Regulars** | Customers enjoying their place | Friends at a table, a morning order. They look relaxed, not at their phones |
| **Portraits** | One merchant or customer | Warm, natural setting, looking comfortable. Faces with character |
| **In use** | The product doing its job | A phone tapping the stand, a card in Wallet, staff scanning at the till. Always show hands where possible |
| **Studio** | The stand, the phone, the card | Clean, well lit, simple props from the trade: a cup, a receipt, a comb, a towel |
| **Places** | The shop without people | Lived-in: a half-finished coffee, a coat on a chair, the morning shutter going up |

### What makes it ours

- **Warm light, rich colour.** Late-morning sun, tungsten glow. Never cool or grey
- **Candid.** The camera feels like part of the scene
- **Real variety.** Cafés, salons, gyms, restaurants and bakeries. Different ages, styles and modest and casual dress, as you'd see on a real street
- **Interesting angles.** Slightly low, close, confident; not flat or corporate
- **Blue in the frame.** A blue cup, apron or awning, added sparingly, in real life or in careful retouching
- **Cut-outs.** A subject may break out of a shape for layered compositions. Use this rarely

### Never

- Stock-photo clichés, forced smiles, staged poses
- AI-generated people or AI-generated shops
- Cold colour, bored or upset faces
- Top-down shots of people
- Real customers' data or real card numbers on any screen
- People or shop signs without written permission
- Competitors' logos, or card brands and wallets used without following their rules

---

## 9. Graphic elements

Graphic elements tell the product's story quickly. They all come from the logo or the product itself.

### Blade and Star

The signature device, cut from the symbol:

- **The Blade** is one segment of the symbol, used large. It stands for a visit, and for momentum
- **The Star** is the five-pointed space at the symbol's centre. It marks the reward: the moment things pay off

Together they tell one story: visits build up, and something good comes back.

**Using them**

- The Blade points the eye toward the subject: a phone, a reward, a person
- The Star sits at the point of payoff: the reward, the new points, the confirmation tick
- The symbol has five-fold symmetry, so the Blade only rotates in **72° steps** from its logo position
- One Blade per layout. It may bleed off the edge at large sizes

| On | Blade | Star |
|---|---|---|
| White or Froth | Blue | Blue, or Orange for a reward moment |
| dvote Blue | White or Sky | White or Egg Yolk |
| Night Blue | Blue (subtle, tonal) | White |
| Photo | Blue | White |

**Never**

- Over a face
- More than one Blade in a layout
- Star larger than a person's head
- Stretched or redrawn, or with a colour outside the table
- Rebuilt into a new symbol, or used as a replacement for the logo

### Bento grid

Everything we design sits in rounded blocks. It looks like the product, and it tells complicated stories piece by piece.

| Grid | Cells | Use for |
|---|---|---|
| **Simple** | 2–4 | One message: social posts, posters, slides |
| **Rich** | 5–8 | Several points or a feature story: landing sections, decks |

**Rules**

- Consistent gaps and radius within a layout ([section 12](#12-layout))
- One lead cell, clearly the largest
- Each cell holds one thing: one message, image, number or UI piece
- Keep at least one cell quiet or empty
- Overlaps are rare, for depth only, and must never hide content

### Shapes

Shapes hold colour, images and information, always with the same soft corners. Each comes from the product.

| Shape | Form | Stands for |
|---|---|---|
| **Card** | Rounded rectangle in the proportions of a wallet pass | The customer's card |
| **Point** | Circle | A point earned, a confirmed moment |
| **Stand** | Tall rounded rectangle | The stand on the counter; a person's place in a shop |
| **Tab** | Pill | A tap, an action, a label |

### Icons

**Product icons:** Solar (`@solar-icons/react`), already in the dashboard. Linear by default, Bold Duotone for active navigation. Keep the attribution in `/icon-credits.txt`.

- Use as supplied, on a 24 px grid; 16, 20 and 24 px in UI
- Colour with `currentColor`
- Decorative icons get `aria-hidden`; icon-only buttons get a label
- No gradients on icons

**Brand icons:** for campaigns only. A Solar icon, or simple custom drawing, in a Point on a coloured background. Keep clear space around the Point.

### Software elements

We show the real product to explain it.

| Type | What it is | Use |
|---|---|---|
| **Micro-interactions** | One small moment: "+10 points", "Free latte ready", "Mona joined at Zamalek" | Over a photo or beside a device |
| **Soft UI** | A simplified piece of the interface, in the brand's shapes | To explain a feature at a glance |
| **Real screens** | Exact product screens | On a phone, or alone, to show what's truly there |

**Rules**

- Never over faces
- Never on their own; pair them with a person, a device or a clear headline
- Use fictional shops and names such as Bean There and Mona A.
- Only show features that exist

### Illustration and patterns

The 10 illustrations and 4 patterns in `public/brand` stay, recoloured to this palette ([Rollout](#18-rollout-plan)). Use illustrations for empty states and onboarding, and patterns only as quiet support. Never use both in one view.

### Visual storytelling

A good layout combines four things, working together:

1. **Headline:** one idea, Black weight
2. **Image:** a person, product or real moment
3. **Device:** Blade and Star, or a shape, leading the eye
4. **Proof:** a micro-interaction, a number or a real screen

Before publishing, ask: can someone get the point in three seconds?

---

## 10. Motion

Motion should feel quick, then settle. Everything moves forward.

### Principles

1. **Quick, then calm.** Things arrive with energy and settle so they can be read
2. **Always a positive direction.** Points go up, progress moves forward, checks land
3. **Modelled on touch.** Slides, taps and pushes, like real interaction
4. **One story at a time.** One main movement per moment

### Durations

| Token | Time | Use |
|---|---|---|
| `--duration-micro` | 120 ms | Hover, press, toggle |
| `--duration-small` | 200 ms | Tooltip, dropdown, tab |
| `--duration-medium` | 280 ms | Dialog, drawer, toast |
| `--duration-large` | 400 ms | Page sections, bento entry |
| `--duration-story` | 800 ms | Reward moment, logo sign-off |

**Easing:** `--ease-out` for things entering and responding. `--ease-in-out` for things already on screen moving elsewhere. Avoid linear, except for progress and loaders. Exits should be faster than entrances.

### Signature moves

**The logo build (sign-off, up to 1.5 s).** Five blades arrive one after another, turning a single rotation at most. The Star appears last and the wordmark follows. It tells the story of five visits and one reward. Use it for intros and endings, not in product loading states.

**The reward moment (800 ms).** When points cross a reward: the number counts up, the Star lands with a small overshoot, and the message settles. This is the one place in the product that's allowed some joy. Show it once per reward.

**Points count-up.** Numbers roll upward in under 400 ms. Use tabular figures so nothing jumps.

**Bento entry.** Cells enter from the start edge with a 40–60 ms stagger and gentle easing, and can push each other slightly. In Arabic they enter from the right.

**Headlines.** Type arrives with speed, then rests. Sync it to any voiceover.

**Transitions.** Use a brand shape to wipe between scenes, in under 400 ms.

**Video lower thirds.** A Tab shape with name and role. For big films, the Blade may lead into it.

### In the product

- Motion must confirm or explain something. Never decorate a task
- Till and scanner flows: the result appears in under 200 ms. Speed matters more than charm
- Don't animate a table's data on every refresh
- Loaders appear only after about 300 ms of waiting. Prefer skeletons for page content
- Never use the logo as a spinner

### Reduced motion

`prefers-reduced-motion` must be respected everywhere. Replace movement with a short fade or an instant state change. Numbers appear at their final value. Never autoplay anything that can't be paused.

### Never

- Blades or Stars over faces
- More than one Blade animating at a time
- Animation layered on top of a busy image
- Bouncing, shaking or flashing, except for the single reward overshoot
- Points or numbers animating downward with celebration

---

# Part 3: Design system

The system runs on what dvote already uses: React 19, Tailwind v4 and shadcn/ui (Radix) with Solar icons on the web, and Expo in the staff app.

## 11. Tokens

All values are in [theme.css](theme.css). `apps/dashboard/src/styles.css` stays the source of truth in code, and the token names don't change.

**Never hardcode a hex value in a component.** Use tokens such as `bg-brand`, `text-muted-foreground` and `border-border`.

### Light and dark

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F8F4F1` | `#18100F` | Page |
| `foreground` | `#18100F` | `#F8F4F1` | Text |
| `card` | `#FFFFFF` | `#221816` | Cards |
| `popover` | `#FFFFFF` | `#2B201D` | Menus, dialogs |
| `primary` | `#18100F` | `#F8F4F1` | Strong neutral actions |
| `secondary` | `#EFE9E3` | `#2E2320` | Quiet actions, soft fills |
| `muted-foreground` | `#6B5E57` | `#C2B3A6` | Secondary text |
| `accent` | `#EFE9E3` | `#2E2320` | Hovered rows and menu items |
| `border` | `#E4DCD4` | `#3A2D29` | Decorative lines |
| `input` | `#8C7B6E` | `#8A7B70` | Control borders |
| `ring` | `#1F3DFF` | `#8C9EFF` | Focus |
| `brand` | `#1F3DFF` | `#6F86FF` | Main action, selected |
| `brand-foreground` | `#FFFFFF` | `#18100F` | Text on brand fill |
| `brand-hover` | `#1A36E6` | `#8C9EFF` | Hover |
| `brand-pressed` | `#142AB8` | `#A3B2FF` | Pressed |
| `brand-text` | `#1F3DFF` | `#8C9EFF` | Links, brand-coloured text |
| `brand-soft` | `#E8EBFF` | `#1B2147` | Selected rows, tinted panels |
| `sidebar` | `#F8F4F1` | `#18100F` | Sidebar and page frame |
| `sidebar-primary` | `#E8EBFF` | `#6F86FF` | Active sidebar item |
| `sidebar-primary-foreground` | `#1F3DFF` | `#18100F` | Text on active item |

**Watch out:** the text on a brand fill switches between themes. It's white in light mode and Espresso in dark mode, because blue is too dark to read against Espresso. Always use `text-brand-foreground`, never a fixed colour.

### Spacing

Multiples of 4 px, using the Tailwind scale.

| Step | px | Typical use |
|---|---|---|
| 1 | 4 | Icon to label, tight |
| 2 | 8 | Inside compact controls |
| 3 | 12 | Form field gaps on mobile, bento gap on mobile |
| 4 | 16 | Card padding on mobile, bento gap on desktop |
| 6 | 24 | Card padding on desktop |
| 8 | 32 | Between groups |
| 12 | 48 | Between sections in the product |
| 20 | 80 | Between marketing sections on mobile |
| 30 | 120 | Between marketing sections on desktop |

### Radius

Base `--radius` is 12 px. All Tailwind radius steps derive from it.

| Class | About | Use |
|---|---|---|
| `rounded-sm` | 7 px | Checkbox, small badge |
| `rounded-md` | 10 px | Small controls |
| `rounded-lg` | 12 px | Buttons, inputs |
| `rounded-xl` | 17 px | Product cards, menus |
| `rounded-2xl` | 22 px | Dialogs, large panels |
| `rounded-3xl` | 26 px | Marketing bento cells |
| `rounded-full` | Full | Point, Tab, avatar, pill badges |

**Nesting:** an inner corner equals the outer radius minus the padding between them. Square corners are never used for brand shapes.

### Elevation

The brand is flat first. Use a border before a shadow.

| Level | Use | Style |
|---|---|---|
| 0 | Page, inline cards | None; `border` where needed |
| 1 | Raised cards, sticky bars | `0 1px 3px rgb(24 16 15 / 8%)` |
| 2 | Menus, popovers | `0 8px 24px rgb(24 16 15 / 12%)` |
| 3 | Dialogs | `0 16px 48px rgb(24 16 15 / 18%)` |

In dark mode, raise surfaces with lighter colours rather than shadows.

---

## 12. Layout

### Breakpoints

| Name | Width | Typical layout |
|---|---|---|
| Base | 0+ | One column |
| `sm` | 640+ | Larger phone |
| `md` | 768+ | Tablet, two columns |
| `lg` | 1024+ | Sidebar appears |
| `xl` | 1280+ | Full desktop |

Design from 320 px up. The tests already cover 320 to 2560.

### Containers

- **Marketing:** max 1280 px, side padding 16 px on mobile and 32 px on desktop
- **Reading text:** max 720 px
- **Dashboard content:** fluid, with forms capped at 640 px
- **Customer and staff screens:** max 560 px, centred, 20 px gutter

### Marketing bento grid

- 12 columns on desktop, 6 on tablet, 1 on mobile
- Gap: 16 px on desktop, 12 px on mobile
- Cell padding: 24–32 px on desktop, 20 px on mobile
- Radius: `rounded-3xl` for every cell
- Typical spans: lead 7–8 columns, support 4–5, tiles 3–4
- On mobile, cells stack with the lead first

### Dashboard shell

- Neutral Froth sidebar on `md` and up (Espresso in dark mode); a phone header and bottom bar below that
- Froth canvas, White cards
- One page title per screen, one main action in the top-end corner
- Metric rows are a small bento: equal heights, consistent gaps

---

## 13. Components

Components live in `apps/dashboard/src/components/ui` and are added with `npx shadcn@latest add`.

### Buttons

| Variant | Look | When |
|---|---|---|
| `brand` | Blue fill, white text | **The one main action of a screen or section** |
| `default` | Espresso fill | Strong action when blue is already in use nearby |
| `outline` | Border, no fill | Secondary actions |
| `secondary` | Oat fill | Quiet actions in a group |
| `ghost` | No fill until hover | Toolbars, table rows |
| `destructive` | Red tint | Delete, remove, disable |
| `link` | Blue text | Inline navigation |

**Rules**

- At most one `brand` button in view per task
- Label is a verb and sentence case
- Text weight is Medium
- Icon goes on the start side for actions, end side for moving forward; direction icons mirror in Arabic
- Loading: keep the width, show a spinner, disable repeat clicks

**Sizes**

| Size | Height | Where |
|---|---|---|
| `xs`, `sm` | 24, 28 px | Dense tables on desktop only |
| `default`, `lg` | 32, 36 px | Dashboard |
| Touch | 44 px or more | Anything used on a phone |
| Staff app | 52 px | Till actions |

**States**

| State | Treatment |
|---|---|
| Hover | `brand-hover`, 120 ms |
| Pressed | `brand-pressed` |
| Focus | 2 px `ring`, with 2 px offset |
| Disabled | 50% opacity, `not-allowed` cursor, no hover |

### Forms

- Always a visible label, in sentence case. Placeholders are examples, never labels
- Border uses `input` (Stone), so the field meets 3:1
- Focus uses `ring`
- Errors: red border, an icon and a message saying how to fix it, placed below the field
- Hints in `muted-foreground`
- Show required or optional, whichever is rarer
- Autosave where the product already does: say "Saved", and show failures clearly
- Phone numbers, codes and money use `dir="ltr"` inside Arabic forms

### Cards

- White on Froth, `rounded-xl`, 1 px `border`, 16–24 px padding
- One purpose per card. Title in Bold 18
- Clickable cards have a hover and focus state, and only one main link
- Never nest a card inside a card; use a soft fill instead

### Badges

| Purpose | Style |
|---|---|
| Status | Soft status background with status text |
| Selected, new | `brand-soft` with `brand-text` |
| Reward, highlight | Egg Yolk or Orange fill with Espresso text |
| Plan name | Oat fill with Espresso text |

Always include a word. Colour alone never carries the meaning.

### Tables

- Header: `muted-foreground`, Medium 12–14, sentence case
- Rows: Regular 14, `border` between rows, `accent` on hover
- Numbers: tabular figures, aligned to the end edge
- Row actions: `ghost`, grouped on the end side
- On phones, collapse to stacked cards
- Empty: use an empty state, not a blank table

### Navigation

- **Sidebar item:** Espresso text on Froth. Hover uses Oat. Active uses a Blue Tint fill with Blue text and the Bold Duotone icon
- **Tabs:** an underline or a filled pill, with blue marking the active one
- **Breadcrumbs:** only on pages two or more levels deep
- **Locked features:** stay visible, with a lock and "See plans"

### Dialogs and drawers

- Use a dialog for a short decision, a drawer for longer detail or forms
- Dialog: `rounded-2xl`, title that states the decision, buttons named for the outcome ("Delete reward", not "OK")
- Phones: bottom sheet, full width, rounded top corners only
- Scrim: Espresso at 50%
- Focus stays inside, and Escape closes it, unless data would be lost

### Toasts and alerts

- **Toast (Sonner):** brief confirmation, closes by itself, one at a time
- **Inline alert:** something that needs reading or action. It stays until resolved
- Errors never appear only in a toast

### Empty states

An illustration, one line on what belongs here, and one action. "No rewards yet. Add your first one." Never blame the user.

### Loading

Skeletons in `muted` for page content; spinners inside buttons. Don't show either for under 300 ms.

### Wallet card

- Merchant's logo and colour first
- Points are the largest thing on the card, followed by the next reward
- **Default card, with no merchant colour:** stays Espresso for now. The code can't tell new merchants from existing ones, so changing it would also change live Wallet passes ([Open decisions](#20-open-decisions))
- The 10 numbered designs stay exactly as they are

### QR stand

- Physical object: Print Blue or White, with the merchant's name and logo
- QR at least 30 mm with its full quiet zone. Scan-test every print run on iPhone and Android
- One instruction: "Tap or scan to join"
- dvote symbol small, on the back or at the base

---

## 14. Data visualisation

Charts should be clear at a glance and feel like the rest of the brand.

### Colour order

| Series | Light | Dark |
|---|---|---|
| 1 (lead) | Blue `#1F3DFF` | `#8C9EFF` |
| 2 | Orange `#FF5500` | `#FF5500` |
| 3 | Plum `#5F2B4B` | `#E3A9C9` |
| 4 | River `#1C86D1` | Sky `#6EC1FF` |
| 5 | Pine `#2E8B62` | Mint `#B8D9C5` |

River and Pine are chart-only colours, darker versions of Sky and Mint that hold 3:1 on white.

### Rules

- Start with one colour. Use a single Blue series, and add more only when comparing categories
- Soft corners on bars (4–6 px) and rounded line ends
- Strong contrast: at least 3:1 for marks against the background
- Label series directly where possible; never rely on the legend's colour alone
- Red only for negative values. Never as an ordinary series colour
- Light grid lines in `border`, and few of them
- Tabular figures, with units in the label: "EGP", "visits"
- Show comparisons honestly. Bars start at zero
- Provide a text summary or table for key charts

### Formats

| Type | Use |
|---|---|
| **Hero metric** | One big number in Black, with a small trend. "Repeat rate, last 30 days" |
| **Dashboard bento** | Mixed metric cards, with one Blue-filled card as the lead at most |
| **Line, bar** | Trends and comparisons |
| **Ring** | Progress to one reward. Not for comparing categories |
| **Timeline, process** | Numbered steps, icons in Points, joined by a line. Reverses in Arabic |

**Slides and Google Sheets:** use the same colour order, and round the corners where the tool allows it.

---

## 15. Accessibility

Accessibility is a rule of this brand, not an extra.

**Minimums (WCAG 2.2 AA)**

- Text at 4.5:1. Large text (24 px, or 19 px bold) at 3:1
- Icons, control borders, focus rings and chart marks at 3:1
- Targets at least 24 × 24 px on desktop, 44 × 44 px on touch
- Full keyboard use, with a visible focus ring everywhere
- Labels on every field and icon-only button
- Never colour alone for meaning: pair it with text or an icon
- Text resizes to 200% without loss
- `prefers-reduced-motion` respected
- `lang` and `dir` set correctly for Arabic

**Verified:** [contrast-audit.py](contrast-audit.py) checks all approved pairs ([Appendix B](#appendix-b-audit-results)). Those ratios only cover the colours. They don't replace testing screens with a keyboard and a screen reader.

---

## 16. The merchant's brand

dvote is unusual: most of what customers see belongs to someone else. So there are two layers.

| Surface | Whose brand leads | dvote's role |
|---|---|---|
| Landing page, sales, social | dvote | Full brand |
| Dashboard, staff app | dvote | Full brand; merchant's logo in the account area |
| Emails from dvote | dvote | Full brand |
| Storefront (`m.dvote.co/<slug>`) | Merchant | "Powered by dvote" footer, on the Regular plan only |
| Wallet card | Merchant | Follows the plan: Loyal and Chain can hide dvote branding |
| QR stand | Merchant first | Small symbol |
| Messages to customers | Merchant | None |

**Rules**

- Merchant colours (`brand_primary`, `brand_secondary`) and fonts replace dvote's on merchant surfaces. Blue must not leak in there, apart from the footer
- The existing rule stays: icons and coloured text use `accent`, which falls back to dark ink when the merchant's colour is too light to read
- Status colours and focus rings stay readable whatever colour the merchant picks
- "Powered by dvote" is small, in `muted-foreground` text with the symbol at no less than 24 px, and it never competes with the merchant
- In marketing, use fictional merchants only, unless a real merchant has agreed in writing

---

# Part 4: Applications and rollout

## 17. Applications

### Landing page (dvote.co)

- **Hero:** a full dvote Blue section with a white logo, a Black headline, a Light subhead and one white button with Blue text. The working demo phone stays as the proof
- **Frame, header and footer:** neutral Espresso
- **Below the hero:** White and Froth sections with bento grids, with blue kept to buttons and small accents
- **Accents:** a Star at the reward point in the demo; an Egg Yolk "+10 points"

### Social

- **Square and story:** Simple bento, one idea, one image or UI moment
- **Sequence:** rotate Blue-led, photo-led and white-led posts so the feed stays lively
- Always publish Arabic versions, designed rather than auto-translated
- Avatar: white symbol on Blue

### Emails

- White card on a neutral Espresso frame; logo at the top, one headline, one Blue button with white text
- Rebuild from `docs/email-templates/src/`
- Live text, at least 16 px on phones. Fonts fall back to Arial and Tahoma
- Include a visible address in plain text as well as the button

### Presentations

- **Cover:** Blue, white logo, Black title, one Blade
- **Content:** White, title top-start, bento body, one idea per slide
- **Closing:** Blue, rally cry and contact details

### Print and stationery

- Stand, counter poster, business card, sticker
- Solid colours only, no gradients
- Prove every first run ([section 6](#print))

### Merchandise

Single-colour marks: white on Blue, Blue on white. A cup, apron or tote should look good enough to use at a shop. Embroidery uses the solid symbol, at no less than 25 mm.

---

## 18. Rollout plan

Do this as a single coordinated change. Half-orange, half-blue surfaces would look broken. The plan below assumes approval of this guide.

### Phase 1: decide and produce assets

1. Approve the rally cry ([Open decisions](#20-open-decisions)). The hero colour and fonts are already decided
2. Trademark check on the blue-led identity and the rally cry
3. Export new logo files: all versions listed in [section 5](#5-logo), plus app icons and favicon
4. Draw Blade and Star artwork from the master logo
5. Native Arabic review of copy

### Phase 2: change the code

Colours are hardcoded in these places, found by searching for `#FF5500` and `#18100F`:

| Place | Files | Change |
|---|---|---|
| Dashboard tokens (source of truth) | `apps/dashboard/src/styles.css` | Values from `theme.css`; fixed colours added and retired |
| Landing tokens | `apps/landing/src/styles.css` | Same |
| Customer web tokens | `apps/web/src/styles.css` | Same |
| Staff app | `apps/staff/src/lib/theme.ts` | Same, native values |
| Card defaults | `apps/dashboard/src/lib/cardDesigns.ts`, `apps/web/src/lib/cardDesigns.ts`, `apps/api/src/loyalty-cards/card-design.ts` (`DVOTE_CARD_COLOR`) | Unchanged until decision 5. Keep the 10 numbered designs |
| Illustrations and patterns | 14 SVGs each in `apps/dashboard/public/brand` and `apps/landing/public/brand` | Recolour, and keep both folders identical |
| Favicons | `apps/*/public` | Replace |
| Email templates | `docs/email-templates/src/` | Change, then rebuild with `build-assets.mjs` and `build-templates.mjs` |
| Logo components | `dvote-logo` and `markColor` usage | Blue mark on light, white on blue |
| Fonts | `index.html` in dashboard, landing and web; `apps/staff/src/app/_layout.tsx` and `theme.ts` in staff | DM Sans and Alexandria. Replace Inter, Cairo and IBM Plex Sans Arabic |
| Project notes | `CLAUDE.md`, "Brand colours" section | Record v3.0 |

**Things that will catch you out**

- **`brand-foreground` flips.** Espresso text on Blue fails at 2.83:1, so light mode must move to white. Search for any place that assumes dark text on a brand fill
- **Default cards.** `DVOTE_CARD_COLOR` is a fallback, not saved per merchant, so changing it updates every merchant without a chosen design, and their customers' Wallet passes on the next sync. That's why it hasn't changed
- **Merchant previews.** Check the storefront editor's phone preview, which themes the page with the shop's colours
- **Retired colours.** Latte, Cortado and Shortcake are defined in the `styles.css` files and used in the SVGs. No component class uses them today, so remove the definitions and recolour the SVGs
- **Info messages.** `info` moves from Plum to Night Blue, so check that info badges don't read as selected states
- **Visual tests.** `apps/ui-tests` needs a fresh baseline run

### Phase 3: check and ship

1. Run `contrast-audit.py`, typecheck, and the test suites
2. Review every app in light, dark, English and Arabic, at 320 px and 1440 px
3. Print-test one stand and one poster
4. Test a real Wallet pass
5. Open the PR. Merging to `develop` needs Karim's approval
6. Update social avatars, then announce

---

## 19. Release checklist

Run this before anything goes out.

**Brand**

- [ ] It reads as dvote, and uses approved logo files at or above minimum size, with clear space
- [ ] `dvote` is lowercase
- [ ] Rally cry is exact and used once at most
- [ ] Claims are true today; no invented numbers

**Colour and type**

- [ ] Mostly White on brand surfaces, one blue block per view; accents at 5–15%
- [ ] Product screens are neutral: blue only on actions, active states, links, focus and lead charts
- [ ] Two or more accents? Sky is one of them
- [ ] Red only for negative meaning
- [ ] No gradient outside the Blade
- [ ] Headlines in DM Sans or Alexandria Black, in sentence case
- [ ] No Light text under 18 px

**Language**

- [ ] Arabic reviewed by a native speaker, layout mirrored
- [ ] Short, active sentences, with no jargon

**Product**

- [ ] Tokens only, no hex values
- [ ] One `brand` action per task
- [ ] Light, dark, English and Arabic all checked
- [ ] Keyboard and reduced motion work
- [ ] Merchant surfaces show the merchant's brand

---

## 20. Open decisions

Decision 1 is closed, and the fonts are decided: DM Sans and Alexandria. The others still need a person's decision. Everything else in this guide is ready to apply.

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Hero colour.** | **Decided 5 November 2026: dvote Blue `#1F3DFF`.** It's in the same family as the reference, deliberately not the same value |
| 2 | **Legal check.** Global Payments is a blue-led brand in merchant payments, and its guide also mentions loyalty points. dvote would be a nearby blue | Ask a trademark lawyer before launch. Warm neutrals, orange and the logo add distance, but this guide isn't legal advice |
| 3 | **Apple Wallet claim.** The landing page offers it now; `CLAUDE.md` says Apple passes aren't built | Confirm the status. If still pending, change the landing copy before this rebrand goes out |
| 4 | **Rally cry.** "Good things come back." and its Arabic | Approve after native review and a trademark search |
| 5 | **Default card colour.** Move default cards from Espresso to Blue? | Keep Espresso until decided. A change reaches every merchant without a chosen design, and their customers' passes |
| 6 | **Print values.** Print Blue CMYK and Pantones are not yet tested | Get a proof from the stand's printer |
| 7 | **Favicon.** A 16 px version of the symbol doesn't exist | Draw a simplified one |
| 8 | **Photo library.** None exists yet | Plan a small shoot at two or three real merchants |

---

## Appendix A: what came from the reference

The Global Payments guide states that its brand assets are proprietary, so this guide follows its method and not its assets.

| Reference idea | How dvote uses it |
|---|---|
| Positioning framework: simple description, challenge, three benefits, proof | Same structure, dvote's content |
| Rally cry as a fixed asset, with exact writing rules | "Good things come back." |
| Voice built on two poles | At the counter, On the lock screen |
| Boilerplate and brand narrative as separate tools | Written for dvote |
| Primary, secondary and photo logo versions; clear space; minimum sizes; optical centring | Applied to the dvote logo. Measures are dvote's own |
| Logo-derived device with a meaningful angle | Blade and Star; 72° from the symbol's geometry |
| One hero with white, plus depth, near-black, accents and neutrals | dvote's own colours |
| A connector accent, and red for negative only | Sky rule, red rule |
| 50% white or hero, accents 5–15% | Adopted |
| Black headlines, Light subheads, Regular body, 150% leading, 1.414 scale | Adopted, in DM Sans and Alexandria, with limits for product and Arabic |
| Bento grid and soft shapes with meanings | Card, Point, Stand, Tab |
| Micro-interactions, soft UI and real screens | Adopted, using dvote's product moments |
| Warm, candid photography with no AI portraits | Adopted, set in real local shops |
| Motion: quick then settled, positive direction, one signature move | Adopted with dvote's five-blades story |

**Never copy from the reference:**

- The Global Payments logo, wordmark or `g` symbol
- The Arc and Ping, or the 23.5° angle
- The GP Commerce typeface
- The phrase "Already on it." or lines from its guide
- Its images, icons, templates or sound
- Its exact colour values, including `#262AFF` and `#1B1EC6`
- Its names for colours and shapes

**The reference had limits.** Its web type sizes appear mostly as images, so the sizes here combine the stated 1.414 ratio with what its pages actually render (64, 48, 32 and 16 px). Its motion examples are videos, so dvote's durations and easing are original, not measured.

---

## Appendix B: audit results

Recalculate with `python3 contrast-audit.py`. Last run: 5 November 2026. All 53 approved pairs passed, and the 6 banned pairs were confirmed below 4.5:1. The key pairs:

| Pair | Ratio | Needs |
|---|---|---|
| White on Blue | 6.63 | 4.5 |
| White on Blue hover | 7.74 | 4.5 |
| White on Night Blue | 10.23 | 4.5 |
| Blue on White | 6.63 | 4.5 |
| Blue on Froth | 6.06 | 4.5 |
| Blue on Blue Tint | 5.60 | 4.5 |
| Espresso on White | 18.75 | 4.5 |
| Espresso on Froth | 17.15 | 4.5 |
| Espresso on Oat | 15.57 | 4.5 |
| Taupe on White | 6.24 | 4.5 |
| Taupe on Froth | 5.71 | 4.5 |
| Taupe on Oat | 5.18 | 4.5 |
| Espresso on Sky | 9.59 | 4.5 |
| Espresso on Orange | 5.85 | 4.5 |
| Espresso on Egg Yolk | 12.32 | 4.5 |
| Espresso on Mint | 12.30 | 4.5 |
| White on Plum | 10.86 | 4.5 |
| Stone border on White | 4.06 | 3.0 |
| Stone border on Froth | 3.71 | 3.0 |
| Dark: Froth on card | 15.87 | 4.5 |
| Dark: Espresso on brand fill | 5.83 | 4.5 |
| Dark: brand text on card | 6.98 | 4.5 |
| Chart Orange on White | 3.21 | 3.0 |
| Chart River on White | 3.90 | 3.0 |
| Chart Pine on White | 4.21 | 3.0 |

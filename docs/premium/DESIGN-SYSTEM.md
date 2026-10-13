# Wayfarer — Cinematic Editorial Motion System

## Creative direction

This is an experience-led travel planning product, **not** a decorative landing page or game. Keep the editorial composition, substantive photography, legible layout and accurate data states. Motion should orient, reveal or confirm; it should never conceal essential information or pretend an agent is working when it is not.

## Visual language

- **Palette:** deep forest `#071a17`, evergreen `#173f34`, warm ivory `#f5f0e6`, parchment `#e9e2d5`, muted wine `#6c3040`, understated brass `#c7a86a`.
- **Typography:** Manrope for display / interface, DM Sans for body, Playfair Display italic for occasional editorial emphasis. System fallback fonts must remain usable if the remote font does not load.
- **Composition:** decisive full-screen image and oversized hero lettering; deliberate negative space and proportion. Keep photography authentic, not wireframe globes, noisy particles or generic sci-fi dashboards.
- **Surface treatment:** deep green functional panels, warm white working surfaces. Use translucent surfaces sparingly, primarily for fixed navigation and contextual metadata. Prefer explicit borders over stacked glow.
- **Controls:** consistent 6–9px radii on interface controls. Existing image assets and business logic remain unchanged except for the honest disconnected-provider message.

## Motion choreography

| Element | Behavior | Intent |
|---|---|---|
| Hero | Staggered heading/copy/CTA entrance, ~1.05 s, easing `(0.22,1,0.36,1)` | Editorial opening, once on load |
| Hero photograph | Scroll-linked vertical offset, capped at 55 px; `requestAnimationFrame` and passive listener | Cinematic depth without aggressive parallax |
| Narrative cue | Fine moving line, not a loading spinner | Suggest exploration, can be disabled |
| Primary navigation | Restrained focus/active change and 0.62 s view transition | Maintain app continuity |
| Destination cards | Small image scale and saturation increase | Reveal image detail, don't tilt the card |
| Itinerary cards | 3 px hover lift | Show affordance |
| Agent cards | Thin animated sweep **only in actual waiting state** | Truthful operation status |
| Progress line | Linear scroll-reading indicator | Provide orientation |

## Accessibility & performance principles

- Use semantic buttons and landmarks; `Skip to content` is keyboard reachable.
- Route changes focus the active section's H1; current navigation includes `aria-current=page`.
- Selection chips advertise `aria-pressed`; agent/source status remains visible as text, not color alone.
- Every animation is optional and stopped by `prefers-reduced-motion: reduce`. A persistent manual Motion control is also available on desktop.
- Real content never depends on motion finishing. No required WebGL or paid animation packages.
- Transitions favor `transform` and `opacity`, never scroll-jacking or continuously animated background filters. Images already used by the source project remain unchanged.
- Long descriptions and source/status messages have larger, more legible type than the recovered baseline.
- The free development target depends on available hosting quotas and third-party provider terms; don't promise unlimited usage.

## Trust boundaries

- Do not call suggestions "verified flights," "guaranteed seats" or "booked hotels."
- Three public-source tool calls and the Groq composer retain their original server-side integration.
- The retired Amadeus Self-Service hotel adapter was replaced by a fail-closed status endpoint. **Real price inventory is not connected in this visual preview.** Future SerpApi integration must be gated server-side and tested before live-price claims.
- Never expose credentials, PII, private booking references or provider keys in the browser bundle.

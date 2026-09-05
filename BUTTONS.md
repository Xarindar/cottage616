# Buttons

All customer-facing actions use `styles/components/buttons.css`, loaded after the page styles. Its tokens are the single source for color, typography, spacing, radius, hover, focus, and disabled states. Page classes only control placement and width.

| Classes | Use |
| --- | --- |
| `button button--primary` | Main actions: booking, selecting a service, confirmation. |
| `button button--secondary` | Supporting actions: explore vendors, contact a vendor, go back. |
| `button button--text` | Low-emphasis actions: show details, close, clear a filter. |
| `button button--inverse` | Primary action on a dark background. |
| `button--small` | Compact placement; keeps a 44px minimum touch target. |
| `button--icon` | Icon-only action, with an accessible name. Combine with a color variant. |

Use sentence case, short labels, and an optional small icon. Use links for navigation and buttons for actions. Retain native `disabled`, `aria-pressed`, and `[hidden]` behavior. An `aria-disabled` link also needs its activation prevented by the owning component.

Calendar dates, category cards, menu toggles, and carousel pagination retain the layout required by their interaction. Their colors, corners, focus, and touch-target sizes use the shared tokens where applicable. They are selection or navigation controls, not additional call-to-action variants.

Do not add page-specific button fills, pills, shadows, lift animations, or uppercase typography. Add a shared variant here only when an existing variant cannot express the action's purpose.

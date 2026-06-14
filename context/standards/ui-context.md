# UI Context

## Theme
Tactical / HUD environment. The overlay feels like a developer tool or an aeronautical interface. It utilizes high-contrast wireframes, deep dark translucent backgrounds, and vivid data-driven accents.

## Colors
| Role | CSS Variable | Value |
| --- | --- | --- |
| Overlay Backdrop | `--bg-overlay` | `rgba(0, 0, 0, 0.4)` |
| Widget Surface | `--bg-surface` | `#0F0F0F` |
| Primary Text | `--text-primary` | `#E0E0E0` |
| Accent (Terminal) | `--accent-green` | `#4AF626` |
| Accent (Warning) | `--accent-amber` | `#FFB000` |
| Border | `--border-wire` | `rgba(255, 255, 255, 0.15)` |

## Typography
| Role | Font | CSS Variable |
| --- | --- | --- |
| Headers & Data | JetBrains Mono | `--font-mono` |
| Body Text | Inter / Geist | `--font-sans` |

### Unified Font Scale
- **Large Titles / Widget Headers**: `text-sm font-bold uppercase tracking-widest` (14px)
- **Subheaders / Group Labels**: `text-xs font-bold uppercase tracking-wider` (12px)
- **HUD Readouts / Chat Messages / Key-Value Data**: `text-xs font-mono` (12px)
- **Settings Info / Secondary Descriptions / Help Copy**: `text-xs text-zinc-400 font-sans` (12px)
- **Terminal logs / Telemetry**: `text-xs font-mono text-zinc-400` (12px)

## Layout Customization variables
- `--widget-border-radius`: Border radius applied to widgets (0px to 24px)
- `--widget-border-width`: Border line width (1px to 4px)
- `--widget-border-opacity`: Opacity of the `--border-wire` color (0.05 to 0.8)
- `--widget-glow-size`: Accent green shadow spread size (0px to 30px)
- `--widget-glow-opacity`: Accent shadow translucency (0 to 1.0)

## Layout Patterns
- **Widget Menu:** A fixed dock at the bottom or top center of the screen containing toggleable icons for each widget.
- **Widget Container:** A resizable box with a draggable header (only visible when unpinned).
- **Pinning:** Clicking the "Pin" icon hides the container's border and header, leaving only the data floating on screen.
- **Solid Backgrounds:** Widgets use solid backgrounds for readability against busy gaming scenes (glassmorphism removed).
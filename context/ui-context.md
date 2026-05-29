# UI Context

## Theme
Tactical / HUD environment. The overlay feels like a developer tool or an aeronautical interface. It utilizes high-contrast wireframes, deep dark translucent backgrounds, and vivid data-driven accents.

## Colors
| Role | CSS Variable | Value |
| --- | --- | --- |
| Overlay Backdrop | `--bg-overlay` | `rgba(0, 0, 0, 0.4)` |
| Widget Surface | `--bg-surface` | `rgba(15, 15, 15, 0.8)` |
| Primary Text | `--text-primary` | `#E0E0E0` |
| Accent (Terminal) | `--accent-green` | `#4AF626` |
| Accent (Warning) | `--accent-amber` | `#FFB000` |
| Border | `--border-wire` | `rgba(255, 255, 255, 0.15)` |

## Typography
| Role | Font | CSS Variable |
| --- | --- | --- |
| Headers & Data | JetBrains Mono | `--font-mono` |
| Body Text | Inter / Geist | `--font-sans` |

## Layout Patterns
- **Widget Menu:** A fixed dock at the bottom or top center of the screen containing toggleable icons for each widget.
- **Widget Container:** A resizable box with a draggable header (only visible when unpinned).
- **Pinning:** Clicking the "Pin" icon removes the widget border and background blur, leaving only the data floating on screen.
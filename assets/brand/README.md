# Typograph brand assets

The artwork was exported and supplied by Caleb. These files are used as supplied; the website does not redraw or resize the exported artwork during its build.

## Website assets

Files in `apps/playground/public` are copied into the deployed site by Vite.

| File                                       | Use                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `favicon.svg`                              | The only browser-tab icon: the 48px light and dark vector exports in one file, switched by `prefers-color-scheme` |
| `apple-touch-icon.png`                     | 180px Apple home-screen icon                                                                                      |
| `icons/icon-192.png`, `icons/icon-512.png` | General-purpose icons declared in `site.webmanifest`                                                              |
| `icons/icon-maskable-512.png`              | Separate maskable icon with the exported safe area                                                                |
| `social.png`                               | Primary 1200 × 630 Open Graph and Twitter card                                                                    |
| `social-square.png`                        | Alternate 1200 × 1200 Open Graph card                                                                             |
| `brand/avatar.png`                         | 512px avatar for project listings and profiles                                                                    |

The manifest uses browser display mode. It supplies names and icons without adding a service worker, offline behavior, or an install prompt. The wide social card is listed first; consumers choose which Open Graph image to use.

`favicon.svg` is the light export's path with a `<style>` block that strokes it `#2B3222`, or `#C5EE58` when the browser is dark; the dark export differs only in that color. Browsers without SVG favicon support fall back to their default tab icon. Icons and social cards are maintained through design exports from the Figma source.

## Master exports

This directory stays outside the public website output. `app-icon-1024.png` and `icon-maskable-1024.png` preserve the larger master exports. `favicon-light-*.svg` and `favicon-dark-*.svg` preserve the 16, 32, and 48px vector exports for each theme.

The avatar and both social cards can also be used directly on the personal website's Typograph project listing. Their deployed paths are `/brand/avatar.png`, `/social.png`, and `/social-square.png` on `https://typograph.dev`.

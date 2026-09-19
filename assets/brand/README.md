# Typograph brand assets

The artwork was exported and supplied by Caleb. These files are used as supplied; the website does not redraw or resize the exported artwork during its build.

## Website assets

Files in `apps/playground/public` are copied into the deployed site by Vite.

| File                                                 | Use                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `favicon.svg`                                        | Scalable browser icon, from the 48px vector export              |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Original raster exports for browser tabs and bookmarks          |
| `favicon.ico`                                        | The three raster exports packaged together for browser fallback |
| `apple-touch-icon.png`                               | 180px Apple home-screen icon                                    |
| `icons/icon-192.png`, `icons/icon-512.png`           | General-purpose icons declared in `site.webmanifest`            |
| `icons/icon-maskable-512.png`                        | Separate maskable icon with the exported safe area              |
| `social.png`                                         | Primary 1200 × 630 Open Graph and Twitter card                  |
| `social-square.png`                                  | Alternate 1200 × 1200 Open Graph card                           |
| `brand/avatar.png`                                   | 512px avatar for project listings and profiles                  |

The manifest uses browser display mode. It supplies names and icons without adding a service worker, offline behavior, or an install prompt. The wide social card is listed first; consumers choose which Open Graph image to use.

After replacing the small PNG exports, run `npm run build:icons` to regenerate `favicon.ico`. The script packages the PNG bytes without re-encoding them. Social cards are maintained through design exports, replacing the older generated artwork.

## Master exports

This directory stays outside the public website output. `app-icon-1024.png` and `icon-maskable-1024.png` preserve the larger master exports. `favicon-16.svg` and `favicon-32.svg` preserve the additional small vector exports. The live 48px vector is `apps/playground/public/favicon.svg`.

The avatar and both social cards can also be used directly on the personal website's Typograph project listing. Their deployed paths are `/brand/avatar.png`, `/social.png`, and `/social-square.png` on `https://typograph.dev`.

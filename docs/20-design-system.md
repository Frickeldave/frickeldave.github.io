# Design system

The goal is to design the website uniformly and eliminate all design inconsistencies. Additionally, I have the idea that Home, Blogs, Downloads, Portfolio, Handmade, and News each get their own design system, which is based on the main design system of the site.

General design specifications:
- Spacing, margins, shadows, rounded corners, etc. remain as in the main design system of the site
- Font families, font sizes, line heights, etc. remain as in the main design system of the site
- The color schemes of the individual design systems must stand out well from each other but still harmonize together

Headers and footers remain the same across all pages.

A Glass-Box component should be used on each page to highlight content.

On each page, a Glass-Box with the page title should be used first. Furthermore, a breadcrumb navigation should be integrated in the Glass-Box to show the path to the current page (e.g., Home / Portfolio).

## Design System - Turquoise - Home Page and Handmade Page

The home page and handmade page use a consistent **turquoise** color scheme for all highlights and accents. This color scheme must be maintained in all future changes.

### Color Palette (Tailwind CSS)
- **Primary Gradient**: `from-cyan-500 to-teal-500` (Buttons, important accents)
- **Hover Gradient**: `from-cyan-600 to-teal-600`
- **Text Accents**: `text-cyan-500`, `text-cyan-600`, `text-cyan-400` (dark)
- **Badge Background**: `from-cyan-500/20 to-teal-500/20`
- **Badge Text**: `text-cyan-700 dark:text-cyan-300`
- **Borders**: `border-cyan-500`, `border-cyan-500/30`, `border-teal-500/30`
- **Glow Effect (Profile Image)**: `from-cyan-500 via-teal -500 to-blue-500`

### Application in Components
| Element | Color |
|---------|--------|
| CTA Buttons | `bg-gradient-to-r from-cyan-500 to-teal-500` |
| Hover Effects | `hover:from-cyan-600 hover:to-teal-600` |
| Badges/Tags | `from-cyan-500/20 to-teal-500/20` with `text-cyan-700` |
| Bullet Points | `text-cyan-500` |
| Companies/Links | `text-cyan-600 dark:text-cyan-400` |
| Border-Left (Quote/Education) | `border-cyan-500` |
| Social Link Icons | `text-cyan-500 group-hover:text-cyan-400` |
| Timeline Indicators | `from-cyan-500 to-teal-500` |
| Sidebar Icons (Search, Filter, etc.) | `text-cyan-500` |

### Forbidden Colors
- ❌ `orange-500`, `orange-600`, `red-500`, `red-600` for highlights
- ❌ Other primary colors besides turquoise for accents

## Design System - Purple - Blog Page
The blog page uses a consistent **purple/violet** color scheme for all highlights and accents. This color scheme must be maintained in all future changes.

### Color Palette (Tailwind CSS)
- **Primary Gradient**: `from-purple-500 to-violet-500` (Buttons, important accents)
- **Hover Gradient**: `from-purple-600 to-violet-600`
- **Text Accents**: `text-purple-500`, `text-purple-600`, `text-purple-400` (dark)
- **Badge Background**: `from-purple-500/20 to-violet-500/20`
- **Badge Text**: `text-purple-700 dark:text-purple-300`
- **Borders**: `border-purple-500`, `border-purple-500/30`, `border-violet-500/30`
- **Glow Effect (Profile Image)**: `from-purple-500 via-violet-500 to-pink-500`

### Application in Components
| Element | Color |
|---------|--------|
| CTA Buttons | `bg-gradient-to-r from-purple-500 to-violet-500` |
| Hover Effects | `hover:from-purple-600 hover:to-violet-600` |
| Badges/Tags | `from-purple-500/20 to-violet-500/20` with `text-purple-700` |
| Bullet Points | `text-purple-500` |
| Companies/Links | `text-purple-600 dark:text-purple-400` |
| Border-Left (Quote/Education) | `border-purple-500` |
| Social Link Icons | `text-purple-500 group-hover:text-purple-400` |
| Timeline Indicators | `from-purple-500 to-violet-500` |
| Sidebar Icons (Search, Filter, etc.) | `text-purple-500` |

### Forbidden Colors
- ❌ `green-500`, `green-600`, `yellow-500`, `yellow-600` for highlights
- ❌ Other primary colors besides purple/violet for accents

## Design System - Green Highlight - Download Page
The download page uses a consistent **green** color scheme for all highlights and accents. This color scheme must be maintained in all future changes.
### Color Palette (Tailwind CSS)
- **Primary Gradient**: `from-green-500 to-lime-500` (Buttons, important accents)
- **Hover Gradient**: `from-green-600 to-lime-600`
- **Text Accents**: `text-green-500`, `text-green-600`, `text-green-400` (dark)
- **Badge Background**: `from-green-500/20 to-lime-500/20`
- **Badge Text**: `text-green-700 dark:text-green-300`
- **Borders**: `border-green-500`, `border-green-500/30`, `border-lime-500/30`
- **Glow Effect (Profile Image)**: `from-green-500 via-lime-500 to-yellow-500`

### Application in Components
| Element | Color |
|---------|--------|
| CTA Buttons | `bg-gradient-to-r from-green-500 to-lime-500` |
| Hover Effects | `hover:from-green-600 hover:to-lime-600` |
| Badges/Tags | `from-green-500/20 to-lime-500/20` with `text-green-700` |
| Bullet Points | `text-green-500` |
| Companies/Links | `text-green-600 dark:text-green-400` |
| Border-Left (Quote/Education) | `border-green-500` |
| Social Link Icons | `text-green-500 group-hover:text-green-400` |
| Timeline Indicators | `from-green-500 to-lime-500` |
| Sidebar Icons (Search, Filter, etc.) | `text-green-500` |

### Forbidden Colors
- ❌ `purple-500`, `purple-600`, `pink-500`, `pink-600` for highlights
- ❌ Other primary colors besides green for accents

## Design System - Orange/Amber Highlight - Portfolio Page

The portfolio page uses a consistent **orange/amber** color scheme for all highlights and accents. This color scheme must be maintained in all future changes.

### Color Palette (Tailwind CSS)
- **Primary Gradient**: `from-amber-500 to-orange-500` (Buttons, important accents)
- **Hover Gradient**: `from-amber-600 to-orange-600`
- **Text Accents**: `text-amber-500`, `text-amber-600`, `text-amber-400` (dark)
- **Badge Background**: `from-amber-500/20 to-orange-500/20`
- **Badge Text**: `text-amber-700 dark:text-amber-300`
- **Borders**: `border-amber-500`, `border-amber-500/30`, `border-orange-500/30`
- **Glow Effect (Profile Image)**: `from-amber-500 via-orange-500 to-red-500`

### Application in Components
| Element | Color |
|---------|--------|
| CTA Buttons | `bg-gradient-to-r from-amber-500 to-orange-500` |
| Hover Effects | `hover:from-amber-600 hover:to-orange-600` |
| Badges/Tags | `from-amber-500/20 to-orange-500/20` with `text-amber-700` |
| Bullet Points | `text-amber-500` |
| Companies/Links | `text-amber-600 dark:text-amber-400` |
| Border-Left (Quote/Education) | `border-amber-500` |
| Social Link Icons | `text-amber-500 group-hover:text-amber-400` |
| Timeline Indicators | `from-amber-500 to-orange-500` |
| Sidebar Icons (Search, Filter, etc.) | `text-amber-500` |

### Forbidden Colors
- ❌ `blue-500`, `blue-600`, `purple-500`, `purple-600` for highlights
- ❌ Other primary colors besides orange/amber for accents

## Design System - Red - News Page
The news page uses a consistent **red** color scheme for all highlights and accents. This color scheme must be maintained in all future changes.

### Color Palette (Tailwind CSS)
- **Primary Gradient**: `from-red-500 to-pink-500` (Buttons, important accents)
- **Hover Gradient**: `from-red-600 to-pink-600`
- **Text Accents**: `text-red-500`, `text-red-600`, `text-red-400` (dark)
- **Badge Background**: `from-red-500/20 to-pink-500/20`
- **Badge Text**: `text-red-700 dark:text-red-300`
- **Borders**: `border-red-500`, `border-red-500/30`, `border-pink-500/30`
- **Glow Effect (Profile Image)**: `from-red-500 via-pink-500 to-purple-500`

### Application in Components
| Element | Color |
|---------|--------|
| CTA Buttons | `bg-gradient-to-r from-red-500 to-pink-500` |
| Hover Effects | `hover:from-red-600 hover:to-pink-600` |
| Badges/Tags | `from-red-500/20 to-pink-500/20` with `text-red-700` |
| Bullet Points | `text-red-500` |
| Companies/Links | `text-red-600 dark:text-red-400` |
| Border-Left (Quote/Education) | `border-red-500` |
| Social Link Icons | `text-red-500 group-hover:text-red-400` |
| Timeline Indicators | `from-red-500 to-pink-500` |
| Sidebar Icons (Search, Filter, etc.) | `text-red-500` |

### Forbidden Colors
- ❌ `cyan-500`, `cyan-600`, `green-500`, `green-600` for highlights
- ❌ Other primary colors besides red for accents

## Button Design Guidelines (applies to all pages)

All buttons on the website follow a uniform design pattern that is applied according to the corresponding color scheme depending on the page category.

### Clickable Buttons (Call-to-Actions)
Buttons that perform an action (navigation, form submission, external links) use **filled gradients**:

**Properties:**
- **Background**: Filled gradient in the respective page color (e.g., `bg-gradient-to-r from-cyan-500 to-teal-500` for Home/Handmade)
- **Text & Icons**: Always white (`text-white`)
- **Hover Effect**: Darker gradient (`hover:from-cyan-600 hover:to-teal-600`)
- **Hover Animation**: Slight enlargement (`hover:scale-105`)
- **Transition**: `transition-all duration-300` for smooth transitions
- **Shadow**: Optional `hover:shadow-lg` for additional depth

**Examples by page category:**
```html
<!-- Home/Handmade (Turquoise) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button Label
</button>

<!-- Blog (Purple) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button Label
</button>

<!-- Downloads (Green) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-lime-500 hover:from-green-600 hover:to-lime-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button Label
</button>

<!-- Portfolio (Amber/Orange) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button Label
</button>

<!-- News (Red) -->
<button class="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium transition-all duration-300 hover:scale-105">
  Button Label
</button>
```

### Non-clickable Elements & Filter Buttons
Elements that are informational or serve as filters (tags, skills, categories) use **glass design**:

**Properties:**
- **Background**: Glass-Morphism (`glass-t` or `glass`)
- **Text**: Standard text color (`text-txt-p dark:text-darkmode-txt-p`)
- **Icons**: Color accent of the page (e.g., `text-cyan-500` for Handmade)
- **Hover Effect**: Slight background lightening (`hover:bg-white/20`)
- **NO Scaling**: Filter buttons don't scale on hover
- **Border**: Subtle border in the page color (`border-cyan-500/20`)

**Examples:**
```html
<!-- Filter Button (Handmade) -->
<button class="glass px-3 py-2 rounded-lg hover:bg-white/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all">
  Category
</button>

<!-- Tag/Skill (nofrickeldave.github.io/.github/prompts/deploy-dev.prompt.mdn-clickable) -->
<span class="glass-t px-3 py-1 rounded-full text-sm text-txt-p dark:text-darkmode-txt-p cursor-default">
  JavaScript
</span>

<!-- Social Link (Portfolio - Glass Style) -->
<a href="#" class="glass-t px-5 py-3 rounded-xl hover:bg-white/20 hover:shadow-lg transition-all duration-300">
  <IconComponent className="text-xl text-amber-500" />
  <span>LinkedIn</span>
</a>
```

### Button.astro Component
The central `Button.astro` component supports both variants:

**Props:**
- `label: string` - Button text
- `link: string` - URL/Href
- `colorScheme: "cyan" | "purple" | "green" | "amber" | "red"` - Color scheme of the page
- `glass: boolean` - `true` for glass design (non-clickable), `false` for filled buttons (default: false)
- `newtab: boolean` - Open link in new tab

**Usage:**
```astro
<!-- Filled CTA Button -->
<Button label="Discover now" link="/portfolio" colorScheme="amber" />

<!-- Glass Design for non-primary links -->
<Button label="Learn more" link="/about" colorScheme="cyan" glass={true} />
```

### Important Rules
1. ✅ **Clickable CTAs**: Always filled with white text and hover:scale-105
2. ✅ **Informative Elements**: Always in glass design without scaling
3. ✅ **Color Consistency**: Each page uses its own color scheme for all buttons
4. ❌ **No Mixing**: Don't mix both styles at the same hierarchy level
5. ❌ **No Colored Icons in Filled Buttons**: Icons in filled buttons are always white

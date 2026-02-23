# Ascended Social - Design Guide

## Design System Overview

This document maps the Pencil design (`ascended-design.pen`) to the React component implementation.

### Color Palette

All colors follow the spiritual/chakra theme with dark mode as default:

```
Primary Colors:
- Dark Background:    #0F0F0F (page background)
- Secondary BG:       #1A1A1A (cards, containers)
- Tertiary BG:        #2D2D2D (oracle cards, hover states)
- Border Color:       #333333 (borders, dividers)

Accent Colors (Chakra-based):
- Root:       #EF4444 (red)
- Sacral:     #F97316 (orange)
- Solar:      #EAB308 (yellow)
- Heart:      #22C55E (green)
- Throat:     #3B82F6 (blue)
- Third Eye:  #6366F1 (indigo)
- Crown:      #A855F7 (purple - primary)

Text Colors:
- Primary:    #FFFFFF (headlines, important text)
- Secondary:  #E0E0E0 (body text)
- Tertiary:   #A0A0A0 (meta, labels)
- Disabled:   #808080 (footer, disabled states)

Interactive:
- Purple:     #A855F7 (buttons, links, hover)
- Indigo:     #6366F1 (secondary CTA)
- Pink:       #EC4899 (highlight, sparks)
```

### Typography

- **Headlines**: Inter Bold, 40-56px
- **Subheadlines**: Inter Semibold, 20-24px
- **Body**: Inter Regular, 14-16px
- **Labels**: Inter Medium, 12-13px
- **Meta**: Inter Regular, 11-12px

### Spacing & Layout

- **Page Padding**: 80px (top/bottom), 120px (left/right)
- **Section Gap**: 32px (between major sections)
- **Item Gap**: 12-20px (between related items)
- **Card Padding**: 16-20px
- **Button Padding**: [16, 32] (vertical, horizontal)

### Component Specifications

#### 1. Hero Section
- **Height**: 600px
- **Background**: AI-generated spiritual cosmic image with overlay
- **Overlay Color**: Transparent black (#0F0F0FA8)
- **Content**:
  - Logo text: "✨ Ascended Social"
  - Headline: 56px bold
  - Subheadline: 20px, purple-tinted
  - CTA Button: Purple (#A855F7), rounded (12px)

#### 2. Stats Section
- **Background**: #1A1A1A
- **Layout**: Horizontal, centered
- **Format**: Large number + label below
- **Colors**: Purple, Indigo, Pink accents

#### 3. Feed Section
- **Title**: "Your Chakra Feed" 40px
- **Post Cards**:
  - Background: #1A1A1A
  - Border: 1px solid #333333
  - Radius: 16px
  - Padding: 20px
  - Height: 280px (flexible)
  
**Post Card Parts**:
  - Avatar: 48x48px, chakra color
  - Author Name: 14px semibold, white
  - Meta: 12px, gray (#A0A0A0)
  - Content: 15px, light gray (#E0E0E0)
  - Chakra Badge: Small, semi-transparent pill with chakra color
  - Footer: Interaction buttons (Sparks, Comments)

#### 4. Oracle Section
- **Background**: #0F0F0F
- **Title**: "Daily Oracle Reading" 40px
- **Cards**: 
  - Width: 200px
  - Height: 280px
  - Background: #2D2D2D
  - Border: 1px solid #444444
  - Radius: 12px
  - Center-aligned content
  - Icon emoji: 48px
  - Title: 14px semibold
  - Description: 11px gray

#### 5. Footer
- **Background**: #0A0A0A
- **Border-top**: 1px solid #333333
- **Layout**: Horizontal, space-between
- **Content**: Brand info, links, copyright

### Interactive States

**Buttons**:
- Default: Purple (#A855F7) or Indigo (#6366F1)
- Hover: Lighter shade (20% brightness increase)
- Active: Darker shade (20% brightness decrease)
- Radius: 10-12px
- Padding: [14-16, 32]px

**Cards**:
- Default: Border #333333, 1px
- Hover: Border #555555, 2px
- Transition: 200ms ease

**Text Links**:
- Color: #A855F7
- Hover: #D8BFD8 (lighter purple)

### Responsive Considerations

**Desktop (1440px base)**:
- Full layout as designed
- Max-width containers: 1440px

**Tablet/Mobile (future)**:
- Single column layout
- Adjusted padding: 40px top/bottom, 20px sides
- Increased touch targets: min 48x48px
- Adjusted font sizes: -2-4px

## Implementation Notes

### CSS Variables to Use (Tailwind)

Create a `tailwind.config.ts` with these custom colors:

```typescript
colors: {
  'spiritual-dark': '#0F0F0F',
  'spiritual-dark-secondary': '#1A1A1A',
  'spiritual-dark-tertiary': '#2D2D2D',
  'chakra': {
    'root': '#EF4444',
    'sacral': '#F97316',
    'solar': '#EAB308',
    'heart': '#22C55E',
    'throat': '#3B82F6',
    'third-eye': '#6366F1',
    'crown': '#A855F7',
  }
}
```

### Key Design Decisions

1. **Dark Mode First**: All designs assume dark background for accessibility and spiritual aesthetic
2. **Chakra Color Coding**: Every post/entity uses chakra colors for quick visual identification
3. **Generous Whitespace**: Spacing creates breathing room for spiritual content
4. **Subtle Borders**: 1px borders provide structure without harshness
5. **Emoji Icons**: Use emojis for chakra/energy representation (✨, 🌙, 👑, 💬)
6. **AI-Generated Hero**: Header features AI-generated cosmic/spiritual imagery

### Migration Checklist

- [ ] Update page background colors from default to #0F0F0F
- [ ] Update card backgrounds to #1A1A1A with #333333 borders
- [ ] Update text colors to specified palette
- [ ] Increase border radius on cards: 12-16px
- [ ] Add chakra color variants to buttons/badges
- [ ] Update hero section with AI image
- [ ] Adjust section padding for white space
- [ ] Ensure footer layout matches design
- [ ] Update button styles and hover states

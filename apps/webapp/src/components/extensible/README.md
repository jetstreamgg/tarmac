# Extensible Components

This directory contains components designed as **extensibility points** for forks of this repository. Each component ships with minimal or no default implementation, allowing forkers to add their own functionality without causing merge conflicts with upstream changes.

## Philosophy

- **Empty by default**: Components render nothing unless explicitly enabled
- **Minimal surface**: Small, focused files that are easy to replace entirely if needed
- **Well-typed**: All props and handlers are fully typed for discoverability
- **Merge-friendly**: Upstream changes rarely touch these files, reducing conflicts

## Available Components

### Banner

A fixed-position banner that appears at the bottom of the screen.

**Location**: `src/components/extensible/Banner.tsx`
**Integrated in**: `src/modules/layout/components/Layout.tsx`

#### Quick Start

1. Open `Banner.tsx` and set `SHOW_BANNER = true`
2. Replace the example content (marked with a comment) with your custom UI
3. Implement handler callbacks as needed (e.g., localStorage persistence)

#### Props

| Prop                | Type                | Default  | Description                           |
| ------------------- | ------------------- | -------- | ------------------------------------- |
| `position`          | `'left' \| 'right'` | `'left'` | Horizontal position of the banner     |
| `className`         | `string`            | -        | Additional CSS classes                |
| `onShow`            | `() => void`        | -        | Called when banner becomes visible    |
| `onDismiss`         | `() => void`        | -        | Called when user dismisses the banner |
| `onAction`          | `() => void`        | -        | Called for primary CTA                |
| `onSecondaryAction` | `() => void`        | -        | Called for secondary action           |

#### Built-in Behavior

- **Visibility state**: The component manages its own visibility with `useState`. Clicking the dismiss button hides the banner.
- **onShow callback**: Fires automatically when the banner becomes visible (via `useEffect`).
- **onDismiss callback**: Fires when the user clicks the dismiss button.

> **Note**: Persistence (e.g., localStorage) is intentionally not included. Forkers can add their own persistence logic in the callbacks.

#### Z-Index Hierarchy

The banner is layered to work correctly with other UI elements:

| Component      | Z-Index  | Notes               |
| -------------- | -------- | ------------------- |
| Sonner toasts  | `z-40`   | Toast notifications |
| **Banner**     | `z-[45]` | This component      |
| Modals/Dialogs | `z-50`   | Modal overlays      |

#### Example: Adding localStorage Persistence

The Banner ships with visibility state but no persistence. Here's how to add localStorage support:

```tsx
// In Layout.tsx or wherever Banner is used:

const STORAGE_KEY = 'my-banner-dismissed';

const handleBannerDismiss = () => {
  localStorage.setItem(STORAGE_KEY, 'true');
};

// Only show if not previously dismissed
const showBanner = !localStorage.getItem(STORAGE_KEY);

return (
  <>
    {showBanner && <Banner onDismiss={handleBannerDismiss} />}
    {/* rest of layout */}
  </>
);
```

#### Example: Custom Content

Replace the example content inside Banner.tsx (look for the comment `{/* Example content - replace with your custom UI */}`):

```tsx
{
  /* Example content - replace with your custom UI */
}
<div className="bg-container border-border rounded-xl border p-4 shadow-lg backdrop-blur-[50px]">
  <div className="mb-3 flex items-center justify-between">
    <Heading variant="small" className="text-text">
      Your Title Here
    </Heading>
    <Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Dismiss">
      <X className="text-textSecondary hover:text-text" size={16} />
    </Button>
  </div>
  <Text variant="medium" className="text-text">
    Your message content goes here. Customize this to fit your needs.
  </Text>
  <div className="mt-4 flex gap-2">
    <Button variant="primary" onClick={onAction}>
      Primary Action
    </Button>
    <Button variant="secondary" className="border bg-transparent" onClick={onSecondaryAction}>
      Secondary Action
    </Button>
  </div>
</div>;
```

## Adding New Extensible Components

When adding new extensibility points, follow this pattern:

1. **Create the component** in this directory with a descriptive name
2. **Add a visibility constant** at the top (default: `false`)
3. **Return `null` early** when disabled to avoid rendering
4. **Export types** for all props and relevant types
5. **Document handlers** that forkers might need to implement
6. **Add to index.ts** for clean imports
7. **Integrate** into the appropriate parent component
8. **Update this README** with usage instructions

### Template

```tsx
// src/components/extensible/NewComponent.tsx

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const SHOW_COMPONENT = false;

export interface NewComponentProps {
  className?: string;
  onShow?: () => void;
  onDismiss?: () => void;
  onAction?: () => void;
}

export function NewComponent({ className, onShow, onDismiss, onAction }: NewComponentProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const shouldShow = SHOW_COMPONENT && isVisible;

  useEffect(() => {
    if (shouldShow) {
      onShow?.();
    }
  }, [shouldShow, onShow]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={cn('base-styles', className)}>{/* Example content - replace with your custom UI */}</div>
  );
}

NewComponent.displayName = 'NewComponent';
```

## Handling Merge Conflicts

If you do encounter merge conflicts:

1. **Accept upstream changes** to the component structure
2. **Re-apply your customizations** (content, handlers, visibility)
3. **Test thoroughly** after resolving

Since all customization happens within well-defined areas (the `SHOW_*` constant and the render section), conflicts should be rare and easy to resolve.

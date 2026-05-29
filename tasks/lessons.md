# Lessons learned

Captured per the user's global instructions — patterns and rules to prevent repeating mistakes.

## Setup

- `gh` config lives at `~/.gh-config`, not the default `~/.config/gh`. Always prefix `GH_CONFIG_DIR=~/.gh-config` to `gh` commands or export it.
- Vercel CLI is already auth'd as `mehtaphysical13`. No login flow needed.

## In-flight

### Vercel TS build uses nodenext module resolution
- Local tsconfig used `moduleResolution: bundler` (permissive) → green build.
- Vercel's build for `/api/*.ts` uses `nodenext` (strict) → required `.js` extensions on relative imports.
- Both passes "completed" but the bundled output failed at runtime with a 500.
- Lesson: any future Vercel-deployed TS project should default to `.js` extensions on relative imports OR mirror Vercel's tsconfig locally. Sed pass: `find src/lib api scripts -name "*.ts" | xargs sed -i '' -E 's|from "(\.\.?/[^"]+)"|from "\1.js"|g'`.
- For the Factory template: bake this in from day one.

### federalregister.gov: search filter codes ≠ response type strings
- Search expects `conditions[type][]=PRORULE` (code).
- Response returns `type: "Proposed Rule"` (display string).
- Modeled as two distinct TypeScript types: `FedRegDocCode` (input) and `FedRegDocType` (output). Don't conflate them.
- Lesson: any wrapper around a third-party API should verify input vs. output enum shapes against the live API before declaring "done." The smoke-test step caught this; TypeScript alone would not have.

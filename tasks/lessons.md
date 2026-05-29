# Lessons learned

Captured per the user's global instructions — patterns and rules to prevent repeating mistakes.

## Setup

- `gh` config lives at `~/.gh-config`, not the default `~/.config/gh`. Always prefix `GH_CONFIG_DIR=~/.gh-config` to `gh` commands or export it.
- Vercel CLI is already auth'd as `mehtaphysical13`. No login flow needed.

## In-flight

### Wrap third-party responses; never trust shape
- federalregister.gov omits `results` entirely on no-match queries (not `[]`). My TS types said `results: FedRegDocument[]` and `.map()` crashed in production.
- Lesson: the upstream-API wrapper layer is the place to normalize *missing* fields, not just *wrong* fields. Default arrays to `[]`, default counters to `0`, default strings to `undefined`.
- Pattern: have the wrapper return a `Partial<>` from the raw call and explicitly fill defaults before returning.
- For the Factory template: this should be the standard pattern for every API wrapper.

### Always Zod-validate user-facing inputs that flow to upstream
- Free-form `from_date: z.string()` let "yesterday" pass through to federalregister.gov, which returned 400.
- Lesson: any arg that ends up in a URL or query param should have a regex/format/length constraint at the Zod layer. Move the failure earlier — to the agent's call site — where the error message is in the agent's context.

### Subagent QA loop pays for itself
- The post-deploy subagent found 3 production-crash bugs in 14 tool uses. None were caught by the smoke scripts I wrote (which only exercised happy paths).
- Lesson: smoke scripts test "does it work?". QA subagents test "does it fail gracefully?". Both are needed; the subagent is the cheaper of the two.

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

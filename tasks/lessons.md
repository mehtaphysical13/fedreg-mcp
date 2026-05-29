# Lessons learned

Captured per the user's global instructions — patterns and rules to prevent repeating mistakes.

## Setup

- `gh` config lives at `~/.gh-config`, not the default `~/.config/gh`. Always prefix `GH_CONFIG_DIR=~/.gh-config` to `gh` commands or export it.
- Vercel CLI is already auth'd as `mehtaphysical13`. No login flow needed.

## In-flight

### federalregister.gov: search filter codes ≠ response type strings
- Search expects `conditions[type][]=PRORULE` (code).
- Response returns `type: "Proposed Rule"` (display string).
- Modeled as two distinct TypeScript types: `FedRegDocCode` (input) and `FedRegDocType` (output). Don't conflate them.
- Lesson: any wrapper around a third-party API should verify input vs. output enum shapes against the live API before declaring "done." The smoke-test step caught this; TypeScript alone would not have.

# Specification

## Summary
**Goal:** Investigate and fix the recurring production deployment failure by resolving backend Motoko compilation errors and frontend build issues.

**Planned changes:**
- Audit `backend/main.mo` for syntax errors, type mismatches, and invalid stable variable declarations that prevent the canister from building or upgrading
- Fix any identified Motoko compilation errors so the actor compiles cleanly
- Audit frontend build configuration (vite config, tsconfig, tailwind config, index.html, package.json) for missing environment variables, broken imports, type errors, or invalid asset references
- Fix any identified frontend build issues so the production build completes successfully

**User-visible outcome:** Production deployment completes without errors and the deployed app loads correctly.

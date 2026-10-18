---
name: code-refactor
description: Simplify and reorganize TypeScript and Node.js code into small, human-understandable modules with distinct responsibilities while preserving behavior. Use when asked to refactor, clean up duplication, split large files, move responsibilities, or remove dead code.
---

# Code Refactoring: Simplification Guide

Use the repository's [AGENTS.md](../../../AGENTS.md) for architectural
invariants, import conventions, and verification rules. Inspect the affected
code and all callers before changing a shared function, type, or file location.

## Establish Scope and Benefit

Identify the concrete maintenance cost before editing: mixed responsibilities in
a large file, repeated business rules, unclear resource ownership, deep nesting,
unnecessary indirection, or dead code. Every refactoring step should make the
code easier for a human to read, trace, and modify.

Keep behavior changes out of a refactoring unless explicitly requested. Preserve
defaults, validation order, error statuses, asynchronous timing, and resource
cleanup invariants.

## Organize into Small, Distinct Modules

- Split multi-responsibility files into small, focused modules where each file
  handles one clear step, while keeping a clean coordinator entry point.
- Place schemas, configuration, and domain rules near the module that owns them.
  Avoid growing central switch statements or global dependency interfaces for
  feature-specific logic.
- Share a helper only when its callers share the same semantics. If an extracted
  helper needs caller-specific mode flags, keep the logic local. Remove
  pass-through wrappers that add no meaningful boundary.
- Flatten deeply nested callbacks and conditionals into explicit functions or
  early returns so error handling and resource ownership are obvious.
- Rename or move files when it makes responsibilities easier to locate. Update
  all imports, examples, and documentation that reference them, and avoid
  creating barrel files just to hide paths.

## Prove Removals and Validate Proportionally

Before deleting an export, file, or dependency, check both static imports and
dynamic entry points (such as route conventions, standalone scripts, and
`package.json` commands). Run dead-code/unused-export analysis (e.g. Knip) after
changing exports, files, or entry points, and resolve each finding against
actual usage rather than expanding ignore lists.

Follow the verification policy in `AGENTS.md`: run typechecking, code linting,
dead-code checks, and formatting on changed files. Build when changing
compilation or entry points. Do not add or run tests unless explicitly
requested. Review the final diff, explain the concrete readability and
maintenance improvements, and report which checks ran.

---
name: codebase-review
description: 'Conduct comprehensive codebase reviews across architecture, performance, error handling, security, UI/UX, code quality, and maintainability. Use for: architecture compliance audits, pre-release verification, security scans, performance optimization, refactoring decisions, onboarding reviews. Covers full-stack Tauri app (React frontend + Rust backend).'
argument-hint: 'Target file/module, review dimensions (or leave blank for full review)'
---

# Codebase Review Skill

## Purpose

This skill systematically reviews code across seven critical dimensions tailored to the Francis Gamebar architecture—a high-performance Tauri overlay with strict performance, security, and error-handling requirements.

## When to Use

- **Architecture audits**: Verify system boundaries, storage model, and invariants are maintained
- **Pre-release checks**: Comprehensive quality gates before shipping
- **Security scans**: Validate Tauri capabilities, CSP policies, credential handling
- **Performance optimization**: Identify render loops, polling patterns, async issues
- **Onboarding reviews**: Ensure new code follows team conventions
- **Refactoring decisions**: Spot architectural drift before technical debt accumulates
- **Post-incident**: Root cause analysis and preventive fixes

## Review Dimensions

| Dimension | Focus | Scope |
|-----------|-------|-------|
| **Architecture Compliance** | System boundaries, invariants, storage model adherence | Full stack |
| **Performance & Scalability** | Render loops, polling, async/await patterns, memory leaks | React + Rust |
| **Error Handling & Resilience** | Error boundaries, Result types, graceful degradation, logging | Full stack |
| **Security** | Tauri capabilities, CSP policies, credential storage, API whitelisting | Backend > Frontend |
| **UI/UX & Styling** | Glassmorphism consistency, responsiveness, accessibility, conventions | React only |
| **Code Quality & Standards** | Test coverage, naming, modularity, compliance with code-standards.md | Full stack |
| **Maintainability** | State management patterns, documentation, reusability, DRY | Full stack |

## Review Procedure

### 1. Scope the Review

Before diving into code, clarify what you're reviewing:

```
Target: [file.tsx / module / system / entire codebase]
Dimensions: [all / specific subset]
Baseline: [any recent decisions from Decisions.md to cross-reference]
```

See [Scoping Template](./references/scoping-template.md) for details.

### 2. Run Targeted Analyses

For each dimension, use the [Dimension Checklists](./references/dimension-checklists.md) to guide inspection:

- **Architecture**: Check boundaries, invariants, storage adherence
- **Performance**: Grep for render patterns, polling, async misuse
- **Error Handling**: Verify Error Boundaries, logging, Result types
- **Security**: Audit Tauri capabilities, CSP, API whitelisting
- **UI/UX**: Inspect styling consistency, accessibility, responsiveness
- **Code Quality**: Check test files, naming conventions, modularity
- **Maintainability**: Review state management, docs, reusability

### 3. Document Findings

For each issue found, record:

- **Dimension**: Which review area it belongs to
- **Severity**: Critical / High / Medium / Low
- **Location**: File path and line range
- **Issue**: What's wrong and why
- **Risk**: What could fail if not addressed
- **Recommendation**: Specific fix or improvement

Use the [Report Template](./references/report-template.md) to structure findings.

### 4. Cross-Reference Standards

Before recommending changes, verify against:

- `context/code-standards.md` — Enforce conventions
- `context/architecture.md` — Check boundaries and invariants
- `context/Decisions.md` — Understand prior trade-offs
- `context/ui-context.md` — Verify visual consistency

### 5. Prioritize & Summarize

Group findings by:
- **Must-fix** (Critical bugs, security issues, architecture violations)
- **Should-fix** (Performance, maintainability, UX polish)
- **Nice-to-have** (Code style, documentation)

Provide actionable recommendations and rough effort estimates.

---

## Example Invocations

```
/codebase-review src/store/widgetStore.ts

/codebase-review src-tauri/src/core/audio.rs performance security

/codebase-review entire codebase architecture

/codebase-review src/components/widgets/ ui-ux code-quality
```

## Output Format

The skill produces:
1. **Structured findings** (Dimension → Issues → Recommendations)
2. **Risk summary** (What breaks if ignored?)
3. **Priority roadmap** (Must-fix → Should-fix → Nice-to-have)
4. **Implementation checklist** (File by file, with effort estimates)

---

## Key Resources

- [Scoping Template](./references/scoping-template.md) — Structure your review
- [Dimension Checklists](./references/dimension-checklists.md) — Question lists per dimension
- [Report Template](./references/report-template.md) — Document findings
- [Project Architecture](../../context/architecture.md) — System design reference
- [Code Standards](../../context/code-standards.md) — Enforcement rules
- [Decisions Log](../../context/Decisions.md) — Prior trade-offs

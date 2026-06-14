# Code Review Report Template

Use this template to document and communicate review findings.

---

## Review Header

**Date**: [YYYY-MM-DD]  
**Reviewer**: [Name]  
**Scope**: [File(s) / Module / System reviewed]  
**Dimensions Covered**: [Architecture / Performance / Error Handling / Security / UI/UX / Code Quality / Maintainability]  
**Review Type**: [Architecture audit / Pre-release / Security scan / Performance / Onboarding / Post-incident]  
**Commit**: [Git hash or version]  

---

## Executive Summary

[1-2 paragraphs summarizing the review, key findings, and overall health.]

**Overall Health**: [Good / Acceptable / Needs Work]  
**Critical Issues**: [N]  
**High Priority**: [N]  
**Medium Priority**: [N]  
**Total Time to Resolve**: [Estimated hours]  

---

## Findings by Dimension

### 1. Architecture Compliance

**Status**: ✅ Compliant / ⚠️ Minor Issues / ❌ Major Issues

#### Issue #1: [Descriptive Title]

- **Severity**: Critical / High / Medium / Low
- **Location**: `file.tsx` [L10-15] or `src-tauri/src/core/audio.rs` [L42]
- **Description**: 
  - What: What's the problem?
  - Why: Why is it wrong? (Reference standard/invariant)
  - Current: Code snippet or behavior
  
- **Risk**: What breaks if not fixed? (Performance impact? Security? User experience?)
- **Recommendation**: Specific fix with code example if applicable
- **Effort**: Rough estimate (15 min / 1 hour / half-day)

#### Issue #2: ...

---

### 2. Performance & Scalability

**Status**: ✅ Optimal / ⚠️ Minor Issues / ❌ Major Issues

#### Issue #1: [Render loop / Polling overhead / Async misuse / Memory leak]

- **Severity**: High
- **Location**: `src/store/widgetStore.ts` [L30]
- **Description**: Store subscriptions trigger re-renders on every state change instead of using granular selectors
- **Risk**: 60FPS re-render loop, noticeable lag in overlay UI
- **Recommendation**: 
  ```typescript
  // Before
  const widgets = useWidgetStore();
  
  // After
  const widgets = useWidgetStore(state => state.activeWidgets, useShallow);
  ```
- **Effort**: 30 min

#### Issue #2: ...

---

### 3. Error Handling & Resilience

**Status**: ✅ Robust / ⚠️ Minor Issues / ❌ Major Issues

#### Issue #1: [Missing ErrorBoundary / Unhandled promise / No logging]

- **Severity**: Medium
- **Location**: `src/components/widgets/OpenRouterWidget.tsx` [L50]
- **Description**: API call to OpenRouter is not wrapped in try-catch; widget crashes if API fails
- **Risk**: Single widget crash unmounts entire HUD; user loses overlay
- **Recommendation**: Wrap widget in ErrorBoundary AND add try-catch in API call with fallback UI
- **Effort**: 1 hour

#### Issue #2: ...

---

### 4. Security

**Status**: ✅ Secure / ⚠️ Requires Review / ❌ Critical Issues

#### Issue #1: [Missing CSP / Overpermissive capability / Hardcoded secret]

- **Severity**: Critical
- **Location**: `tauri.conf.json`
- **Description**: CSP `connect-src` doesn't whitelist api.openrouter.ai; frontend API calls will fail silently
- **Risk**: External API calls blocked; feature unavailable; confusing user experience
- **Recommendation**: Add `https://api.openrouter.ai` to CSP:
  ```json
  "csp": "connect-src 'self' https://api.openrouter.ai https://api.notion.com"
  ```
- **Effort**: 15 min

#### Issue #2: ...

---

### 5. UI/UX & Styling

**Status**: ✅ Consistent / ⚠️ Minor Issues / ❌ Significant Issues

#### Issue #1: [Inconsistent styling / Missing accessibility / Poor responsiveness]

- **Severity**: Medium
- **Location**: `src/components/widgets/HardwareWidget.tsx` [L80]
- **Description**: Widget uses blue accent color instead of amber/green per `ui-context.md`
- **Risk**: Visual inconsistency breaks HUD aesthetic; confuses users
- **Recommendation**: Replace `bg-blue-500` with `bg-amber-500` to match Tactical/HUD theme
- **Effort**: 15 min

#### Issue #2: ...

---

### 6. Code Quality & Standards

**Status**: ✅ High Quality / ⚠️ Minor Issues / ❌ Needs Refactoring

#### Issue #1: [No type definitions / Vitest missing / Code duplication]

- **Severity**: High
- **Location**: `src/store/hardwareStore.ts` [L1-50]
- **Description**: Store uses `any` for state; no type definitions for metrics
- **Risk**: IDE cannot provide autocomplete; refactoring is error-prone; easier to introduce bugs
- **Recommendation**: Define interfaces:
  ```typescript
  interface HardwareMetrics {
    cpu: number;
    gpu: number;
    memory: number;
  }
  ```
- **Effort**: 1 hour

#### Issue #2: ...

---

### 7. Maintainability

**Status**: ✅ Well-Maintained / ⚠️ Minor Issues / ❌ Tech Debt

#### Issue #1: [Missing documentation / Context not updated / Store organization]

- **Severity**: Low
- **Location**: `src/components/widgets/` (all widgets)
- **Description**: Widgets lack JSDoc comments explaining purpose, props, and error handling
- **Risk**: New contributors struggle to understand code; onboarding slower
- **Recommendation**: Add JSDoc headers:
  ```typescript
  /**
   * HardwareWidget — Displays real-time CPU, GPU, RAM metrics
   * 
   * Props:
   *   - refreshInterval: How often to poll hardware data (ms)
   * 
   * Error Handling:
   *   - If hardware data unavailable, displays "N/A"
   * 
   * Performance:
   *   - Subscribes to hardwareStore.metrics with useShallow
   */
  ```
- **Effort**: 2 hours

#### Issue #2: ...

---

## Priority Roadmap

### Must-Fix (Critical)

1. **[Issue Description]** [File] — [Risk]  
   Estimated effort: [X hours]  
   Blocks: [Release / Performance / Security]

2. ...

### Should-Fix (High Priority)

1. **[Issue Description]** [File] — [Impact]  
   Estimated effort: [X hours]  
   Improves: [Maintainability / Performance / UX]

2. ...

### Nice-to-Have (Medium/Low)

1. **[Issue Description]** [File]  
   Estimated effort: [X hours]  
   Improves: [Code quality / Documentation]

2. ...

---

## Implementation Checklist

Use this to track fixes:

- [ ] Issue #1: [Title] — Started: __ | Completed: __ | PR: ___
- [ ] Issue #2: [Title] — Started: __ | Completed: __ | PR: ___
- [ ] Issue #3: [Title] — Started: __ | Completed: __ | PR: ___

---

## Follow-Up Actions

- [ ] Update `context/progress-tracker.md` with findings
- [ ] Update `context/Decisions.md` if architectural decisions were made
- [ ] Create GitHub issues for Must-Fix items
- [ ] Schedule follow-up review after fixes are implemented

---

## Notes

[Additional context, questions, or recommendations for future reviews]

---

**Report Status**: Draft / Ready for Review / Finalized  
**Reviewed By**: [Secondary reviewer if applicable]  
**Date Finalized**: [YYYY-MM-DD]  

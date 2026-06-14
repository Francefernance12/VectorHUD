# Scoping Template

Use this template to clearly define your review scope before beginning analysis.

## Basic Info

**Date**: [YYYY-MM-DD]  
**Reviewer**: [Your name]  
**Project Context**: Francis Gamebar (Tauri overlay)  

## Scope Definition

### Target

What are you reviewing?

- [ ] Specific file(s): ___________________
- [ ] Specific module/directory: ___________________
- [ ] System/subsystem: ___________________
- [ ] Entire codebase (full-stack)
- [ ] Entire frontend (React only)
- [ ] Entire backend (Rust only)

**Details**: [Why this scope? Is this a new feature, pre-release, or post-incident review?]

---

### Dimensions

Which review dimensions apply?

- [ ] Architecture Compliance
- [ ] Performance & Scalability
- [ ] Error Handling & Resilience
- [ ] Security
- [ ] UI/UX & Styling
- [ ] Code Quality & Standards
- [ ] Maintainability

**Rationale**: [Why these dimensions for this scope?]

---

### Baseline Context

What should the reviewer know?

- **Recent decisions**: [Reference entries from Decisions.md]
- **Known issues**: [Any known tech debt or risks?]
- **Prior reviews**: [Any follow-ups from previous reviews?]
- **Version**: [Git commit or version number]

---

### Success Criteria

How will you know the review is complete?

- All target files have been examined
- At least [N] dimensions covered
- Issues documented with severity and recommendation
- Cross-referenced against `context/code-standards.md` and `context/architecture.md`

---

## Notes

[Any additional context for the reviewer]

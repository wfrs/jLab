# Project Goal

This project is a modern reimplementation of GMOCU.

The objective is:

- Preserve all functional behavior from the original project
- Improve maintainability
- Improve security
- Improve user experience
- Remove technical debt
- Keep the implementation simple

The agent must always prioritize correctness over adding features.

---

# Development Principles

1. Understand before changing
2. Do not rewrite working functionality without a clear reason
3. Small pull requests
4. Document major decisions
5. Prefer existing patterns over creating new ones
6. Avoid unnecessary dependencies

---

# Architecture Rules

Before implementing:

1. Analyze the original GMOCU implementation
2. Identify existing functionality
3. Create a migration plan
4. Verify parity with original behavior

Never remove functionality unless explicitly requested.

Mandatory parity gate before merge:

1. List the affected legacy behaviors explicitly.
2. Verify each behavior still works.
3. Document evidence (tests, screenshots, logs, or reproducible steps).
4. If parity cannot be proven, do not merge.

---

# Coding Standards

- Use strict typing
- No magic numbers
- No hardcoded secrets
- No duplicated code
- Use dependency injection where appropriate
- Add comments only when code is not self-explanatory

---

# Security Requirements

Never:

- Store credentials in source code
- Disable TLS validation
- Log secrets
- Commit API keys
- Use insecure cryptographic algorithms

Always:

- Validate all user input
- Sanitize external data
- Apply least privilege principles

---

# Testing Requirements

Every feature must include:

- Unit tests
- Integration tests where applicable
- Error-path validation

The agent must not consider work complete if tests fail.

Required test matrix for each significant change:

- Happy path: expected successful behavior.
- Validation path: invalid input and boundary constraints.
- Error path: dependency failure and recovery/notification behavior.
- Regression path: previously working legacy behavior in impacted area.
- Compatibility path: data/schema compatibility when migration code is touched.

Testing policy:

- Run the smallest targeted tests first, then broaden only when needed.
- Record exactly which tests were run.
- If tests are missing for impacted behavior, add them before declaring completion.

---

# Refactoring Rules

Before refactoring:

1. Explain the reason
2. Identify affected components
3. Verify test coverage
4. Minimize scope

Large architectural changes require approval.

---

# Documentation

When introducing new functionality:

- Update README
- Update architecture documentation
- Add usage examples
- Document configuration

For significant changes, the PR/change summary must include:

- Scope and non-scope
- User-visible behavior change (or explicit "no behavior change")
- Risks and mitigations
- Test matrix results
- Parity checklist status

---

# Design Review & Accessibility

**When to invoke:** Whenever UI/UX designs are under review, accessibility audits are requested, design patterns are being established, or a design change is proposed.

## Using the design-taste-frontend Skill

This project integrates the **design-taste-frontend** skill (installed in
`.claude/skills/design-taste-frontend/`). It carries jlab's design system —
the **Linear design language** — in `references/linear-design-system.md`
(colors, typography, elevation ladder, component specs).

jlab is a web application only (React + Next.js) and ships **dark mode only**.
All UI work must use the skill's tokens rather than inventing values.

### Mandatory Design Review Scenarios

**Invoke design-taste-frontend when:**

1. **Before implementing component layouts**
   - New form, table, navigation, or interaction pattern is being designed
   - High-risk UX decisions (modals, gesture handling, accessibility)
   - Design mockups or wireframes exist (screenshots, HTML renders, Figma exports)

2. **During PR review of UI/UX changes**
   - Changes to app layout, navigation, or interaction flow
   - New accessibility features or regressions detected
   - Design pattern inconsistencies across screens/modules

3. **Establishing design patterns for reuse**
   - Creating component libraries
   - Defining form interaction standards
   - Setting accessibility baseline rules

4. **Specialized audits**
   - Full accessibility compliance audit (WCAG 2.1 AA minimum)
   - Dark-surface contrast verification
   - Responsive design validation (mobile/tablet/desktop viewport coverage)
   - Color contrast and visual hierarchy review

### How to Use

The skill provides:

- The **Linear design system reference** — token YAML (colors, typography,
  spacing, radii) plus per-component specs and do's/don'ts
- **Brief-inference rules** ("design read") so new surfaces are not built on
  default LLM aesthetics
- **Design Review Report** structure (summary, critical issues, improvements, positive notes)
- **Severity classification** (Critical, High, Medium, Low)

### Output Format

Every design review must produce:

```
## Design Review: [Feature/Component Name]

### Summary
[2-3 sentence assessment with severity: Excellent / Good / Needs Work / Critical Issues]

### Critical Issues
- **What**: Problem description
- **Why**: Which design principle violated (cite the design-system token or rule)
- **Fix**: Concrete, actionable recommendation in our framework

### Improvements
- [Non-critical optimization opportunities]

### Positive Notes
- [What the design does well]

### Implementation Notes
- [Any React/Next.js/Tailwind specific guidance]
```

### Key Principles

All design decisions must respect:

1. **Accessibility first** (not optional)
   - Scalable text support required
   - ≥4.5:1 contrast ratio for body text
   - Touch/click targets ≥44px minimum
   - Screen reader label support
   - Color-blind safe palette (never encode meaning in hue alone)
   - Full keyboard operability — the spreadsheet grid is keyboard-first

2. **Linear design language** (see the skill reference for exact values)
   - Depth comes from the **surface ladder + hairline borders**, never from
     drop shadows on dark
   - **One accent** (lavender `#5e6ad2`) carries every interactive signal;
     no second chromatic accent
   - Dark-only: there is no light theme to maintain
   - No decorative gradients or glassmorphism

3. **Visual design consistency**
   - Use design tokens from the Tailwind theme; never inline hex values
   - Typography following a clear type scale
   - Icon clarity and consistency
   - Spacing and alignment discipline

4. **Interaction design**
   - Appropriate loading and error states
   - User feedback for all actions (autosave included)
   - Graceful error recovery
   - Minimal, purposeful modality

---

# Decision Making

When multiple solutions exist:

Prefer:

1. Simplicity
2. Maintainability
3. Security
4. Performance

Avoid premature optimization.

---

# Agent Workflow

For every significant change:

1. Analyze existing code
2. Create implementation plan
3. Implement
4. Test
5. Document
6. Self-review

Provide reasoning before large modifications.

Mandatory output format for significant changes:

1. Context and goal
2. Impacted components
3. Implementation summary
4. Test matrix results
5. Parity checklist
6. Known limitations or follow-ups

---

# Forbidden Actions

Do NOT:

- Delete files without justification
- Introduce breaking changes without warning
- Invent APIs
- Ignore compiler warnings
- Skip tests
- Change architecture without documenting rationale
- Merge parity-sensitive changes without parity evidence

---

# Pull Request / Change Size Limits

Default limits (unless explicitly approved):

- Max files changed: 12
- Max net LOC changed (excluding generated/lock files): 550
- Max independent concerns per change: 1

If a change exceeds limits:

1. Split into smaller sequenced changes, or
2. Request explicit approval with a justification and risk plan.

Large architectural changes always require approval before implementation starts.

---

# Parity Checklist (Required)

Every significant change must include this checklist in the final summary:

- [ ] Feature behavior parity verified against legacy workflow.
- [ ] Data read/write behavior parity verified.
- [ ] Validation and error behavior parity verified.
- [ ] No unintended UI flow regressions introduced.
- [ ] Migration/backward compatibility verified (if applicable).
- [ ] Security constraints from this file verified.

# GMOCU Modernization Strategy

Keep functional behavior identical to the original implementation.

Allowed improvements:

- Modern UI
- Better error handling
- Better logging
- Improved configuration management
- Automated updates
- Improved packaging

Do not introduce feature creep.

When uncertain, match the original application's behavior.

First task for the agent should be:

Analyze the original GMOCU repository.
Create:

1. Feature inventory
2. User workflows
3. Technology inventory
4. Architecture diagram
5. Technical debt assessment
6. Modern replacement proposal

Output as markdown documents under /docs.

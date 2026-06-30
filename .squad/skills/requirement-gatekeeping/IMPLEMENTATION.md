# Requirement Gatekeeping Implementation Notes

This note captures the migrated behavior from the legacy validate-code-change hook.

## Intent

Block risky edit operations when requirement approval is missing or invalid.

## Validation Steps

- Detect sensitive operation classes (file edits, broad investigative actions).
- Verify approval record exists.
- Confirm issue reference is present.
- Reject expired approvals.
- Deny operations with clear reason when checks fail.

## Operational Guidance

- Keep approval checks deterministic and lightweight.
- Treat approval scope as a hard boundary.
- Return explicit deny messages to prevent ambiguous failures.
- Re-validate when workflow config changes.

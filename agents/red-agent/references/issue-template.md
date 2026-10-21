# Issue body template

Replace bracketed fields with observed facts. Omit only sections that do not apply. This template is report content, not a completed finding.

```markdown
## Observed bug
[Concrete trigger and symptom. Classify as security finding or functional regression.]

## Environment and prerequisites
- Tested commit: [SHA and relevant uncommitted changes]
- Target: [local URL or authorized deployment]
- Runtime/browser: [versions, operating system, viewport]
- Setup: [commands, fixture files, dummy credentials/configuration, starting state]
- Attacker control: [input and required access, or not applicable]

## Steps to reproduce
1. [Start the target and load the specified fixture or recording.]
2. [Navigate to the exact URL and perform the exact action.]
3. [Enter the exact payload, including encoding, or reference the attached fixture.]
4. [Observe the concrete failure.]

## Expected behavior
[Relevant spec requirement or trust boundary, linked to the tested revision.]

## Actual behavior
[Observed UI/API result, status, error, or harmless impact marker.]

## Impact and severity
[Affected users/data/availability, feasible prerequisites, severity rationale.
Separate demonstrated impact from possible consequences.]

## Evidence
- Reproduction video: [video](REVIEWER_ACCESSIBLE_URL)
- Key timestamp: [time where the failure is visible]
- Screenshot: [screenshot](REVIEWER_ACCESSIBLE_URL)
- Replay script and fixtures: [download or immutable source link]
- Sanitized console/network evidence: [inline excerpt or accessible attachment]

## Verification and limits
[Clean-state repeat count, working control, actual-vs-mocked data boundaries,
relevant screenshot difference counts if references exist, untested conditions.]
```

Keep the full payload and setup recoverable from the steps and linked artifacts. A caption claiming a vulnerability, a screenshot alone, or a local video filename does not replace the reproduction video. Do not guess a root cause; add a code pointer only when inspected and supported by the replay.

# Red-agent skill

The repository provides an adversarial web-view testing skill at `../.agents/skills/red-agent`, in the location requested for this workflow. This directory is not an additional project-skill discovery root for Skill Atlas.

- The skill evaluates the web view and scan API against the web specification and security trust boundaries, using synthetic inputs and local or explicitly authorized targets.
- It confirms and minimizes failures, distinguishes functional regressions from demonstrated security impact, and retains a repeatable scenario and sanitized evidence for each distinct bug.
- Recordings follow `.agents/skills/process-tracks/`: readable captions and cursor, Chromium at 1280×720, retained video and PNGs, finalized browser contexts, and pixel comparisons with corresponding references when present.
- Each confirmed bug gets one GitHub issue with the `use_AI` label, exact setup and reproduction steps, expected and actual behavior, impact, and a verified reviewer-accessible video link. Existing duplicate reports are updated instead of duplicated.
- Missing issue permissions, label permissions, or video hosting leave a locally preserved report marked pending filing. Unconfirmed hypotheses do not become issues; creating the skill does not itself execute testing or filing.

This is a workflow artifact; application behavior and automated skill-discovery rules remain as specified in the other documents.

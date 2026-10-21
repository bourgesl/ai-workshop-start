---
name: red-agent
description: Adversarially test the Skill Atlas web view with penetration-testing, security evaluation, and attack workflows; reproduce each confirmed bug and file a use_AI GitHub issue with steps and video evidence. Use when asked to break or security-test the web view.
---

# Red agent

Find reproducible failures in the web view, prove their impact, and file one GitHub issue labelled `use_AI` per distinct bug. Include functional failures discovered during the security evaluation. Report findings; implement fixes only when requested.

## Establish the target

1. Read the project's `../../../AGENTS.md` and `spec/`, especially `spec/web.md`. Record the tested commit, working-tree changes, Node/browser versions, target URL, and relevant configuration without exposing secrets.
2. Use the specified target and issue repository. Otherwise use a disposable local instance of this checkout and resolve the GitHub repository from its Git remote (`gh repo view --json nameWithOwner,url`). Do not infer a separate deployment is authorized from the remote. Confirm ambiguity only when it blocks testing or reporting.
3. Use synthetic repositories, temporary directories, marker files, and dummy credentials. Keep active attacks within the local instance or explicitly authorized targets. Require explicit scope for third-party systems, destructive tests, or sustained load. Do not read real secrets or send captured data elsewhere to demonstrate impact.
4. Inspect existing dependencies before installing anything. Run `npm ci` first in a fresh checkout. Start the normal app with `./skill-atlas serve`; for deterministic GitHub scenarios, use `createWebServer` and `listen` from `../../../src/web.ts`, `openGitHub` from `src/core/github.ts`, and `replay` from `src/core/replay.ts`. Bind local harnesses to `127.0.0.1` on an available port and close them afterwards.

Creating this skill does not execute an audit. When invoked to perform an audit, issue filing is part of this workflow; do not request repetitive confirmation for each ordinary report in the authorized repository.

## Attack and verify

Read [references/attack-workflows.md](references/attack-workflows.md) to choose attacks appropriate to the implementation. Track each hypothesis, attacker-controlled input, expected boundary, actual observation, and disposition: confirmed, not reproduced, or blocked.

- Exercise both the real browser and `GET /api/scan?repo=...`; API-only probes need a browser-visible reproduction or evidence display for the video.
- Start with a working control, change one relevant input, and compare outcomes. Inspect console errors, responses, and rendered state as well as screenshots.
- Supply malicious repository content through fixtures or recorded upstream responses while preserving the app's real parsing and rendering. Browser response interception can isolate a renderer hypothesis, but cannot alone prove that an attacker can deliver that response through the real scan pipeline.
- Treat unexpected behavior as a hypothesis until a minimal replay demonstrates it. Confirm security impact by showing a crossed trust boundary with harmless markers. A missing header or a scary input alone is not a vulnerability. Distinguish spec regressions from security findings and state realistic attacker prerequisites.
- Reproduce from a clean browser context with exact payload bytes and deterministic fixtures. Save the smallest replay script or integration scenario and its setup. Do not change application behavior to make an exploit succeed.
- Group payload variants sharing one root cause into one bug. Keep separate causes separate even if they produce the same visible symptom. Avoid repeated exploitation once sufficient evidence exists.

## Record each confirmed bug

Read the existing [process-tracks skill](../process-tracks/SKILL.md) and its [sample scenario](../process-tracks/sample_demo.ts), linked relative to this skill directory. Also consult `../../../e2e/web.spec.ts` and `playwright.config.ts` from the project root. Adapt the process-tracks scenario to the minimal failing case; do not rerun only its happy-path demo as bug evidence.

1. Create a separate evidence directory per finding under `docs/demo/test/red-agent/<bug-slug>/`. When `AIR_ARTIFACTS_DIR` is set, place durable copies there, or append the evidence directory glob to `AIR_ARTIFACTS_WATCH_LIST` when available. Do not overwrite prior recordings.
2. Record Chromium at a 1280×720 viewport and video size, using Playwright `recordVideo` or the existing test runner's `video: on`. Keep the caption banner, visible cursor, readable pacing, and screenshots from process-tracks. Captions describe the input, expected result, and observed failure; they must not obscure evidence or create the claimed effect.
3. Show the working control, exact attack actions, and observed failure or harmless impact marker. Keep the target and relevant payload visible. Capture console/network evidence alongside the recording for facts the video cannot show. Use assertions for the observed bug and control; do not describe a passing regression check as a reproduced failure.
4. Save the page's video handle, close its browser context to finalize the recording, then retrieve/save the video path. Use `finally` cleanup to close contexts, browsers, servers, and temporary fixtures even when an assertion fails. Verify the resulting video exists, is nonempty, plays, and covers the full reproduction. Keep the `.webm`, `.png` screenshots, replay script, fixtures, and sanitized logs.
5. If `docs/demo/ref/` contains corresponding reference screenshots, compare matching screenshots pixel by pixel at identical dimensions and report the differing pixel count (dimension mismatch is a difference). Skip when no matching reference exists. A visual difference supports investigation; prove the bug separately. Do not replace reference images as part of this audit.

Never put real tokens, cookies, personal data, or sensitive filesystem contents in artifacts or issues. Use synthetic values from the start so the replay remains exact.

## File one issue per bug

Use [references/issue-template.md](references/issue-template.md) as the issue body. Complete every applicable field, including exact numbered reproduction steps and a reviewer-accessible video.

1. Resolve the destination repository explicitly. Check authentication and existing issues, including closed ones, before filing (`gh issue list --repo OWNER/REPO --state all --search '<symptom keywords>'`). Inspect likely matches; an unrelated keyword match is not a duplicate. Add new steps and video to an existing report of the same bug rather than opening a duplicate. Ensure that report has `use_AI`.
2. Publish the sanitized video and screenshots through an available supported issue-attachment/browser workflow or an authorized durable artifact host. Confirm the links work for intended reviewers. GitHub CLI does not attach a local video merely because its path appears in Markdown. Do not use local disk paths, session-only links, invented URLs, or `gh issue create --attach`. Do not commit evidence to a branch or publish it to another service unless that action is authorized.
3. Verify `use_AI` exists in the target repository. If absent, create it with `gh label create use_AI --repo OWNER/REPO --description 'Bugs reported by AI evaluation' --color 5319E7`. Do not overwrite an existing label's metadata. If permissions prevent label creation or assignment, record the blocker; do not claim the required label was applied.
4. Write the exact issue body to a UTF-8 file and use `gh issue create --repo OWNER/REPO --title '<specific symptom and trigger>' --label use_AI --body-file <body-file>`, or the equivalent supported repository connector. For an existing duplicate, use supported comment/edit operations to add evidence and apply the label.
5. Read back the created or updated issue to verify its repository, `use_AI` label, numbered steps, and video link. If a request times out or returns an uncertain result, check for the issue before retrying to avoid duplicates. Stop retries on an authentication or permission failure.

If video hosting or issue access is unavailable, preserve the complete report and evidence locally, continue other independent testing, and report the exact blocker. Mark that finding as **pending filing**, not filed or complete. Never invent an issue URL or count a report without its required video and label as finished.

Finish with the tested target and commit, confirmed findings and their verified issue/video links, duplicate reports updated, coverage and limits, and any pending reports with evidence locations. If no bugs were confirmed, say so and summarize what was exercised; do not file speculative issues.

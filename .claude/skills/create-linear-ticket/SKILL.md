---
name: create-linear-ticket
description: Create a well-structured Linear issue with codebase context gathering and open questions
argument-hint: [brief description of what the ticket is about]
---

# Create Linear Ticket

Creating a ticket is outward-facing, so the user sees and confirms the full draft before anything is written to Linear.

## 1. Gather Codebase Context

- Read the relevant source files the user mentions or that relate to the task
- Identify affected components, hooks, utilities, and routing
- Look for existing patterns, helpers, or abstractions that are relevant to the implementation
- Note the file paths and key technical details

## 2. Ask Clarifying Questions

Before creating the ticket, use AskUserQuestion to resolve any ambiguity:

- UX or design decisions that affect implementation
- Scope boundaries (what's in vs. out)
- Priority if not specified
- Any other open questions that would change the ticket content

## 3. Draft the Ticket

Prepare the full ticket content.

### Title Guidelines

- Use imperative mood ("Add...", "Fix...", "Update...")
- Keep under 70 characters
- Be specific about what and where

### Team

Always use the **App** team (key: APP).

### Labels

- `Bug` — Something is broken
- `Feature` — New functionality
- `Improvement` — Enhancement to existing functionality
- `Legal` — Legal/compliance work
- `Design` — Visual/design work
- `UX` — User experience improvements
- `Mktg site` — Marketing site work
- `webapp` _(sub-label of app)_ — Issues in the main webapp
- `maker-gov-portal` _(sub-label of app)_ — Maker governance portal
- `sky-gov-portal` _(sub-label of app)_ — Sky governance portal

### Projects

Check the team's project list at ticket time (`mcp__linear-server__list_projects` with team `App`) rather than trusting this table — statuses change. Active projects at the time of writing:

| Project            | Use for                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| Webapp V2 Redesign | The app redesign                                                                     |
| US Launch          | T&C, screening and geo work for the US launch                                        |
| App Maintanance    | Ongoing bugs and maintenance (sic — the Linear name is misspelled; match it exactly) |
| Infrastructure     | Infra, CI, hosting                                                                   |

### Statuses

Backlog → Todo → In Progress → In Review → Done _(or Canceled / Duplicate)_

### Description Format

Structure the description with these sections:

```markdown
## Summary

1-2 sentence overview of what needs to happen and why.

## Current Behavior

What happens today (be specific, reference components/files).

## Desired Behavior

What should happen after implementation. Include concrete details like URLs, UI states, or data flow.

## Implementation Notes

- Files to modify (with paths)
- Existing patterns or utilities to reuse
- Technical constraints or considerations
- Suggested approach based on codebase conventions

## Design Considerations

Any UX decisions that need design input (omit if none).

## Acceptance Criteria

- [ ] Specific, testable criteria
- [ ] Cover the main scenarios
- [ ] Include edge cases if relevant
- [ ] Include accessibility requirements if applicable
```

## 4. Preview and Confirm

Before creating the ticket, output the full draft to the user including:

- **Title**
- **Team**
- **Labels**
- **Project** (if applicable)
- **Full description** (rendered markdown)

Then use AskUserQuestion to ask the user to confirm:

- "Create this ticket?" with options: "Yes, create it", "Edit first" (let the user provide changes)

## 5. Create the Ticket

After the user confirms, use `mcp__linear-server__save_issue` to create the issue with:

- `title`
- `team` (team name)
- `description`
- `labels` (array of label names)
- `project` (project name, if applicable)
- `state` (default to "Backlog" unless specified)

Return the ticket URL and a brief summary of what was created.

# mitv-stick-remote

A custom remote control and debugging tool for a Mi TV Stick connected to the bedroom TV.

## Why

The stock remote is simple and good, but:

- It gets lost, and it needs batteries.
- Typing a search with the arrow keys on an on-screen keyboard is slow.
- Some shortcuts (specific apps, settings, power actions) are not on it.
- There is no way to see what the stick is doing (status, network, current app) when debugging.

The goal is a remote that keeps the same simple feel, with customizable shortcuts, real keyboard input and device status info. It should be quick to iterate on and easy to test.

## Goals

1. Basic remote parity: D-pad, OK, Back, Home, volume, power.
2. Type-to-search: send text from a real keyboard straight into the focused field.
3. Customizable shortcut buttons (launch an app, open a deep link, run a key sequence).
4. Device status and debug info: current app, network, storage, memory, logs.
5. Fast dev loop: mock device, one-command run, automated tests, a repeatable manual test checklist.

## Non-goals (for now)

- Supporting multiple TVs or households.
- Replacing the stock remote for first-time pairing and setup.
- Cloud accounts or remote access outside the home network.

## Status

Scaffolding only. Requirements will be added as GitHub issues, then built from those.

## Docs

- [Context and use cases](docs/context.md)
- [Open questions](docs/open-questions.md)

## Contributing and workflow

- Each requirement is a GitHub issue (use the Requirement template).
- Work happens on short branches and lands via pull request that references the issue.

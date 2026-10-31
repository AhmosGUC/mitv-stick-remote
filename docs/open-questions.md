# Decisions and open questions

## Decided (2026-10-31)

- First client: laptop. Web app. Prototype first.
- Control path: network ADB (covers keys, text, app launch, settings, status). The Android TV Remote protocol stays an option later.
- Stack: Node + TypeScript server with no runtime dependencies; React + Vite + Mantine UI.
- Shortcuts wanted first: apps the owner selects, and settings screens.
- Status wanted first: network and RAM.
- Keyboard languages: English and Arabic. English works now; Arabic is a known gap.
- Willing to enable developer options and network debugging on the stick.

## Still open

1. Stick generation and Android version (run `npm run doctor`).
2. Arabic input: which approach? A helper keyboard app on the stick, or switch to the Android TV Remote protocol.
3. Phone access: needed later? It affects binding, auth and HTTPS.
4. Which apps and settings screens should be built-in shortcuts?
5. Extra status wanted (temperature, storage, logs)?

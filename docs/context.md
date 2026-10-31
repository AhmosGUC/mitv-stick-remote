# Context

## Device

- Mi TV Stick (Android TV / Google TV based), connected to the bedroom TV.
- Stock remote: very basic, the owner likes its simplicity. Often misplaced, battery powered.

## Owner use cases (raw, from the project brief)

1. Can't find the physical remote, so control it from another device.
2. Search is painful: typing means moving through the on-screen keyboard with arrows. Wants to type on a real keyboard.
3. Wants shortcuts that the stock remote lacks.
4. Wants customization of the layout and shortcuts.
5. Wants more status info from the stick, so it doubles as a debugging tool.
6. Wants to avoid replacing remote batteries.

## Working principles

- Keep the core remote as simple as the stock one. Extras live behind customization.
- Optimize for fast iteration: a mock device, quick restarts, small testable units.
- Every requirement becomes a GitHub issue with acceptance criteria before it is built.

## Candidate control paths (to be decided, see open questions)

- ADB over the network: key events, text input, launching apps, and `dumpsys` / `getprop` for status. Needs developer options and network debugging enabled on the stick.
- Android TV Remote protocol (the one the Google TV phone app uses): pairing with a code, key events, and text input through the IME.
- HDMI-CEC from another device: limited, mostly power and volume.

Likely a combination: the Remote protocol for everyday control, ADB for shortcuts and debug info.

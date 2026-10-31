# mitv-stick-remote

A custom remote control and debugging tool for a Mi TV Stick connected to the bedroom TV. It runs on your laptop as a small web app: a D-pad remote, real-keyboard typing, your own shortcuts, and live status from the stick (RAM, network, foreground app).

## Quick start

You need **Node 22.18+** and **adb** ([Android platform-tools](https://developer.android.com/tools/releases/platform-tools)) on your laptop.

**1. Prepare the stick (once)**
- Settings > Device Preferences > About > click **Build** 7 times to unlock Developer options.
- Settings > Device Preferences > Developer options > turn on **USB debugging**.
  On Android 11+ you may see **Wireless debugging** instead: open it, run `adb pair <ip>:<pairing-port>` with the code shown, and put the port from the main Wireless debugging screen in `STICK_PORT`.
- Reserve the stick's IP address in your router so it never changes.

**2. Run it**
```bash
cp .env.example .env      # then set STICK_HOST to the stick's IP
npm install
npm run doctor            # checks adb, connects, prints the stick model and Android version
npm run dev               # opens the UI at http://localhost:5173
```
The first connection makes the TV show an "Allow USB debugging?" prompt. Tick "Always allow" and accept it with the stick's own remote.

**No stick handy?** `npm run dev:mock` runs everything against a pretend device.

## Using it

- **Remote** (left): D-pad, OK, Back, Home, Menu, media and volume keys.
- **Laptop keyboard** switch:
  - *Navigate*: arrows move, Enter = OK, Esc/Backspace = Back, Home = Home, Space = Play/Pause.
  - *Type*: arrows still move, and everything else you type goes straight into the TV's search box.
- **Shortcuts**: one-click apps, settings screens and key presses. Use "Add app from the stick" to pick any installed app. Edit `config/shortcuts.json` for built-in ones (apps, Android intents, key sequences).
- **Status**: RAM, Wi-Fi name/signal/speed/band, IP, foreground app, round-trip time.
- **Log**: every command with timing and errors, for debugging.

## Testing

```bash
npm test                  # 18 server tests (parsers, API, security guards), no dependencies needed
npm run dev:mock          # try the whole UI without the stick
npm run doctor            # verify the real stick
```

## Known limitations

- Typing is **ASCII only** (English). Arabic needs a helper keyboard installed on the stick.
- Some Settings shortcuts may not exist on the Mi stick's firmware; the log shows the error.
- Volume keys act on the stick; whether they reach the TV depends on HDMI-CEC.
- Binds to localhost only. Set `HOST=0.0.0.0` (and `ALLOWED_HOSTS` if you use a host name) to use it from your phone; anyone on your network could then control the TV.

## How it works

```
Browser (React + Mantine)  ->  Node server (no dependencies)  ->  adb  ->  Mi TV Stick
```

The server hides ADB behind a small `Device` interface (`server/src/device.ts`) with two implementations: real ADB and a mock. Commands run one at a time in the order sent. Inputs are validated before they reach the device shell.

## Docs

- [Context and use cases](docs/context.md)
- [Decisions and open questions](docs/open-questions.md)

## Workflow

Each requirement is a GitHub issue (use the Requirement template). Work lands through pull requests that reference the issue.

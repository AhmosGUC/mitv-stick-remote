// Friendly key names -> Android keycodes (sent with `input keyevent`).
export const KEYS = {
  UP: 'KEYCODE_DPAD_UP',
  DOWN: 'KEYCODE_DPAD_DOWN',
  LEFT: 'KEYCODE_DPAD_LEFT',
  RIGHT: 'KEYCODE_DPAD_RIGHT',
  OK: 'KEYCODE_DPAD_CENTER',
  ENTER: 'KEYCODE_ENTER',
  BACK: 'KEYCODE_BACK',
  HOME: 'KEYCODE_HOME',
  MENU: 'KEYCODE_MENU',
  SEARCH: 'KEYCODE_SEARCH',
  DELETE: 'KEYCODE_DEL',
  VOL_UP: 'KEYCODE_VOLUME_UP',
  VOL_DOWN: 'KEYCODE_VOLUME_DOWN',
  MUTE: 'KEYCODE_VOLUME_MUTE',
  POWER: 'KEYCODE_POWER',
  SLEEP: 'KEYCODE_SLEEP',
  WAKEUP: 'KEYCODE_WAKEUP',
  PLAY_PAUSE: 'KEYCODE_MEDIA_PLAY_PAUSE',
  REWIND: 'KEYCODE_MEDIA_REWIND',
  FAST_FORWARD: 'KEYCODE_MEDIA_FAST_FORWARD',
} as const;

export type KeyName = keyof typeof KEYS;

export const KEY_NAMES = Object.keys(KEYS) as KeyName[];

export function isKeyName(value: unknown): value is KeyName {
  return typeof value === 'string' && Object.hasOwn(KEYS, value);
}

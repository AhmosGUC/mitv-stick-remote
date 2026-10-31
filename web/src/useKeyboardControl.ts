import { useEffect } from 'react';
import type { Sender } from './sender';
import type { KeyboardMode, KeyName } from './types';

const ARROWS: Record<string, KeyName> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
};

/**
 * Turns your laptop keyboard into the remote.
 *  - navigate: arrows, Enter = OK, Esc/Backspace = Back, Home = Home, Space = Play/Pause
 *  - type:     arrows move, Enter = Enter, Backspace = delete, Esc = Back, letters are typed on the TV
 * Keys pressed inside text fields (or with Ctrl/Cmd/Alt) are left alone.
 */
export function useKeyboardControl(mode: KeyboardMode, sender: Sender): void {
  useEffect(() => {
    if (mode === 'off') return;

    const onKeyDown = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const arrow = ARROWS[e.key];
      let handled = true;
      if (arrow) sender.key(arrow);
      else if (e.key === 'Enter') sender.key(mode === 'type' ? 'ENTER' : 'OK');
      else if (e.key === 'Escape') sender.key('BACK');
      else if (e.key === 'Backspace') sender.key(mode === 'type' ? 'DELETE' : 'BACK');
      else if (mode === 'navigate' && e.key === 'Home') sender.key('HOME');
      else if (mode === 'navigate' && e.key === ' ') sender.key('PLAY_PAUSE');
      else if (mode === 'type' && e.key.length === 1) sender.type(e.key);
      else handled = false;

      if (handled) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      sender.flush();
    };
  }, [mode, sender]);
}

import { notifications } from '@mantine/notifications';

export function showError(error: unknown, title = 'Command failed'): void {
  notifications.show({
    color: 'red',
    title,
    message: error instanceof Error ? error.message : String(error),
    autoClose: 6000,
  });
}

export function showInfo(message: string): void {
  notifications.show({ color: 'teal', message, autoClose: 2500 });
}

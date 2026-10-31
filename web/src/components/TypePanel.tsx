import { useState } from 'react';
import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import type { Sender } from '../sender';

export function TypePanel({ sender }: { sender: Sender }) {
  const [value, setValue] = useState('');

  const send = (submit: boolean): void => {
    if (value.trim() === '') return;
    sender.text(value, submit);
    setValue('');
  };

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        On the TV, open a search box so the cursor is blinking in it. Then type here and send.
      </Text>
      <TextInput
        label="Text to type on the TV"
        placeholder="e.g. stranger things"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            send(true);
          }
        }}
        data-autofocus
      />
      <Group>
        <Button onClick={() => send(false)}>Send</Button>
        <Button variant="light" onClick={() => send(true)}>
          Send + Enter
        </Button>
        <Button variant="subtle" color="gray" onClick={() => sender.key('DELETE')}>
          Backspace
        </Button>
      </Group>
      <Alert variant="light" color="yellow" title="English only for now">
        Typing goes through ADB, which only supports plain ASCII. Arabic input needs a helper keyboard on the stick;
        it is on the list for a later version.
      </Alert>
    </Stack>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Badge, Container, Grid, Group, Paper, SegmentedControl, Stack, Tabs, Text, Title } from '@mantine/core';
import { api } from './api';
import { LogPanel } from './components/LogPanel';
import { MemoryPanel } from './components/MemoryPanel';
import { RemotePad } from './components/RemotePad';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { StatusPanel } from './components/StatusPanel';
import { TypePanel } from './components/TypePanel';
import { showError } from './notify';
import { createSender } from './sender';
import type { Info, KeyboardMode } from './types';
import { useKeyboardControl } from './useKeyboardControl';
import { useStatus } from './useStatus';

const KEYBOARD_HELP: Record<KeyboardMode, string> = {
  off: 'Use the on-screen buttons.',
  navigate: 'Arrows move, Enter = OK, Esc / Backspace = Back, Home = Home, Space = Play/Pause.',
  type: 'Arrows move, Enter = Enter, Backspace deletes, Esc = Back. Everything else you type goes to the TV.',
};

export default function App() {
  const [info, setInfo] = useState<Info | null>(null);
  const [kbMode, setKbMode] = useState<KeyboardMode>('off');
  const sender = useMemo(() => createSender((e) => showError(e)), []);
  const { status, error, refresh } = useStatus(5000);

  useKeyboardControl(kbMode, sender);

  useEffect(() => {
    api.info().then(setInfo).catch(() => setInfo(null));
  }, []);

  const online = !error && status?.connected === true;

  return (
    <Container size="lg" py="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Mi TV Remote</Title>
        <Group gap="xs">
          {info?.mode === 'mock' && <Badge color="yellow">Mock device</Badge>}
          <Badge color={online ? 'teal' : 'red'}>{online ? 'Stick connected' : 'Stick offline'}</Badge>
        </Group>
      </Group>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="lg" radius="lg">
            <Stack gap="lg">
              <RemotePad sender={sender} />
              <Stack gap={6}>
                <Text size="sm" fw={600}>
                  Laptop keyboard
                </Text>
                <SegmentedControl
                  fullWidth
                  value={kbMode}
                  onChange={(v) => setKbMode(v as KeyboardMode)}
                  data={[
                    { label: 'Off', value: 'off' },
                    { label: 'Navigate', value: 'navigate' },
                    { label: 'Type', value: 'type' },
                  ]}
                />
                <Text size="xs" c="dimmed">
                  {KEYBOARD_HELP[kbMode]}
                </Text>
              </Stack>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="lg" radius="lg">
            <Tabs defaultValue="shortcuts" keepMounted={false}>
              <Tabs.List mb="md">
                <Tabs.Tab value="shortcuts">Shortcuts</Tabs.Tab>
                <Tabs.Tab value="type">Type</Tabs.Tab>
                <Tabs.Tab value="status">Status</Tabs.Tab>
                <Tabs.Tab value="memory">Memory</Tabs.Tab>
                <Tabs.Tab value="log">Log</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="shortcuts">
                <ShortcutsPanel sender={sender} />
              </Tabs.Panel>
              <Tabs.Panel value="type">
                <TypePanel sender={sender} />
              </Tabs.Panel>
              <Tabs.Panel value="status">
                <StatusPanel status={status} error={error} onRefresh={() => void refresh()} />
              </Tabs.Panel>
              <Tabs.Panel value="memory">
                <MemoryPanel status={status} />
              </Tabs.Panel>
              <Tabs.Panel value="log">
                <LogPanel />
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

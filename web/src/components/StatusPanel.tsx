import { Alert, Badge, Button, Group, Paper, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import type { DeviceStatus } from '../types';

function signalLabel(rssi: number): { text: string; color: string } {
  if (rssi >= -55) return { text: 'Excellent', color: 'teal' };
  if (rssi >= -67) return { text: 'Good', color: 'green' };
  if (rssi >= -75) return { text: 'Fair', color: 'yellow' };
  return { text: 'Weak', color: 'red' };
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <Group justify="space-between" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ff="monospace">
        {value ?? '—'}
      </Text>
    </Group>
  );
}

export function StatusPanel(props: { status: DeviceStatus | null; error: string | null; onRefresh: () => void }) {
  const { status, error, onRefresh } = props;

  if (error) {
    return (
      <Alert color="red" title="Local server not reachable">
        {error}. Is `npm run dev` still running?
      </Alert>
    );
  }
  if (!status) return <Text c="dimmed">Loading…</Text>;

  const mem = status.memory;
  const net = status.network;
  const memColor = !mem ? 'gray' : mem.usedPct > 85 ? 'red' : mem.usedPct > 70 ? 'yellow' : 'teal';
  const signal = net?.rssi === undefined ? null : signalLabel(net.rssi);

  return (
    <Stack>
      {!status.connected && (
        <Alert color="red" title="Cannot reach the stick">
          {status.error ?? 'No response.'}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Connection</Text>
              <Badge color={status.connected ? 'teal' : 'red'}>{status.connected ? 'Connected' : 'Offline'}</Badge>
            </Group>
            <Row label="Device" value={status.label} />
            <Row label="Round trip" value={status.latencyMs === null ? undefined : `${status.latencyMs} ms`} />
            <Row label="Foreground app" value={status.foregroundApp} />
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text fw={600}>Memory (RAM)</Text>
            {mem ? (
              <>
                <Progress value={mem.usedPct} color={memColor} size="lg" />
                <Row label="Used" value={`${mem.usedMb} / ${mem.totalMb} MB (${mem.usedPct}%)`} />
                <Row label="Available" value={`${mem.availableMb} MB`} />
              </>
            ) : (
              <Text size="sm" c="dimmed">
                No data
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>Network</Text>
              {signal && <Badge color={signal.color}>{signal.text}</Badge>}
            </Group>
            <Row label="Wi-Fi" value={net?.ssid} />
            <Row label="IP address" value={net?.ip} />
            <Row label="Signal" value={net?.rssi === undefined ? undefined : `${net.rssi} dBm`} />
            <Row label="Link speed" value={net?.linkSpeedMbps === undefined ? undefined : `${net.linkSpeedMbps} Mbps`} />
            <Row
              label="Band"
              value={net?.frequencyMhz === undefined ? undefined : net.frequencyMhz > 4000 ? `5 GHz (${net.frequencyMhz} MHz)` : `2.4 GHz (${net.frequencyMhz} MHz)`}
            />
          </Stack>
        </Paper>
      </SimpleGrid>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Updated {new Date(status.checkedAt).toLocaleTimeString()} · refreshes every 5 s
        </Text>
        <Button size="xs" variant="subtle" onClick={onRefresh}>
          Refresh now
        </Button>
      </Group>
    </Stack>
  );
}

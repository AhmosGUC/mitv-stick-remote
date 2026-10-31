import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Progress, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { api } from '../api';
import { showError, showInfo } from '../notify';
import type { DeviceStatus, ProcessMemory } from '../types';

// Android app packages look like com.foo.bar (a ":sub" suffix is one of the app's extra processes).
// System and native processes (system, /init, zygote…) have no package, so they can't be stopped here.
const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const packageOf = (name: string): string | null => {
  const pkg = name.split(':')[0] ?? '';
  return PACKAGE_RE.test(pkg) ? pkg : null;
};

export function MemoryPanel({ status }: { status: DeviceStatus | null }) {
  const [processes, setProcesses] = useState<ProcessMemory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProcesses(await api.processes());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = async (pkg: string): Promise<void> => {
    setStopping(pkg);
    setConfirming(null);
    try {
      await api.killApp(pkg);
      showInfo(`Stopped ${pkg}`);
      await load();
    } catch (e) {
      showError(e, `Could not stop ${pkg}`);
    } finally {
      setStopping(null);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const total = processes?.reduce((sum, p) => sum + p.memoryMb, 0) ?? 0;
  const top = processes?.[0]?.memoryMb ?? 1;
  const ram = status?.memory;

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {processes
            ? `${processes.length} processes, ${Math.round(total)} MB${ram ? ` of ${ram.totalMb} MB total RAM` : ''}`
            : 'Reading the stick…'}
        </Text>
        <Button size="xs" variant="light" onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Could not read process memory">
          {error}
        </Alert>
      )}

      {!processes && !error && <Loader size="sm" />}

      {processes && (
        <ScrollArea h={460}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Process</Table.Th>
                <Table.Th w={120}>RAM (PSS)</Table.Th>
                <Table.Th w={130} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {processes.map((p) => (
                <Table.Tr key={p.pid}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {p.name}
                    </Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">
                        pid {p.pid}
                      </Text>
                      {p.state && (
                        <Badge size="xs" variant="light" color="blue">
                          {p.state}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                      {p.memoryMb.toFixed(1)} MB
                    </Text>
                    <Progress value={(p.memoryMb / top) * 100} size="xs" />
                  </Table.Td>
                  <Table.Td>
                    {(() => {
                      const pkg = packageOf(p.name);
                      if (!pkg) return null;
                      if (confirming === p.name) {
                        return (
                          <Group gap={4} wrap="nowrap">
                            <Button size="compact-xs" color="red" onClick={() => void stop(pkg)}>
                              Confirm
                            </Button>
                            <Button size="compact-xs" variant="subtle" color="gray" aria-label="Cancel" onClick={() => setConfirming(null)}>
                              ✕
                            </Button>
                          </Group>
                        );
                      }
                      return (
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="red"
                          loading={stopping === pkg}
                          disabled={stopping !== null}
                          onClick={() => setConfirming(p.name)}
                        >
                          Stop
                        </Button>
                      );
                    })()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, Progress, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { api } from '../api';
import type { DeviceStatus, ProcessMemory } from '../types';

export function MemoryPanel({ status }: { status: DeviceStatus | null }) {
  const [processes, setProcesses] = useState<ProcessMemory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
                <Table.Th>PID</Table.Th>
                <Table.Th w={150}>RAM (PSS)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {processes.map((p) => (
                <Table.Tr key={p.pid}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {p.name}
                    </Text>
                    {p.state && (
                      <Badge size="xs" variant="light" color="blue">
                        {p.state}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{p.pid}</Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                      {p.memoryMb.toFixed(1)} MB
                    </Text>
                    <Progress value={(p.memoryMb / top) * 100} size="xs" />
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

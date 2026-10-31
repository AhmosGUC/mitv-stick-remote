import { useEffect, useState } from 'react';
import { Badge, ScrollArea, Table, Text } from '@mantine/core';
import { api } from '../api';
import type { LogEntry } from '../types';

export function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      api.log().then((list) => alive && setEntries(list)).catch(() => undefined);
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (entries.length === 0) return <Text c="dimmed">Nothing sent yet. Press a button.</Text>;

  return (
    <ScrollArea h={460}>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Action</Table.Th>
            <Table.Th>Detail</Table.Th>
            <Table.Th>ms</Table.Th>
            <Table.Th>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {entries.map((e) => (
            <Table.Tr key={e.id}>
              <Table.Td>{new Date(e.ts).toLocaleTimeString()}</Table.Td>
              <Table.Td>{e.kind}</Table.Td>
              <Table.Td>{e.detail}</Table.Td>
              <Table.Td>{e.ms}</Table.Td>
              <Table.Td>
                <Badge color={e.ok ? 'teal' : 'red'}>{e.ok ? 'ok' : 'failed'}</Badge>
                {e.error && (
                  <Text size="xs" c="red">
                    {e.error}
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

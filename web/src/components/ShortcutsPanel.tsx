import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconX } from '@tabler/icons-react';
import { api } from '../api';
import { showError, showInfo } from '../notify';
import type { Sender } from '../sender';
import type { InstalledApp, Shortcut } from '../types';

function defaultLabel(pkg: string): string {
  const last = pkg.split('.').pop() ?? pkg;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function AddAppModal({ opened, onClose, onPinned }: { opened: boolean; onClose: () => void; onPinned: () => void }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!opened) return;
    setApps(null);
    setSelected(null);
    setFilter('');
    api.apps().then(setApps).catch((e: unknown) => {
      showError(e, 'Could not list apps');
      onClose();
    });
    // Only refetch when the modal opens, not when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const visible = useMemo(
    () => (apps ?? []).filter((a) => a.package.toLowerCase().includes(filter.toLowerCase())),
    [apps, filter],
  );

  const pin = async (): Promise<void> => {
    if (!selected) return;
    try {
      await api.pinShortcut(label.trim() || defaultLabel(selected), 'Apps', { type: 'app', package: selected });
      showInfo('Shortcut added');
      onPinned();
      onClose();
    } catch (e) {
      showError(e, 'Could not add shortcut');
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add an app shortcut" size="md">
      {apps === null ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : selected ? (
        <Stack>
          <Text size="sm" c="dimmed">
            {selected}
          </Text>
          <TextInput label="Button label" value={label} onChange={(e) => setLabel(e.currentTarget.value)} data-autofocus />
          <Group>
            <Button onClick={() => void pin()}>Add shortcut</Button>
            <Button variant="subtle" color="gray" onClick={() => setSelected(null)}>
              Back
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <TextInput placeholder="Filter apps" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} data-autofocus />
          <ScrollArea h={320}>
            <Stack gap={4}>
              {visible.map((a) => (
                <Button
                  key={a.package}
                  variant="subtle"
                  color="gray"
                  justify="flex-start"
                  onClick={() => {
                    setSelected(a.package);
                    setLabel(defaultLabel(a.package));
                  }}
                >
                  {a.package}
                </Button>
              ))}
              {visible.length === 0 && <Text c="dimmed">No matching apps.</Text>}
            </Stack>
          </ScrollArea>
        </Stack>
      )}
    </Modal>
  );
}

export function ShortcutsPanel({ sender }: { sender: Sender }) {
  const [items, setItems] = useState<Shortcut[]>([]);
  const [opened, { open, close }] = useDisclosure(false);

  const load = useCallback(() => {
    api.shortcuts().then(setItems).catch((e: unknown) => showError(e, 'Could not load shortcuts'));
  }, []);
  useEffect(load, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Shortcut[]>();
    for (const s of items) {
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return [...map.entries()];
  }, [items]);

  const unpin = async (s: Shortcut): Promise<void> => {
    try {
      await api.unpinShortcut(s.id);
      load();
    } catch (e) {
      showError(e, 'Could not remove shortcut');
    }
  };

  return (
    <Stack gap="lg">
      {groups.map(([group, list]) => (
        <Stack key={group} gap="xs">
          <Title order={6} c="dimmed" tt="uppercase">
            {group}
          </Title>
          <Group gap="xs">
            {list.map((s) => (
              <Group key={s.id} gap={2} wrap="nowrap">
                <Button variant="light" onClick={() => sender.shortcut(s.id)}>
                  {s.label}
                </Button>
                {s.custom && (
                  <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Remove ${s.label}`} onClick={() => void unpin(s)}>
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Group>
        </Stack>
      ))}
      <div>
        <Button variant="default" leftSection={<IconPlus size={16} />} onClick={open}>
          Add app from the stick
        </Button>
      </div>
      <Text size="xs" c="dimmed">
        Built-in shortcuts live in config/shortcuts.json. Apps you add are saved in config/shortcuts.local.json.
      </Text>
      <AddAppModal opened={opened} onClose={close} onPinned={load} />
    </Stack>
  );
}

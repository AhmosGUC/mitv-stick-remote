import type { ReactNode } from 'react';
import { ActionIcon, Button, Group, Stack, Tooltip } from '@mantine/core';
import {
  IconArrowBackUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconHome,
  IconMenu2,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconPower,
  IconSearch,
  IconVolume,
  IconVolume2,
  IconVolumeOff,
} from '@tabler/icons-react';
import type { Sender } from '../sender';
import type { KeyName } from '../types';

function PadButton(props: { label: string; keyName: KeyName; sender: Sender; children: ReactNode; size?: number; color?: string }) {
  const { label, keyName, sender, children, size = 56, color } = props;
  return (
    <Tooltip label={label} openDelay={700}>
      <ActionIcon
        size={size}
        radius="xl"
        variant="light"
        color={color}
        aria-label={label}
        // Keep keyboard focus where it is, so Enter/Space don't re-trigger the last clicked button.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => sender.key(keyName)}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  );
}

export function RemotePad({ sender }: { sender: Sender }) {
  const icon = 26;
  return (
    <Stack align="center" gap="lg">
      <Group justify="space-between" w="100%">
        <PadButton label="Power / sleep" keyName="POWER" sender={sender} color="red">
          <IconPower size={icon} />
        </PadButton>
        <PadButton label="Search" keyName="SEARCH" sender={sender}>
          <IconSearch size={icon} />
        </PadButton>
      </Group>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 8, justifyContent: 'center' }}>
        <div />
        <PadButton label="Up" keyName="UP" sender={sender} size={72}>
          <IconChevronUp size={32} />
        </PadButton>
        <div />
        <PadButton label="Left" keyName="LEFT" sender={sender} size={72}>
          <IconChevronLeft size={32} />
        </PadButton>
        <Button
          h={72}
          radius="xl"
          size="lg"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => sender.key('OK')}
        >
          OK
        </Button>
        <PadButton label="Right" keyName="RIGHT" sender={sender} size={72}>
          <IconChevronRight size={32} />
        </PadButton>
        <div />
        <PadButton label="Down" keyName="DOWN" sender={sender} size={72}>
          <IconChevronDown size={32} />
        </PadButton>
        <div />
      </div>

      <Group gap="md">
        <PadButton label="Back" keyName="BACK" sender={sender}>
          <IconArrowBackUp size={icon} />
        </PadButton>
        <PadButton label="Home" keyName="HOME" sender={sender}>
          <IconHome size={icon} />
        </PadButton>
        <PadButton label="Menu" keyName="MENU" sender={sender}>
          <IconMenu2 size={icon} />
        </PadButton>
      </Group>

      <Group gap="md">
        <PadButton label="Rewind" keyName="REWIND" sender={sender}>
          <IconPlayerTrackPrev size={icon} />
        </PadButton>
        <PadButton label="Play / pause" keyName="PLAY_PAUSE" sender={sender}>
          <IconPlayerPlay size={icon} />
        </PadButton>
        <PadButton label="Fast forward" keyName="FAST_FORWARD" sender={sender}>
          <IconPlayerTrackNext size={icon} />
        </PadButton>
      </Group>

      <Group gap="md">
        <PadButton label="Volume down" keyName="VOL_DOWN" sender={sender}>
          <IconVolume2 size={icon} />
        </PadButton>
        <PadButton label="Mute" keyName="MUTE" sender={sender}>
          <IconVolumeOff size={icon} />
        </PadButton>
        <PadButton label="Volume up" keyName="VOL_UP" sender={sender}>
          <IconVolume size={icon} />
        </PadButton>
      </Group>
    </Stack>
  );
}

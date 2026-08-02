import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquipmentRegistryItem } from '../../shared/api/equipment/equipment.types';
import { EquipmentRegistryTable } from './EquipmentRegistryTable';

function createEquipmentItem(
  overrides: Partial<EquipmentRegistryItem> = {},
): EquipmentRegistryItem {
  return {
    id: 1,
    inventoryNumber: 'INV-001',
    manufacturer: 'DMG MORI',
    model: 'CTX 310',
    name: 'Lathe',
    serialNumber: 'SN-001',
    status: 'ACTIVE',
    statusLabel: 'Active',
    visibleId: 101,
    ...overrides,
  };
}

function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matchMedia = vi.fn((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.add(listener);
        }
      },
    ),
    removeEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          listeners.delete(listener);
        }
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: matchMedia,
    writable: true,
  });

  return {
    matchMedia,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;

      act(() => {
        for (const listener of listeners) {
          listener({
            matches,
            media: '(max-width: 760px)',
          } as MediaQueryListEvent);
        }
      });
    },
  };
}

function renderRegistry() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <EquipmentRegistryTable
        items={[createEquipmentItem()]}
        onOpenEquipment={vi.fn()}
      />
    </ChakraProvider>,
  );
}

describe('EquipmentRegistryTable responsive render', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the desktop table on desktop viewport', () => {
    installMatchMediaMock(false);

    const { container } = renderRegistry();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.equipment-registry-cards')).toBeNull();
  });

  it('renders only mobile cards on mobile viewport', () => {
    installMatchMediaMock(true);

    const { container } = renderRegistry();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('.equipment-registry-cards')).toBeInTheDocument();
  });

  it('switches rendered branch when viewport crosses the breakpoint', () => {
    const media = installMatchMediaMock(false);
    const { container } = renderRegistry();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.equipment-registry-cards')).toBeNull();

    media.setMatches(true);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('.equipment-registry-cards')).toBeInTheDocument();
  });
});

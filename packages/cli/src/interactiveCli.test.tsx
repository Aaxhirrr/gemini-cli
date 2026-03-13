/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startInteractiveUI } from './interactiveCli.js';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  enableMouseEvents: vi.fn(),
  disableMouseEvents: vi.fn(),
  registerCleanup: vi.fn(),
  loadKeyMatchers: vi.fn(),
  checkForUpdates: vi.fn(),
  handleAutoUpdate: vi.fn(),
  mouseProviderProps: null as { mouseEventsEnabled?: boolean } | null,
}));

vi.mock('ink', () => ({
  render: mocks.render,
}));

vi.mock('./utils/cleanup.js', () => ({
  registerCleanup: mocks.registerCleanup,
  setupTtyCheck: vi.fn(() => vi.fn()),
}));

vi.mock('./ui/utils/updateCheck.js', () => ({
  checkForUpdates: mocks.checkForUpdates,
}));

vi.mock('./utils/handleAutoUpdate.js', () => ({
  handleAutoUpdate: mocks.handleAutoUpdate,
}));

vi.mock('./ui/hooks/useKittyKeyboardProtocol.js', () => ({
  useKittyKeyboardProtocol: vi.fn(),
}));

vi.mock('./ui/key/keyMatchers.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./ui/key/keyMatchers.js')>();
  return {
    ...actual,
    loadKeyMatchers: mocks.loadKeyMatchers,
  };
});

vi.mock('./ui/contexts/MouseContext.js', () => ({
  MouseProvider: ({
    children,
    mouseEventsEnabled,
  }: {
    children: React.ReactNode;
    mouseEventsEnabled?: boolean;
  }) => {
    mocks.mouseProviderProps = { mouseEventsEnabled };
    return <>{children}</>;
  },
}));

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    createWorkingStdio: vi.fn(() => ({
      stdout: {
        write: vi.fn(),
        emit: vi.fn(),
      },
      stderr: {
        write: vi.fn(),
      },
    })),
    enableMouseEvents: mocks.enableMouseEvents,
    disableMouseEvents: mocks.disableMouseEvents,
    disableLineWrapping: vi.fn(),
    enableLineWrapping: vi.fn(),
    shouldEnterAlternateScreen: vi.fn((useAlternateBuffer: boolean) => {
      return useAlternateBuffer;
    }),
    recordSlowRender: vi.fn(),
    writeToStdout: vi.fn(),
    getVersion: vi.fn().mockResolvedValue('test-version'),
    debugLogger: {
      warn: vi.fn(),
    },
    coreEvents: {
      emitFeedback: vi.fn(),
    },
  };
});

function findElementByProp(
  element: React.ReactNode,
  propName: string,
): React.ReactElement | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  const props = element.props as Record<string, unknown>;

  if (propName in props) {
    return element;
  }

  const children = React.Children.toArray(props['children'] as React.ReactNode);
  for (const child of children) {
    const found = findElementByProp(child, propName);
    if (found) {
      return found;
    }
  }

  return null;
}

function unwrapFunctionElement(
  element: React.ReactElement,
): React.ReactElement {
  let current: React.ReactNode = element;

  while (React.isValidElement(current) && typeof current.type !== 'function') {
    const props = current.props as Record<string, unknown>;
    const [firstChild] = React.Children.toArray(
      props['children'] as React.ReactNode,
    );
    current = firstChild ?? current;
    if (current === element) {
      break;
    }
  }

  if (!React.isValidElement(current)) {
    throw new Error('Unable to unwrap AppWrapper element');
  }

  return current;
}

describe('startInteractiveUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.mouseProviderProps = null;
    mocks.loadKeyMatchers.mockResolvedValue({ matchers: {}, errors: [] });
    mocks.checkForUpdates.mockResolvedValue(null);
    mocks.render.mockImplementation(
      (element: React.ReactElement) => {
        const unwrappedElement = unwrapFunctionElement(element);
        const appWrapper = unwrappedElement.type as () => React.ReactElement;
        const tree = appWrapper();
        const mouseProviderElement = findElementByProp(
          tree,
          'mouseEventsEnabled',
        );
        if (mouseProviderElement) {
          mocks.mouseProviderProps = {
            mouseEventsEnabled: (
              mouseProviderElement.props as { mouseEventsEnabled?: boolean }
            ).mouseEventsEnabled,
          };
        }

        return { unmount: vi.fn() };
      },
    );
  });

  it('keeps mouse handling active and enables mouse reporting when step mode starts in a standard terminal', async () => {
    vi.stubEnv('GEMINI_STEP_MODE', 'true');

    const config = {
      getScreenReader: vi.fn().mockReturnValue(false),
      getDebugMode: vi.fn().mockReturnValue(false),
      getProjectRoot: vi.fn().mockReturnValue(process.cwd()),
      getUseAlternateBuffer: vi.fn().mockReturnValue(false),
    };

    const settings = {
      merged: {
        general: {
          debugKeystrokeLogging: false,
        },
        ui: {
          incrementalRendering: true,
          hideWindowTitle: true,
        },
      },
    };

    await startInteractiveUI(
      config as never,
      settings as never,
      [],
      process.cwd(),
      undefined,
      {} as never,
    );

    expect(mocks.enableMouseEvents).toHaveBeenCalled();
    expect(mocks.mouseProviderProps?.mouseEventsEnabled).toBe(true);
  });
});

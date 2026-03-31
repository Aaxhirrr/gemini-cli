/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, vi } from 'vitest';
import { coreEvents } from '@google/gemini-cli-core';

// Increase max listeners to avoid warnings in larger integration-style suites.
coreEvents.setMaxListeners(100);

afterEach(() => {
  vi.unstubAllEnvs();
});

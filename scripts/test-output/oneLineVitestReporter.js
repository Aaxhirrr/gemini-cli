/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DefaultReporter, JUnitReporter } from 'vitest/reporters';

export class OneLineVitestReporter extends DefaultReporter {
  constructor() {
    super({ isTTY: false, summary: false });
  }

  onInit(ctx) {
    this.ctx = ctx;
    this.start = performance.now();
    this.isTTY = false;
    this.renderSucceed = false;
  }

  onFinished(
    files = this.ctx.state.getFiles(),
    errors = this.ctx.state.getUnhandledErrors(),
  ) {
    this.end = performance.now();

    if (!files.length && !errors.length) {
      this.ctx.logger.printNoTestFound(this.ctx.filenamePattern);
      return;
    }

    const hasFailedModules = files.some(
      (file) => file.result?.state === 'fail',
    );
    if (errors.length > 0 || hasFailedModules) {
      this.reportSummary(files, errors);
    }
  }
}

export class SilentJUnitReporter extends JUnitReporter {
  async onFinished(files) {
    const logger = this.ctx?.logger;
    const originalLog = logger?.log;

    if (logger) {
      logger.log = () => {};
    }

    try {
      await super.onFinished(files);
    } finally {
      if (logger && originalLog) {
        logger.log = originalLog;
      }
    }
  }
}

export default OneLineVitestReporter;

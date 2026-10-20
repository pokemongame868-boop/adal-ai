/** Counting semaphore with a bounded FIFO queue and a wait timeout. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<{ resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

  constructor(
    private readonly limit: number,
    private readonly maxQueue: number,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Semaphore limit must be a positive integer');
  }

  get inFlight(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiters.length;
  }

  /** Resolves when a slot is free. Rejects with `SemaphoreFullError` / `SemaphoreTimeoutError`. */
  acquire(waitTimeoutMs: number): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) return Promise.reject(new SemaphoreFullError());
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const i = this.waiters.indexOf(waiter);
          if (i >= 0) this.waiters.splice(i, 1);
          reject(new SemaphoreTimeoutError());
        }, waitTimeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(); // slot is handed over directly; `active` stays the same
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }

  async run<T>(waitTimeoutMs: number, task: () => Promise<T>): Promise<T> {
    await this.acquire(waitTimeoutMs);
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

export class SemaphoreFullError extends Error {
  constructor() {
    super('Too many queued requests');
    this.name = 'SemaphoreFullError';
  }
}

export class SemaphoreTimeoutError extends Error {
  constructor() {
    super('Timed out waiting for a free request slot');
    this.name = 'SemaphoreTimeoutError';
  }
}

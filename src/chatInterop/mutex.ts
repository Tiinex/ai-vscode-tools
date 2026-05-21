import { MutexLease } from "./types";

export class RejectingMutex {
  private locked = false;

  tryAcquire(label = "chat-interop"): MutexLease {
    if (this.locked) {
      throw new Error(`${label} is already running`);
    }

    this.locked = true;
    let released = false;

    return {
      release: () => {
        if (released) {
          return;
        }

        released = true;
        this.locked = false;
      }
    };
  }

  isLocked(): boolean {
    return this.locked;
  }
}

export class QueuedMutex {
  private tail: Promise<void> = Promise.resolve();
  private active = false;
  private queued = 0;

  async acquire(_label = "chat-interop"): Promise<MutexLease> {
    const previous = this.tail.catch(() => {
      // Keep the queue advancing even if an earlier waiter leaked a rejection.
    });
    let releaseCurrent: (() => void) | undefined;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    this.tail = previous.then(() => current);
    this.queued += 1;
    await previous;
    this.queued = Math.max(0, this.queued - 1);
    this.active = true;
    let released = false;

    return {
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.active = false;
        releaseCurrent?.();
      }
    };
  }

  isLocked(): boolean {
    return this.active || this.queued > 0;
  }
}
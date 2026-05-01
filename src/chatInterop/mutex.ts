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
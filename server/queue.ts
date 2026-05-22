type Task = () => Promise<void>;

class MessageQueue {
  private queues = new Map<string, Promise<void>>();

  /**
   * Enqueues a message processing task for a specific phone number.
   * Ensures that tasks for the same phone number are executed strictly sequentially.
   */
  async enqueue(phone: string, task: Task): Promise<void> {
    const currentQueue = this.queues.get(phone) || Promise.resolve();
    
    const nextQueue = currentQueue
      .then(async () => {
        try {
          await task();
        } catch (error) {
          console.error(`[Queue] Error processing task for phone ${phone}:`, error);
        }
      })
      .finally(() => {
        // Clean up the queue if this is still the active promise in the map
        if (this.queues.get(phone) === nextQueue) {
          this.queues.delete(phone);
        }
      });

    this.queues.set(phone, nextQueue);
    return nextQueue;
  }
}

export const messageQueue = new MessageQueue();

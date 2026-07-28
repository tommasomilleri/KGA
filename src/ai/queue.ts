// src/ai/queue.ts
type Task = () => Promise<void>;

const queue: Task[] = [];
let running = false;

export function enqueue(task: Task): void {
  queue.push(task);
  if (!running) drain();
}

async function drain(): Promise<void> {
  running = true;
  while (queue.length) {
    try { 
        const task = queue.shift();
        if (task) await task();
    } catch (e) { 
        console.error('Task AI fallito:', e); 
    }
  }
  running = false;
}
export async function poolRunner<Task, Result>(options: {
  concurrency: number;
  signal?: AbortSignal;
  tasks: Task[];
  runTask: (task: Task) => Promise<Result>;
}): Promise<void> {
  const {tasks, runTask, signal} = options;
  if (tasks.length === 0) {
    return Promise.resolve();
  }
  const concurrency = options.concurrency ?? 4;
  let currentTaskIdx = 0;

  const running: Promise<any>[] = [];
  const total = tasks.length;

  function startTask() {
    const taskIdx = currentTaskIdx++;
    const task = tasks[taskIdx];
    const taskPromise = runTask(task).finally(() => {
      const runningIdx = running.findIndex((r) => r === taskPromise);
      if (runningIdx === -1) {
        throw new Error('Internal error');
      }
      void running.splice(runningIdx, 1);
    });
    running.push(taskPromise);
    return taskPromise;
  }

  while (running.length < concurrency && currentTaskIdx < total) {
    if (signal?.aborted) {
      return Promise.reject(new Error('Aborted by signal'));
    }
    startTask().catch(() => {});
    if (running.length === concurrency) {
      await Promise.race(running);
    }
  }
  await Promise.all(running);
}

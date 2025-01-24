/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error ts extension
import {poolRunner} from './pool-runner.ts';

await test(async function testPoolRunnerFunction() {
  const controller = new AbortController();
  let done = 0;
  const tasks = [1, 2, 3, 4, 5, 6];
  await poolRunner({
    concurrency: 3,
    signal: controller.signal,
    tasks: tasks,
    async runTask(t) {
      const result = await Promise.resolve(t);
      ++done;
      console.log(`${done} / ${tasks.length}: ${t} => ${result}`);
    },
  });
  assert.strictEqual(done, 6, 'Incorrect');
});

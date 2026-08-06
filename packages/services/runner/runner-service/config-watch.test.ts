import { describe, expect, jest, test } from "bun:test";
import { createConfigWatch, type ConfigWatch } from "./config-watch";

const watcher = (overrides: Partial<ConfigWatch> = {}) => {
  const calls = {
    drain: jest.fn(),
    restart: jest.fn(async () => {}),
    log: jest.fn(),
  };
  const check = createConfigWatch({
    stamp: async () => "1",
    busy: () => false,
    ...calls,
    ...overrides,
  });
  return { check, ...calls };
};

describe("createConfigWatch", () => {
  test("does not treat the first reading as a change", async () => {
    const { check, restart, drain } = watcher();

    await check();

    // Otherwise every start would be followed immediately by a restart, for ever.
    expect(drain).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
  });

  test("leaves an unchanged file alone", async () => {
    const { check, restart } = watcher();

    await check();
    await check();
    await check();

    expect(restart).not.toHaveBeenCalled();
  });

  test("stops taking work and restarts once the file changes", async () => {
    let stamp = "1";
    const { check, drain, restart } = watcher({ stamp: async () => stamp });

    await check();
    stamp = "2";
    await check();

    expect(drain).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  test("waits for the job in flight before restarting", async () => {
    let stamp = "1";
    let busy = true;
    const { check, drain, restart } = watcher({ stamp: async () => stamp, busy: () => busy });

    await check();
    stamp = "2";
    await check();

    // Draining happens straight away so the runner can reach idle at all, but
    // exiting mid-evaluation would leave a submission running with nothing
    // running it.
    expect(drain).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();

    busy = false;
    await check();

    expect(restart).toHaveBeenCalledTimes(1);
    // The file is not read again once it is known to have changed, so a second
    // change while draining does not start the count over.
    expect(drain).toHaveBeenCalledTimes(1);
  });

  test("ignores a file it cannot read for a moment", async () => {
    let stamp: string | undefined = "1";
    const { check, drain, restart } = watcher({ stamp: async () => stamp });

    await check();
    // What a replace-by-rename looks like if the timer lands mid-write.
    stamp = undefined;
    await check();

    expect(drain).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();

    stamp = "1";
    await check();
    expect(restart).not.toHaveBeenCalled();
  });
});

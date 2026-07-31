import { describe, it, expect, vi, beforeEach } from "vitest";
import { acquireEngine, releaseEngine, getEngineOwnerId, resetEngineOwnership, type EngineOwner } from "./engine-ownership";

describe("engine-ownership", () => {
  beforeEach(() => {
    resetEngineOwnership();
  });

  it("getEngineOwnerId is null initially", () => {
    expect(getEngineOwnerId()).toBeNull();
  });

  it("acquiring with no current owner sets the id", () => {
    const owner: EngineOwner = { id: "a", onRevoked: vi.fn() };
    acquireEngine(owner);
    expect(getEngineOwnerId()).toBe("a");
  });

  it("acquiring a different id calls the previous owner's onRevoked exactly once", () => {
    const firstOnRevoked = vi.fn();
    const first: EngineOwner = { id: "a", onRevoked: firstOnRevoked };
    const second: EngineOwner = { id: "b", onRevoked: vi.fn() };
    acquireEngine(first);
    acquireEngine(second);
    expect(firstOnRevoked).toHaveBeenCalledTimes(1);
  });

  it("acquiring a different id sets the new id", () => {
    const first: EngineOwner = { id: "a", onRevoked: vi.fn() };
    const second: EngineOwner = { id: "b", onRevoked: vi.fn() };
    acquireEngine(first);
    acquireEngine(second);
    expect(getEngineOwnerId()).toBe("b");
  });

  it("acquiring the same id does not call onRevoked", () => {
    const onRevoked = vi.fn();
    const owner: EngineOwner = { id: "a", onRevoked };
    acquireEngine(owner);
    acquireEngine(owner);
    expect(onRevoked).toHaveBeenCalledTimes(0);
  });

  it("acquiring the same id leaves the id unchanged", () => {
    const owner: EngineOwner = { id: "a", onRevoked: vi.fn() };
    acquireEngine(owner);
    acquireEngine(owner);
    expect(getEngineOwnerId()).toBe("a");
  });

  it("releasing a matching id clears the owner to null", () => {
    const owner: EngineOwner = { id: "a", onRevoked: vi.fn() };
    acquireEngine(owner);
    releaseEngine("a");
    expect(getEngineOwnerId()).toBeNull();
  });

  it("releasing a matching id does not call onRevoked", () => {
    const onRevoked = vi.fn();
    const owner: EngineOwner = { id: "a", onRevoked };
    acquireEngine(owner);
    releaseEngine("a");
    expect(onRevoked).toHaveBeenCalledTimes(0);
  });

  it("releasing a non-matching id leaves the current owner unchanged and calls no onRevoked", () => {
    const onRevoked = vi.fn();
    const owner: EngineOwner = { id: "a", onRevoked };
    acquireEngine(owner);
    releaseEngine("b");
    expect(getEngineOwnerId()).toBe("a");
    expect(onRevoked).toHaveBeenCalledTimes(0);
  });

  it("if a revoked owner's onRevoked throws, the new owner is still installed and getEngineOwnerId returns the new id", () => {
    const first: EngineOwner = { id: "a", onRevoked: () => { throw new Error("boom"); } };
    const second: EngineOwner = { id: "b", onRevoked: vi.fn() };
    acquireEngine(first);
    acquireEngine(second);
    expect(getEngineOwnerId()).toBe("b");
  });
});

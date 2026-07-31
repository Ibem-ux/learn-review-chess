export type EngineOwner = {
  readonly id: string;
  readonly onRevoked: () => void;
};

let currentOwner: { id: string; onRevoked: () => void } | null = null;

export function acquireEngine(owner: EngineOwner): void {
  if (currentOwner === null) {
    currentOwner = { id: owner.id, onRevoked: owner.onRevoked };
    return;
  }

  if (currentOwner.id === owner.id) {
    return;
  }

  try {
    currentOwner.onRevoked();
  } catch {
    // swallow
  }

  currentOwner = { id: owner.id, onRevoked: owner.onRevoked };
}

export function releaseEngine(id: string): void {
  if (currentOwner === null) {
    return;
  }

  if (currentOwner.id !== id) {
    return;
  }

  currentOwner = null;
}

export function getEngineOwnerId(): string | null {
  if (currentOwner === null) {
    return null;
  }
  return currentOwner.id;
}

export function resetEngineOwnership(): void {
  currentOwner = null;
}

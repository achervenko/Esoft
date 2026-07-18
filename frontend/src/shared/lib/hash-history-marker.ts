const HASH_HISTORY_INDEX_KEY = "__esoftHashHistoryIndex";
const HASH_HISTORY_COUNTER_KEY = "__esoftHashHistoryCounter";

type HashHistoryState = Record<string, unknown> & {
  [HASH_HISTORY_INDEX_KEY]?: number;
};

export function getCurrentHashHistoryIndex() {
  return getHashHistoryIndex(window.history.state);
}

export function markCurrentHashHistoryEntry() {
  const currentIndex = getCurrentHashHistoryIndex();

  if (currentIndex !== null) {
    return currentIndex;
  }

  const nextIndex = getNextHashHistoryIndex();
  const currentState = getObjectHistoryState();
  window.history.replaceState(
    {
      ...currentState,
      [HASH_HISTORY_INDEX_KEY]: nextIndex,
    },
    "",
  );

  return nextIndex;
}

export function pushMarkedHashHistoryEntry(
  state: Record<string, unknown>,
  hash: string,
) {
  window.history.pushState(
    {
      ...state,
      [HASH_HISTORY_INDEX_KEY]: getNextHashHistoryIndex(),
    },
    "",
    hash,
  );
}

function getHashHistoryIndex(state: unknown) {
  if (!isObjectHistoryState(state)) {
    return null;
  }

  const value = state[HASH_HISTORY_INDEX_KEY];
  return typeof value === "number" ? value : null;
}

function getObjectHistoryState(): HashHistoryState {
  return isObjectHistoryState(window.history.state) ? window.history.state : {};
}

function isObjectHistoryState(state: unknown): state is HashHistoryState {
  return typeof state === "object" && state !== null && !Array.isArray(state);
}

function getNextHashHistoryIndex() {
  const currentValue = Number(
    window.sessionStorage.getItem(HASH_HISTORY_COUNTER_KEY) ?? "0",
  );
  const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
  window.sessionStorage.setItem(HASH_HISTORY_COUNTER_KEY, String(nextValue));
  return nextValue;
}

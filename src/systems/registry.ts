import type { SystemId, SystemPlugin } from "./index";

const cache = new Map<SystemId, SystemPlugin>();

export const AVAILABLE_SYSTEMS: { id: SystemId; name: string }[] = [
  { id: "fate", name: "Fate Core" },
  { id: "vampire", name: "Fate – Homebrew: Vampire" },
];

export async function loadSystem(id: SystemId): Promise<SystemPlugin> {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const mod = await import(`./${id}/index`);
    const plugin: SystemPlugin = mod.default;
    cache.set(id, plugin);
    return plugin;
  } catch (e) {
    console.warn(`[systems] plugin "${id}" falhou, usando fallback "fate"`, e);
    if (id !== "fate") return loadSystem("fate");
    throw e;
  }
}

export function getCachedSystem(id: SystemId): SystemPlugin | null {
  return cache.get(id ?? "fate") ?? null;
}

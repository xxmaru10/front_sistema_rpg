"use client";

import type { SystemPlugin } from "@/systems/index";
import { getCachedSystem } from "@/systems/registry";
import { useProjectedState } from "@/lib/projectedStateStore";

/**
 * Returns the active system plugin for the current session.
 * Throws if the plugin is not pre-loaded — that's a bootstrap bug, not a runtime condition.
 */
export function useSystemPlugin(): SystemPlugin {
    const state = useProjectedState();
    const plugin = getCachedSystem(state.system ?? "fate");
    if (!plugin) {
        throw new Error(`[useSystemPlugin] Plugin "${state.system}" not loaded. Ensure loadSystem() is called before rendering.`);
    }
    return plugin;
}

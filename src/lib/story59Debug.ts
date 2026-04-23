"use client";

const STORY59_DEBUG_KEY = "debugStory59";
let cachedStory59DebugEnabled: boolean | null = null;

export function isStory59DebugEnabled(): boolean {
    if (cachedStory59DebugEnabled !== null) return cachedStory59DebugEnabled;
    if (typeof window === "undefined") return false;
    try {
        cachedStory59DebugEnabled = window.localStorage?.getItem(STORY59_DEBUG_KEY) === "1";
        return cachedStory59DebugEnabled;
    } catch {
        cachedStory59DebugEnabled = false;
        return false;
    }
}

export function logStory59(component: string, event: string, data?: Record<string, unknown>): void {
    if (!isStory59DebugEnabled()) return;
    if (data) {
        console.debug(`[Story59][${component}] ${event}`, data);
        return;
    }
    console.debug(`[Story59][${component}] ${event}`);
}

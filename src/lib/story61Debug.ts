"use client";

const STORY61_DEBUG_KEY = "debugStory61";
let cachedStory61DebugEnabled: boolean | null = null;

export function isStory61DebugEnabled(): boolean {
    if (cachedStory61DebugEnabled !== null) return cachedStory61DebugEnabled;
    if (typeof window === "undefined") return false;
    try {
        cachedStory61DebugEnabled = window.localStorage?.getItem(STORY61_DEBUG_KEY) === "1";
        return cachedStory61DebugEnabled;
    } catch {
        cachedStory61DebugEnabled = false;
        return false;
    }
}

export function logStory61(component: string, event: string, data?: Record<string, unknown>): void {
    if (!isStory61DebugEnabled()) return;
    if (data) {
        console.debug(`[Story61][${component}] ${event}`, data);
        return;
    }
    console.debug(`[Story61][${component}] ${event}`);
}

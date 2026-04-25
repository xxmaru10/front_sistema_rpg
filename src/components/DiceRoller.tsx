"use client";

import { useSystemPlugin } from "@/lib/useSystemPlugin";

export function DiceRoller(props: any) {
    const plugin = useSystemPlugin();
    const Roller = plugin.ui.DiceRoller;
    return <Roller {...props} />;
}

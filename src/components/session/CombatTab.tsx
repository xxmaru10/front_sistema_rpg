"use client";

import { useSystemPlugin } from "@/lib/useSystemPlugin";
import { memo } from "react";

function CombatTabProxy(props: any) {
    const plugin = useSystemPlugin();
    const Tab = plugin.ui.CombatTab;
    return <Tab {...props} />;
}

export const CombatTab = memo(CombatTabProxy);
CombatTab.displayName = "CombatTab";

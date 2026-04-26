"use client";

import { useSystemPlugin } from "@/lib/useSystemPlugin";
import { memo } from "react";

function CharacterCardProxy(props: any) {
    const plugin = useSystemPlugin();
    const Card = plugin.ui.CharacterCard;
    return <Card {...props} />;
}

export const CharacterCard = memo(CharacterCardProxy);
CharacterCard.displayName = "CharacterCard";

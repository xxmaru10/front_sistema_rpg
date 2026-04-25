// Fate UI components — re-exported from their current locations.
// Physical move of individual files is done incrementally; this barrel
// ensures the plugin always imports from the fate namespace.
export { FateCharacterCard as CharacterCard } from "@/components/CharacterCard/FateCharacterCard";
export { FateCombatTab as CombatTab } from "@/components/session/FateCombatTab";
export { FateDiceRoller as DiceRoller } from "@/components/FateDiceRoller";
export { AspectManager } from "@/components/AspectManager";
export { ConsequenceModal } from "@/components/ConsequenceModal";
export { DamageResolutionModal } from "@/components/DamageResolutionModal";
export { CharacterCreator } from "@/components/CharacterCreator";

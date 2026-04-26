// Thin re-export — logic lives in src/systems/fate/gameLogic.ts.
// Kept here for backward compatibility while existing call sites migrate to useSystemPlugin().
export {
    isCharacterEliminated,
    calculateAutomaticDamageSelection,
    calculateAbsorption,
    getConsequenceSlotCapacity,
} from "@/systems/fate/gameLogic";

export type { DamageAbsorptionResult, AutomaticDamageSelection } from "@/systems/fate/gameLogic";

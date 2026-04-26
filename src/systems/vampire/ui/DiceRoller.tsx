"use client";

// IMPORTANT: import FateDiceRoller directly, NOT from @/components/DiceRoller.
// The generic DiceRoller calls useSystemPlugin() and would render this component
// again, creating an infinite render loop.
import { FateDiceRoller } from "@/components/FateDiceRoller";

export function DiceRoller(props: any) {
  return (
    <div className="vampire-dice-roller-container">
      <FateDiceRoller {...props} />
    </div>
  );
}

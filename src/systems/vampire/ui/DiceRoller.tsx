"use client";

// IMPORTANT: import FateDiceRoller directly, NOT from @/components/DiceRoller.
// The generic DiceRoller calls useSystemPlugin() and would render this component
// again, creating an infinite render loop.
import { FateDiceRoller } from "@/components/FateDiceRoller";

export function DiceRoller(props: any) {
  return (
    <div className="vampire-dice-roller-container">
      <FateDiceRoller {...props} />
      <style jsx>{`
        .vampire-dice-roller-container :global(.probability-grid) {
          --accent-color: #c0392b !important;
          --accent-glow: rgba(192, 57, 43, 0.4) !important;
        }
        .vampire-dice-roller-container :global(.matrix-trigger) {
          border-color: #c0392b !important;
          box-shadow: 0 0 25px rgba(192, 57, 43, 0.4), inset 0 0 20px rgba(192, 57, 43, 0.3) !important;
        }
        .vampire-dice-roller-container :global(.matrix-trigger.integrated) {
          background: rgba(40, 5, 5, 0.95) !important;
          border-color: #c0392b !important;
          box-shadow: 0 0 15px rgba(192, 57, 43, 0.5) !important;
        }
        .vampire-dice-roller-container :global(.matrix-trigger.integrated .trigger-content) {
          color: #ff9999 !important;
        }
        .vampire-dice-roller-container :global(.trigger-content) {
          color: #c0392b !important;
          text-shadow: 0 0 10px rgba(192, 57, 43, 0.5) !important;
        }
        .vampire-dice-roller-container :global(.roller-brand h3) {
          color: #c0392b !important;
        }
        .vampire-dice-roller-container :global(.brand-dot) {
          background: #c0392b !important;
          box-shadow: 0 0 15px rgba(192, 57, 43, 0.6) !important;
        }
      `}</style>
    </div>
  );
}

"use client";

import React from 'react';

interface CombatCardStylesProps {
    isGM: boolean;
}

export const CombatCardStyles = ({ isGM }: CombatCardStylesProps) => (
    <style jsx global>{`
        .combat-card {
            background: linear-gradient(135deg, #0a0a0a 0%, #111 100%);
            border: 1px solid rgba(197, 160, 89, 0.2);
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            position: relative;
            overflow: visible;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .combat-card.collapsed {
            padding: 6px 12px;
            gap: 0;
        }

        .combat-card.dimmed {
            opacity: 0.4 !important;
        }

        .combat-card.expanded-card {
            margin-bottom: 0;
        }

        /* Full Coloration / Painted Effects */
        .combat-card.hero-card {
            border-left: 4px solid #c5a059;
            background: linear-gradient(135deg, rgba(30, 25, 15, 1) 0%, rgba(12, 10, 8, 1) 100%);
            box-shadow: inset 0 0 60px rgba(197, 160, 89, 0.2), 0 0 25px rgba(197, 160, 89, 0.25), 0 4px 20px rgba(0,0,0,0.7);
            border-color: rgba(197, 160, 89, 0.5);
        }
        .combat-card.hero-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, rgba(197, 160, 89, 0.08) 0%, transparent 100%);
            pointer-events: none;
        }

        .combat-card.own-hero-card {
            border-left: 4px solid #2ecc71;
            background: linear-gradient(135deg, rgba(15, 30, 20, 1) 0%, rgba(8, 12, 10, 1) 100%);
            box-shadow: inset 0 0 60px rgba(46, 204, 113, 0.15), 0 0 25px rgba(46, 204, 113, 0.2), 0 4px 20px rgba(0,0,0,0.7);
            border-color: rgba(46, 204, 113, 0.4);
        }
        .combat-card.own-hero-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, rgba(46, 204, 113, 0.08) 0%, transparent 100%);
            pointer-events: none;
        }

        .combat-card.npc-hero-card {
            border-left: 4px solid #50a6ff;
            border-color: rgba(80, 166, 255, 0.5);
            background: linear-gradient(135deg, rgba(10, 18, 30, 1) 0%, rgba(8, 10, 15, 1) 100%);
            box-shadow: inset 0 0 60px rgba(80, 166, 255, 0.18), 0 0 25px rgba(80, 166, 255, 0.25), 0 4px 20px rgba(0,0,0,0.7);
        }
        .combat-card.npc-hero-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, rgba(80, 166, 255, 0.08) 0%, transparent 100%);
            pointer-events: none;
        }

        .combat-card.threat-card {
            border-left: 4px solid #ff4444;
            border-color: rgba(255, 68, 68, 0.5);
            background: linear-gradient(135deg, rgba(30, 10, 10, 1) 0%, rgba(12, 8, 8, 1) 100%);
            box-shadow: inset 0 0 60px rgba(255, 68, 68, 0.18), 0 0 25px rgba(255, 68, 68, 0.25), 0 4px 20px rgba(0,0,0,0.7);
        }
        .combat-card.threat-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, rgba(255, 68, 68, 0.08) 0%, transparent 100%);
            pointer-events: none;
        }

        .combat-card.hazard-card {
            border-left: 4px solid #a855f7;
            background: linear-gradient(135deg, rgba(35, 15, 60, 1) 0%, rgba(15, 10, 25, 1) 100%);
            box-shadow: inset 0 0 50px rgba(168, 85, 247, 0.15), 0 0 15px rgba(168, 85, 247, 0.2), 0 4px 20px rgba(0,0,0,0.8);
            border-color: rgba(168, 85, 247, 0.4) !important;
        }
        .combat-card.hazard-card::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, rgba(168, 85, 247, 0.08) 0%, transparent 100%);
            pointer-events: none;
        }

        /* Header */
        .combat-header {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            position: relative;
            z-index: 2;
        }

        .combat-header.portrait-right {
            padding-right: 26px;
        }

        .combat-remove-btn {
            position: absolute;
            top: -5px;
            right: -5px;
            background: transparent;
            border: none;
            color: rgba(255, 68, 68, 0.6);
            font-size: 1.2rem;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            z-index: 10;
        }

        .combat-remove-btn:hover {
            color: #ff4444;
            transform: scale(1.1);
        }

        .combat-identity {
            flex-grow: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .combat-top-row {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .combat-return-toggle,
        .combat-avatar-shell {
            --portrait-ring: rgba(255,255,255,0.22);
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.14);
            background: linear-gradient(135deg, rgba(18, 18, 18, 0.96) 0%, rgba(6, 6, 6, 0.98) 100%);
            box-shadow: 0 10px 24px rgba(0,0,0,0.45);
            cursor: pointer;
            overflow: hidden;
            flex-shrink: 0;
            transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
        }

        .combat-return-toggle {
            width: 42px;
            height: 42px;
            border-radius: 14px;
            color: #f3e1b3;
        }

        .combat-avatar-shell {
            width: 74px;
            height: 74px;
            padding: 9px;
            border-radius: 24px;
            isolation: isolate;
        }

        .combat-avatar-shell.side-left {
            --avatar-offset: -18px;
            transform: translateX(var(--avatar-offset));
        }

        .combat-avatar-shell.side-right {
            --avatar-offset: 18px;
            transform: translateX(var(--avatar-offset));
        }

        .combat-return-toggle:hover,
        .combat-avatar-shell:hover {
            filter: saturate(1.05);
        }

        .combat-return-toggle:hover {
            transform: translateY(-2px) scale(1.03);
        }

        .combat-avatar-shell.side-left:hover,
        .combat-avatar-shell.side-right:hover {
            transform: translateX(var(--avatar-offset)) translateY(-2px) scale(1.03);
        }

        .combat-return-toggle:focus-visible,
        .combat-avatar-shell:focus-visible {
            outline: none;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.18), 0 12px 24px rgba(0,0,0,0.45);
        }

        .combat-avatar-halo {
            position: absolute;
            inset: -30%;
            background: radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 68%);
            opacity: 0.55;
            pointer-events: none;
            z-index: 0;
        }

        .combat-return-toggle::before,
        .combat-avatar-shell::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent 62%);
            pointer-events: none;
        }

        .combat-return-icon {
            position: relative;
            z-index: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 0 6px rgba(255,255,255,0.24));
        }

        .combat-portrait-avatar {
            position: relative;
            z-index: 1;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid var(--portrait-ring);
            background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(28,28,28,0.92) 100%);
            box-shadow: inset 0 0 18px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .combat-portrait-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .combat-portrait-fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-header);
            font-size: 0.92rem;
            letter-spacing: 0.08em;
            color: #f7ecd0;
            text-shadow: 0 0 10px rgba(255,255,255,0.18);
        }

        .combat-return-toggle.hero-card,
        .combat-avatar-shell.hero-card {
            --portrait-ring: rgba(241, 207, 133, 0.68);
            border-color: rgba(197, 160, 89, 0.48);
            background: linear-gradient(135deg, rgba(34, 24, 12, 0.98) 0%, rgba(12, 8, 5, 0.98) 100%);
            box-shadow: inset 0 0 28px rgba(197, 160, 89, 0.12), 0 10px 24px rgba(0,0,0,0.45), 0 0 18px rgba(197, 160, 89, 0.16);
        }

        .combat-return-toggle.own-hero-card,
        .combat-avatar-shell.own-hero-card {
            --portrait-ring: rgba(170, 255, 202, 0.68);
            border-color: rgba(46, 204, 113, 0.48);
            background: linear-gradient(135deg, rgba(12, 30, 19, 0.98) 0%, rgba(5, 12, 9, 0.98) 100%);
            box-shadow: inset 0 0 28px rgba(46, 204, 113, 0.11), 0 10px 24px rgba(0,0,0,0.45), 0 0 18px rgba(46, 204, 113, 0.16);
        }

        .combat-return-toggle.npc-hero-card,
        .combat-avatar-shell.npc-hero-card {
            --portrait-ring: rgba(184, 222, 255, 0.72);
            border-color: rgba(80, 166, 255, 0.5);
            background: linear-gradient(135deg, rgba(10, 20, 34, 0.98) 0%, rgba(6, 10, 16, 0.98) 100%);
            box-shadow: inset 0 0 28px rgba(80, 166, 255, 0.12), 0 10px 24px rgba(0,0,0,0.45), 0 0 18px rgba(80, 166, 255, 0.16);
        }

        .combat-return-toggle.threat-card,
        .combat-avatar-shell.threat-card {
            --portrait-ring: rgba(255, 192, 192, 0.72);
            border-color: rgba(255, 68, 68, 0.52);
            background: linear-gradient(135deg, rgba(36, 13, 13, 0.98) 0%, rgba(14, 7, 7, 0.98) 100%);
            box-shadow: inset 0 0 28px rgba(255, 68, 68, 0.13), 0 10px 24px rgba(0,0,0,0.45), 0 0 18px rgba(255, 68, 68, 0.18);
        }

        .combat-avatar-shell.active-turn-avatar {
            border-color: rgba(255,255,255,0.92) !important;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.25), 0 0 22px rgba(255,255,255,0.5), 0 12px 24px rgba(0,0,0,0.45) !important;
        }

        .combat-avatar-shell.active-turn-avatar .combat-portrait-avatar {
            border-color: rgba(255,255,255,0.96);
        }

        .combat-name {
            font-family: var(--font-header);
            font-size: 1rem;
            color: #e0e0e0;
            margin: 0;
            letter-spacing: 0.05em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .combat-fate {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(0,0,0,0.3);
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            width: fit-content;
        }

        .combat-resource-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
        }

        .impulse-cluster {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 0, 0, 0.25);
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .impulse-label {
            font-size: 0.55rem;
            color: rgba(255,255,255,0.55);
            letter-spacing: 0.1em;
        }

        .impulse-arrows-row {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 16px;
        }

        .impulse-arrow {
            color: #ffffff;
            font-size: 0.9rem;
            line-height: 1;
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.85), 0 0 14px rgba(255, 255, 255, 0.5);
            filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
        }

        .impulse-empty {
            color: rgba(255,255,255,0.45);
            font-size: 0.7rem;
            letter-spacing: 0.06em;
        }

        .impulse-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .fate-label {
            font-size: 0.55rem;
            color: rgba(255,255,255,0.4);
            letter-spacing: 0.1em;
        }

        .fate-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .fate-value { color: inherit; }
        .hero-card .fate-value { color: #c5a059; }
        .own-hero-card .fate-value { color: #2ecc71; }
        .npc-hero-card .fate-value { color: #50a6ff; }
        .threat-card .fate-value { color: #ff4444; }

        .fate-btn { color: inherit; }
        .hero-card .fate-btn { border-color: rgba(197,160,89,0.3); color: #c5a059; }
        .own-hero-card .fate-btn { border-color: rgba(46,204,113,0.3); color: #2ecc71; }
        .npc-hero-card .fate-btn { border-color: rgba(80,166,255,0.3); color: #50a6ff; }
        .threat-card .fate-btn { border-color: rgba(255,68,68,0.3); color: #ff4444; }
        .fate-btn:hover { background: rgba(197,160,89,0.1); }
        .fate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Aspects */
        .combat-aspects-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .combat-aspect {
            background: rgba(255,255,255,0.02);
            padding: 6px;
            border: 1px solid rgba(255,255,255,0.05);
            min-width: 0;
            position: relative;
            z-index: 2;
        }

        .hero-card .combat-aspect { border-color: rgba(197,160,89,0.1); }
        .own-hero-card .combat-aspect { border-color: rgba(46,204,113,0.1); }
        .npc-hero-card .combat-aspect { border-color: rgba(80,166,255,0.1); }
        .threat-card .combat-aspect { border-color: rgba(255,68,68,0.1); }

        .combat-aspect.trouble {
            border-color: rgba(255, 68, 68, 0.2);
            background: rgba(255, 68, 68, 0.02);
        }

        .aspect-label {
            display: block;
            font-size: 0.5rem;
            color: rgba(255,255,255,0.3);
            letter-spacing: 0.1em;
            margin-bottom: 2px;
        }

        .aspect-text {
            font-family: var(--font-main);
            font-size: 0.7rem;
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .combat-aspect.trouble .aspect-text { color: #ffaaaa; }

        /* Stress */
        .combat-stress-section {
            display: flex;
            gap: 12px;
            padding: 8px 0;
            border-top: 1px solid rgba(255,255,255,0.05);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .combat-track {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .track-header {
            font-size: 0.6rem;
            color: #888;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .track-icon { color: inherit; }
        .hero-card .track-icon { color: #c5a059; }
        .own-hero-card .track-icon { color: #2ecc71; }
        .npc-hero-card .track-icon { color: #50a6ff; }
        .threat-card .track-icon { color: #ff4444; }

        .track-boxes {
            display: flex;
            gap: 4px;
        }

        .stress-box {
            min-width: 28px;
            width: auto;
            height: 20px;
            padding: 0 4px;
            border: 1px solid #333;
            background: #111;
            color: #444;
            font-size: 0.62rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .stress-box:hover:not([disabled]) {
            border-color: #ff4444;
        }

        .stress-box.marked {
            background: #ff4444 !important;
            border-color: #ff4444 !important;
            box-shadow: 0 0 8px rgba(255, 68, 68, 0.4) !important;
            color: #000 !important;
            font-weight: bold;
        }

        .own-hero-card .cons-label { color: #2ecc71; }

        /* Consequences */
        .combat-consequences {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .consequences-title {
            font-size: 0.55rem;
            letter-spacing: 0.15em;
            color: rgba(255,255,255,0.2);
            margin-bottom: 2px;
        }

        .consequences-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .combat-consequence-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.7rem;
            cursor: ${isGM ? 'pointer' : 'default'};
            padding: 2px 4px;
        }
        .combat-consequence-row:hover {
            background: rgba(255,255,255,0.03);
        }

        .cons-label {
            color: #c5a059;
            font-weight: bold;
            min-width: 70px;
            font-size: 0.6rem;
        }

        .cons-label.active {
            color: #ff4444;
        }

        .cons-value {
            flex: 1;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .cons-value.filled {
            color: #ff4444;
            text-shadow: 0 0 5px rgba(255, 68, 68, 0.4);
        }

        .cons-debuff-badge {
            background: rgba(255, 68, 68, 0.2);
            color: #ff8888;
            padding: 0 4px;
            border-radius: 2px;
            font-size: 0.6rem;
            border: 1px solid rgba(255, 68, 68, 0.3);
        }

        /* Stunts and Spells */
        .combat-extras-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }

        .combat-extra-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .extra-title {
            font-size: 0.55rem;
            letter-spacing: 0.15em;
            color: rgba(197, 160, 89, 0.5);
            font-weight: bold;
        }
        .hero-card .extra-title { color: rgba(197, 160, 89, 0.5); }
        .npc-hero-card .extra-title { color: rgba(80, 166, 255, 0.5); }
        .threat-card .extra-title { color: rgba(255, 68, 68, 0.5); }

        .extra-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .extra-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(197, 160, 89, 0.03);
            padding: 4px 6px;
            border: 1px solid rgba(197, 160, 89, 0.1);
            border-radius: 2px;
        }
        .hero-card .extra-item { border-color: rgba(var(--accent-rgb), 0.1); }
        .own-hero-card .extra-item { border-color: rgba(46, 204, 113, 0.1); }
        .npc-hero-card .extra-item { border-color: rgba(80, 166, 255, 0.1); }
        .threat-card .extra-item { border-color: rgba(255, 68, 68, 0.1); }

        .extra-name {
            font-size: 0.65rem;
            color: #c5a059;
            font-family: var(--font-header);
            letter-spacing: 0.03em;
        }
        .hero-card .extra-name { color: #c5a059; }
        .own-hero-card .extra-name { color: #2ecc71; }
        .npc-hero-card .extra-name { color: #50a6ff; }
        .threat-card .extra-name { color: #ff6666; }

        .extra-cost {
            font-size: 0.6rem;
            color: #888;
            background: rgba(0, 0, 0, 0.2);
            padding: 0 4px;
            border-radius: 3px;
        }

        /* Hazard Specific Styles */
        .hazard-card {
            padding: 16px;
            border: 1px solid rgba(168, 85, 247, 0.3) !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .hazard-ornament {
            position: absolute;
            top: 0;
            right: 0;
            width: 60px;
            height: 60px;
            background: radial-gradient(circle at top right, rgba(168, 85, 247, 0.15), transparent 70%);
            pointer-events: none;
        }

        .hazard-name-input {
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            color: #fff;
            font-family: var(--font-header);
            font-size: 1.1rem;
            width: 100%;
            outline: none;
            transition: all 0.3s;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            padding: 4px 0;
        }

        .hazard-name-input:focus {
            border-bottom-color: rgba(168, 85, 247, 0.5);
            background: rgba(168, 85, 247, 0.05);
        }

        .hazard-label-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }

        .hazard-badge {
            font-size: 0.55rem;
            color: #a855f7;
            letter-spacing: 0.2em;
            font-weight: bold;
            text-transform: uppercase;
        }

        .hazard-tag-dot {
            width: 4px;
            height: 4px;
            background: #a855f7;
            border-radius: 50%;
            box-shadow: 0 0 5px #a855f7;
        }

        .hazard-remove-btn {
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.2);
            color: rgba(255, 100, 100, 0.8);
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
            font-size: 0.8rem;
        }

        .hazard-remove-btn:hover {
            background: rgba(255, 0, 0, 0.2);
            color: #fff;
            border-color: rgba(255, 0, 0, 0.4);
        }

        .hazard-difficulty-container {
            margin: 15px 0;
            display: flex;
            justify-content: center;
        }

        .diff-ring {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(168, 85, 247, 0.2);
            padding: 8px 20px;
            border-radius: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }

        .diff-label {
            font-size: 0.5rem;
            color: rgba(168, 85, 247, 0.7);
            letter-spacing: 0.15em;
            margin-bottom: 2px;
        }

        .diff-editor-v2 {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .diff-number {
            font-size: 1.8rem;
            font-family: var(--font-header);
            color: #a855f7;
            line-height: 1;
            min-width: 30px;
            text-align: center;
        }

        .glow-text {
            text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
        }

        .hazard-aspects-v2 {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .hazard-aspect-slot {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(168, 85, 247, 0.03);
            padding: 6px 10px;
            border-radius: 4px;
            border-left: 2px solid rgba(168, 85, 247, 0.15);
            transition: all 0.3s;
        }

        .hazard-aspect-slot:hover {
            background: rgba(168, 85, 247, 0.08);
            border-left-color: #a855f7;
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.1);
        }

        .aspect-dot {
            width: 6px;
            height: 6px;
            border: 1px solid #a855f7;
            transform: rotate(45deg);
            flex-shrink: 0;
        }

        .hazard-aspect-input {
            background: transparent;
            border: none;
            color: #ccc;
            width: 100%;
            outline: none;
            font-size: 0.75rem;
            font-family: var(--font-main);
        }

        .hazard-aspect-input::placeholder {
            color: rgba(197, 160, 89, 0.2);
        }

        .aspect-text {
            font-size: 0.75rem;
            color: #ccc;
            font-family: var(--font-main);
        }

        .combat-card.active-turn {
            border: 2px solid #fff !important;
            box-shadow: 0 0 30px #fff, inset 0 0 20px rgba(255, 255, 255, 0.4) !important;
            transform: scale(1.02);
            z-index: 10;
        }

        .combat-card.active-turn::before {
            content: "Sua Vez";
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #fff;
            color: #000;
            padding: 2px 10px;
            font-family: var(--font-header);
            font-size: 0.6rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            font-weight: bold;
            box-shadow: 0 0 10px #fff;
            pointer-events: none;
        }
    `}</style>
);

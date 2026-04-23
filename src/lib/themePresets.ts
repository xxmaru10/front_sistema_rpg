// ═══════════════════════════════════════════════════════════════
// THEMATIC PRESETS — CSS generation (frontend only)
// For types, data, and utilities, see themePresets.shared.ts
// ═══════════════════════════════════════════════════════════════

export type { ThemePresetId, ThemePreset } from "./themePresets.shared";
export { THEME_PRESETS, THEME_LIST, getThemePreset } from "./themePresets.shared";

import type { ThemePreset } from "./themePresets.shared";

/**
 * Generates all CSS custom properties for a given theme.
 * This string can be injected into a <style> tag.
 */
export function generateThemeCSS(theme: ThemePreset): string {
    return `
        @import url('${theme.googleFontsUrl}');

        :root {
            /* ─── Theme: ${theme.label} ─── */
            --theme-name: ${theme.id};
            --accent-color: ${theme.accentColor};
            --accent-glow: ${theme.accentColor}4D;
            --accent-rgb: ${theme.accentRgb};
            --secondary-color: ${theme.secondaryColor};
            --secondary-glow: rgba(${theme.secondaryRgb}, 0.3);
            --secondary-rgb: ${theme.secondaryRgb};
            --bg-color: ${theme.bgColor};
            --surface-color: ${theme.surfaceColor};
            --danger-color: ${theme.dangerColor};
            --text-primary: ${theme.textPrimary};
            --text-secondary: ${theme.textSecondary};

            --font-header: ${theme.fontHeader};
            --font-narrative: ${theme.fontNarrative};
            --font-main: ${theme.fontUI};

            --shadow-arcane: ${theme.shadowStyle};
            --gold-gradient: ${theme.goldGradient};
            --ornament-glow: 0 0 ${15 * theme.glowIntensity}px rgba(${theme.accentRgb}, ${0.15 * theme.glowIntensity});

            --border-color: rgba(${theme.accentRgb}, 0.2);
            --border-style: ${theme.borderStyle};
            --border-radius: ${theme.borderRadius};

            --theme-ornament-left: "${theme.ornamentLeft}";
            --theme-ornament-right: "${theme.ornamentRight}";
            --theme-ornament-divider: "${theme.ornamentDivider}";
            --theme-border-char: "${theme.navBorderChar}";
            --theme-transition: ${theme.transitionSpeed};
            --theme-hover-scale: ${theme.hoverScale};
            --theme-input-bg: ${theme.inputBgColor};
            --theme-modal-border: ${theme.modalBorderColor};
            --theme-header-shadow: ${theme.headerTextShadow};
            --theme-button-transform: ${theme.buttonTextTransform};
            --theme-scrollbar-thumb: ${theme.scrollbarThumbColor};
            --theme-scrollbar-track: ${theme.scrollbarTrackColor};
        }

        body {
            background-color: ${theme.bgColor};
            background-image: ${theme.bgPattern};
            color: ${theme.textPrimary};
            font-family: ${theme.fontUI};
            transition: background-color 0.8s ease, color 0.5s ease;
        }

        body[data-disable-theme-animation="true"]::after {
            display: none !important;
        }

        body[data-disable-theme-animation="true"] .solid,
        body[data-disable-theme-animation="true"] .solid::before,
        body[data-disable-theme-animation="true"] .solid::after {
            animation: none !important;
        }

        .solid {
            background: ${theme.surfaceColor};
            background-image: ${theme.surfacePattern};
            border-radius: ${theme.borderRadius};
            box-shadow: ${theme.shadowStyle};
        }

        .solid::before {
            background: linear-gradient(90deg, transparent, ${theme.accentColor}, transparent);
        }

        .glass {
            background: ${theme.surfaceColor};
            border-radius: ${theme.borderRadius};
            box-shadow: ${theme.shadowStyle};
        }

        h1, h2, h3 {
            font-family: ${theme.fontHeader};
            color: var(--accent-color) !important;
            text-shadow: ${theme.headerTextShadow};
        }

        h1 { text-shadow: ${theme.headerTextShadow}; }

        .btn {
            border-radius: ${theme.borderRadius};
            font-family: ${theme.fontHeader};
            text-transform: ${theme.buttonTextTransform};
            transition: all ${theme.transitionSpeed} cubic-bezier(0.19, 1, 0.22, 1);
        }

        .btn:hover {
            transform: scale(${theme.hoverScale});
            box-shadow: 0 0 ${25 * theme.glowIntensity}px rgba(${theme.accentRgb}, 0.3);
        }

        .btn-primary {
            background: ${theme.goldGradient};
        }

        .glass-input, .select-ritual, .input-ritual {
            background: ${theme.inputBgColor} !important;
            border-radius: ${theme.borderRadius};
        }

        .modal-content, .consequence-modal {
            background: ${theme.bgColor};
            border: ${theme.borderStyle} ${theme.modalBorderColor};
            border-radius: ${theme.borderRadius};
            box-shadow: ${theme.shadowStyle};
        }

        .scrollbar-arcane::-webkit-scrollbar-thumb {
            background: ${theme.scrollbarThumbColor};
        }

        .scrollbar-arcane::-webkit-scrollbar-track {
            background: ${theme.scrollbarTrackColor};
        }

        /* ─── Theme-Specific Animations ─── */
        ${theme.id === 'medieval' ? `
            /* ═══ MEDIEVAL ORNAMENTAL UI ═══ */

            @keyframes medieval-ember {
                0%, 100% { opacity: 0.35; }
                50% { opacity: 0.65; }
            }
            @keyframes medieval-glow {
                0%, 100% { box-shadow: inset 0 0 30px rgba(${theme.accentRgb}, 0.02); }
                50% { box-shadow: inset 0 0 40px rgba(${theme.accentRgb}, 0.04); }
            }

            /* ─── Panels: Ornamental Borders + Inner Glow ─── */
            .solid {
                border: 1px solid rgba(${theme.accentRgb}, 0.18) !important;
                box-shadow:
                    0 10px 50px rgba(0, 0, 0, 0.95),
                    0 0 80px rgba(${theme.accentRgb}, 0.03),
                    inset 0 0 30px rgba(${theme.accentRgb}, 0.025),
                    inset 0 1px 0 rgba(${theme.accentRgb}, 0.12) !important;
                background: linear-gradient(
                    180deg,
                    rgba(25, 18, 12, 0.98) 0%,
                    rgba(18, 13, 9, 0.99) 40%,
                    rgba(22, 16, 11, 0.98) 100%
                ) !important;
                outline: 1px solid rgba(${theme.accentRgb}, 0.06);
                outline-offset: 3px;
                animation: medieval-glow 8s ease-in-out infinite;
            }

            /* Top gold line on panels */
            .solid::before {
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(${theme.secondaryRgb}, 0.2) 15%,
                    ${theme.accentColor}80 35%,
                    ${theme.accentColor} 50%,
                    ${theme.accentColor}80 65%,
                    rgba(${theme.secondaryRgb}, 0.2) 85%,
                    transparent 100%
                ) !important;
                height: 1px !important;
                animation: medieval-ember 6s ease-in-out infinite;
            }

            /* Bottom ornament on panels */
            .solid::after {
                content: "❧";
                position: absolute;
                bottom: 6px;
                right: 10px;
                font-size: 0.75rem;
                color: rgba(${theme.accentRgb}, 0.12);
                pointer-events: none;
                z-index: 1;
            }

            /* ─── Navigation: Medieval Tabs ─── */
            .nav-artifact {
                border: 1px solid rgba(${theme.accentRgb}, 0.06) !important;
                transition: all 0.4s ease !important;
                position: relative;
            }
            .nav-artifact:hover {
                border-color: rgba(${theme.accentRgb}, 0.15) !important;
                background: rgba(${theme.accentRgb}, 0.03) !important;
            }
            .nav-artifact.active {
                background: linear-gradient(180deg, rgba(${theme.accentRgb}, 0.08) 0%, rgba(${theme.accentRgb}, 0.02) 100%) !important;
                border-color: rgba(${theme.accentRgb}, 0.25) !important;
                border-bottom: 2px solid ${theme.accentColor} !important;
                box-shadow:
                    inset 0 0 25px rgba(${theme.accentRgb}, 0.06),
                    0 0 15px rgba(${theme.accentRgb}, 0.08) !important;
            }
            .nav-artifact.active .nav-icon {
                color: var(--accent-color) !important;
                text-shadow: 0 0 15px rgba(${theme.accentRgb}, 0.5);
            }

            /* ─── Buttons: Inner Frame Effect ─── */
            .btn {
                position: relative;
                border-color: rgba(${theme.accentRgb}, 0.4) !important;
            }
            .btn:hover {
                box-shadow:
                    0 0 20px rgba(${theme.accentRgb}, 0.2),
                    inset 0 0 15px rgba(${theme.accentRgb}, 0.05) !important;
            }
            .btn-primary {
                background: ${theme.goldGradient} !important;
                border: none !important;
                box-shadow: 0 2px 10px rgba(${theme.accentRgb}, 0.2),
                            inset 0 1px 0 rgba(255,255,255,0.15) !important;
            }
            .btn-primary:hover {
                box-shadow: 0 4px 25px rgba(${theme.accentRgb}, 0.35),
                            inset 0 1px 0 rgba(255,255,255,0.2) !important;
            }

            /* ─── Typography: Ornamental Headers ─── */
            h1, h2, h3, .display-title {
                text-shadow: ${theme.headerTextShadow};
                color: var(--accent-color) !important;
            }
            .display-title {
                position: relative;
            }
            .display-title::before {
                content: "✧ ";
                opacity: 0.4;
            }
            .display-title::after {
                content: " ✧";
                opacity: 0.4;
            }

            /* ─── Status Bar Styling ─── */
            .system-status-bar {
                background: linear-gradient(
                    90deg,
                    rgba(${theme.accentRgb}, 0.04) 0%,
                    rgba(18, 13, 9, 0.98) 20%,
                    rgba(18, 13, 9, 0.98) 80%,
                    rgba(${theme.accentRgb}, 0.04) 100%
                ) !important;
            }

            /* ─── Cards: Combat + Items ─── */
            .combat-card, .item-card, .bestiary-entry {
                border-left: 2px solid rgba(${theme.secondaryRgb}, 0.25) !important;
                box-shadow:
                    0 4px 20px rgba(0, 0, 0, 0.5),
                    inset 0 0 20px rgba(${theme.accentRgb}, 0.02) !important;
                position: relative;
            }
            .combat-card::after, .item-card::after {
                content: "◆";
                position: absolute;
                top: 8px;
                right: 8px;
                font-size: 0.5rem;
                color: rgba(${theme.accentRgb}, 0.15);
                pointer-events: none;
            }

            /* ─── Modals: Ornate Frame ─── */
            .modal-content, .consequence-modal {
                border: 1px solid rgba(${theme.accentRgb}, 0.3) !important;
                box-shadow:
                    0 0 80px rgba(0, 0, 0, 0.95),
                    0 0 30px rgba(${theme.accentRgb}, 0.05),
                    inset 0 0 40px rgba(${theme.accentRgb}, 0.02) !important;
                outline: 1px solid rgba(${theme.accentRgb}, 0.08);
                outline-offset: 4px;
                background: linear-gradient(
                    180deg,
                    rgba(18, 13, 9, 0.99) 0%,
                    rgba(13, 9, 7, 1) 100%
                ) !important;
            }

            /* ─── Inputs: Warm Style ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border-color: rgba(${theme.accentRgb}, 0.15) !important;
                background: rgba(${theme.accentRgb}, 0.03) !important;
                box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                border-color: rgba(${theme.accentRgb}, 0.4) !important;
                box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3),
                            0 0 12px rgba(${theme.accentRgb}, 0.1) !important;
            }

            /* ─── Scrollbar ─── */
            .scrollbar-arcane::-webkit-scrollbar-thumb {
                border-radius: 0 !important;
                border: 1px solid rgba(${theme.accentRgb}, 0.1);
            }

            /* ─── Display Header: Decorative Divider ─── */
            .display-header {
                border-bottom: 1px solid rgba(${theme.accentRgb}, 0.12) !important;
                position: relative;
            }
            .display-header::after {
                content: "═══ ⚜ ═══";
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.55rem;
                color: rgba(${theme.accentRgb}, 0.2);
                background: ${theme.bgColor};
                padding: 0 12px;
                letter-spacing: 0.3em;
                pointer-events: none;
            }

            /* ─── Group Titles ─── */
            .group-title {
                position: relative;
                padding-left: 16px !important;
            }
            .group-title::before {
                content: "◆";
                position: absolute;
                left: 0;
                color: rgba(${theme.accentRgb}, 0.35);
                font-size: 0.6rem;
                top: 50%;
                transform: translateY(-50%);
            }

            /* ─── Aspect Tokens ─── */
            .scene-aspect-token {
                border: 1px solid rgba(${theme.accentRgb}, 0.12) !important;
                box-shadow: inset 0 0 15px rgba(${theme.accentRgb}, 0.02);
            }
        ` : ''}

        ${theme.id === 'cyberpunk' ? `
            /* ═══ CYBERPUNK HUD TERMINAL UI ═══ */

            @keyframes cyber-flicker {
                0%, 100% { opacity: 1; }
                92% { opacity: 1; }
                93% { opacity: 0.7; }
                94% { opacity: 1; }
                96% { opacity: 0.85; }
                97% { opacity: 1; }
            }
            @keyframes cyber-scanline {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(100vh); }
            }
            @keyframes cyber-glow-pulse {
                0%, 100% { box-shadow: inset 0 0 20px rgba(${theme.accentRgb}, 0.03), 0 0 15px rgba(${theme.accentRgb}, 0.05); }
                50% { box-shadow: inset 0 0 30px rgba(${theme.accentRgb}, 0.05), 0 0 25px rgba(${theme.accentRgb}, 0.08); }
            }

            /* ─── Scanline Overlay ─── */
            body:not([data-disable-theme-animation="true"])::after {
                content: "";
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 9999;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 0, 0, 0.03) 2px,
                    rgba(0, 0, 0, 0.03) 4px
                );
            }

            /* ─── Panels: HUD Frames with Corner Brackets ─── */
            .solid {
                border: 1px solid rgba(${theme.accentRgb}, 0.25) !important;
                background: rgba(12, 8, 10, 0.95) !important;
                background-image: ${theme.surfacePattern} !important;
                clip-path: polygon(
                    0 0, calc(100% - 10px) 0, 100% 10px,
                    100% 100%, 10px 100%, 0 calc(100% - 10px)
                );
                box-shadow:
                    0 0 20px rgba(${theme.accentRgb}, 0.06),
                    inset 0 0 30px rgba(${theme.accentRgb}, 0.02),
                    0 10px 40px rgba(0, 0, 0, 0.9) !important;
                position: relative;
            }
            /* Status bar must NOT clip (theme dropdown lives inside) */
            .system-status-bar.solid {
                clip-path: none !important;
            }

            /* Top accent line: cyan-to-red gradient */
            .solid::before {
                background: linear-gradient(
                    90deg,
                    ${theme.secondaryColor} 0%,
                    ${theme.secondaryColor}80 10%,
                    transparent 25%,
                    ${theme.accentColor}60 45%,
                    ${theme.accentColor} 50%,
                    ${theme.accentColor}60 55%,
                    transparent 75%,
                    ${theme.secondaryColor}80 90%,
                    ${theme.secondaryColor} 100%
                ) !important;
                height: 1px !important;
                animation: cyber-flicker 4s infinite;
            }

            /* Corner accent marks */
            .solid::after {
                content: "┌";
                position: absolute;
                top: 4px;
                left: 6px;
                font-size: 0.7rem;
                color: rgba(${theme.secondaryRgb}, 0.4);
                pointer-events: none;
                z-index: 1;
                font-family: 'Share Tech Mono', monospace;
                text-shadow: 0 0 8px rgba(${theme.secondaryRgb}, 0.3);
            }

            /* ─── Navigation: HUD Tabs ─── */
            .nav-artifact {
                clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
                border: 1px solid rgba(${theme.accentRgb}, 0.08) !important;
                transition: all 0.2s ease !important;
            }
            .nav-artifact:hover {
                border-color: rgba(${theme.accentRgb}, 0.25) !important;
                background: rgba(${theme.accentRgb}, 0.04) !important;
                box-shadow: 0 0 10px rgba(${theme.accentRgb}, 0.1);
            }
            .nav-artifact.active {
                background: rgba(${theme.accentRgb}, 0.08) !important;
                border-color: ${theme.accentColor} !important;
                box-shadow:
                    0 0 20px rgba(${theme.accentRgb}, 0.15),
                    inset 0 0 15px rgba(${theme.accentRgb}, 0.05) !important;
            }
            .nav-artifact.active .nav-icon,
            .display-title,
            .settings-title {
                animation: cyber-flicker 4s infinite;
            }
            .nav-artifact.active .nav-icon {
                color: var(--accent-color) !important;
                text-shadow: 0 0 15px rgba(${theme.accentRgb}, 0.8);
            }

            /* ─── Buttons: Angular HUD ─── */
            .btn {
                clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
                border: 1px solid rgba(${theme.accentRgb}, 0.4) !important;
                letter-spacing: 0.15em;
                font-weight: 600;
                position: relative;
            }
            .btn:hover {
                background: rgba(${theme.accentRgb}, 0.08) !important;
                box-shadow:
                    0 0 20px rgba(${theme.accentRgb}, 0.2),
                    inset 0 0 20px rgba(${theme.accentRgb}, 0.05) !important;
                text-shadow: 0 0 10px rgba(${theme.accentRgb}, 0.5);
            }
            .btn-primary {
                background: linear-gradient(135deg, rgba(${theme.accentRgb}, 0.15) 0%, rgba(${theme.accentRgb}, 0.08) 100%) !important;
                border-color: ${theme.accentColor} !important;
                color: ${theme.accentColor} !important;
                box-shadow: 0 0 12px rgba(${theme.accentRgb}, 0.15) !important;
            }
            .btn-primary:hover {
                background: rgba(${theme.accentRgb}, 0.2) !important;
                box-shadow: 0 0 25px rgba(${theme.accentRgb}, 0.3) !important;
            }

            /* ─── Typography: Terminal ─── */
            h1, h2, h3, .display-title {
                text-shadow: ${theme.headerTextShadow};
                letter-spacing: 0.2em;
                color: var(--accent-color) !important;
            }
            .display-title::before {
                content: "// ";
                color: rgba(${theme.secondaryRgb}, 0.5);
                font-size: 0.8em;
            }

            /* ─── Status Bar: Terminal Look ─── */
            .system-status-bar {
                border-left: 2px solid ${theme.secondaryColor} !important;
                border-right: 2px solid ${theme.secondaryColor} !important;
            }
            .status-indicator {
                background: ${theme.accentColor} !important;
                box-shadow: 0 0 8px ${theme.accentColor} !important;
            }

            /* ─── Cards: Hacker Panels ─── */
            .combat-card, .item-card, .bestiary-entry {
                clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
                border: 1px solid rgba(${theme.accentRgb}, 0.2) !important;
                border-top: 2px solid ${theme.secondaryColor} !important;
                box-shadow:
                    0 0 15px rgba(${theme.accentRgb}, 0.05),
                    inset 0 0 20px rgba(${theme.accentRgb}, 0.02) !important;
                position: relative;
            }
            .combat-card::after, .item-card::after {
                content: "┐";
                position: absolute;
                top: 4px;
                right: 10px;
                font-size: 0.6rem;
                color: rgba(${theme.secondaryRgb}, 0.35);
                font-family: 'Share Tech Mono', monospace;
                pointer-events: none;
            }

            /* ─── Modals: Secure Terminal ─── */
            .modal-content, .consequence-modal {
                clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
                border: 1px solid rgba(${theme.accentRgb}, 0.4) !important;
                box-shadow:
                    0 0 60px rgba(0, 0, 0, 0.95),
                    0 0 30px rgba(${theme.accentRgb}, 0.08),
                    inset 0 0 40px rgba(${theme.accentRgb}, 0.02) !important;
                background: rgba(6, 10, 20, 0.98) !important;
            }

            /* ─── Inputs: Terminal Style ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border: 1px solid rgba(${theme.accentRgb}, 0.15) !important;
                background: rgba(${theme.accentRgb}, 0.02) !important;
                font-family: 'Share Tech Mono', monospace !important;
                letter-spacing: 0.05em;
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                border-color: ${theme.accentColor} !important;
                box-shadow: 0 0 15px rgba(${theme.accentRgb}, 0.15),
                            inset 0 0 10px rgba(${theme.accentRgb}, 0.03) !important;
            }

            /* ─── Scrollbar: Thin Neon ─── */
            .scrollbar-arcane::-webkit-scrollbar {
                width: 4px !important;
            }
            .scrollbar-arcane::-webkit-scrollbar-thumb {
                border-radius: 0 !important;
                background: ${theme.accentColor} !important;
                box-shadow: 0 0 6px rgba(${theme.accentRgb}, 0.4);
            }

            /* ─── Display Header ─── */
            .display-header {
                border-bottom: 1px solid rgba(${theme.accentRgb}, 0.15) !important;
                position: relative;
            }
            .display-header::after {
                content: "[ SYSTEM // ACTIVE ]";
                position: absolute;
                bottom: -8px;
                right: 0;
                font-size: 0.5rem;
                color: rgba(${theme.accentRgb}, 0.25);
                font-family: 'Share Tech Mono', monospace;
                letter-spacing: 0.2em;
                pointer-events: none;
            }

            /* ─── Aspect Tokens ─── */
            .scene-aspect-token {
                clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
                border: 1px solid rgba(${theme.accentRgb}, 0.15) !important;
            }

            /* ─── Group Titles: Data Labels ─── */
            .group-title {
                letter-spacing: 0.25em !important;
                font-family: 'Share Tech Mono', monospace !important;
                font-size: 0.7rem !important;
                position: relative;
                padding-left: 14px !important;
            }
            .group-title::before {
                content: "▸";
                position: absolute;
                left: 0;
                color: ${theme.secondaryColor};
                font-size: 0.7rem;
                text-shadow: 0 0 6px rgba(${theme.secondaryRgb}, 0.5);
            }
        ` : ''}

        ${theme.id === 'gotico' ? `
            /* ═══ GOTHIC VICTORIAN/VAMPIRE UI ═══ */

            @keyframes vein-pulse {
                0%, 100% { opacity: 0.2; }
                50% { opacity: 0.5; }
            }

            /* ─── Panels: Double Ornate Border ─── */
            .solid {
                border: 1px solid var(--accent-color) !important;
                outline: 1px solid rgba(${theme.accentRgb}, 0.25);
                outline-offset: -5px;
                background: linear-gradient(
                    135deg,
                    rgba(15, 6, 6, 0.98) 0%,
                    rgba(10, 4, 4, 0.99) 100%
                ) !important;
                position: relative;
            }

            /* Corner Ornaments */
            .solid::before {
                content: "❦";
                position: absolute;
                top: 6px;
                left: 8px;
                color: var(--accent-color);
                font-size: 0.8rem;
                opacity: 0.8;
                pointer-events: none;
                z-index: 1;
                text-shadow: 0 0 8px rgba(${theme.accentRgb}, 0.6);
            }
            .solid::after {
                content: "❧";
                position: absolute;
                bottom: 6px;
                right: 8px;
                color: var(--accent-color);
                font-size: 0.8rem;
                opacity: 0.8;
                pointer-events: none;
                z-index: 1;
                text-shadow: 0 0 8px rgba(${theme.accentRgb}, 0.6);
            }

            /* Disable clip-paths */
            .system-status-bar.solid {
                outline: none !important;
                border-left: 2px solid var(--accent-color) !important;
                border-right: 2px solid var(--accent-color) !important;
            }
            .system-status-bar.solid::before, .system-status-bar.solid::after {
                display: none;
            }

            /* ─── Navigation: Velvet Tabs ─── */
            .nav-artifact {
                border: 1px solid rgba(${theme.accentRgb}, 0.2) !important;
                transition: all 0.5s ease !important;
            }
            .nav-artifact:hover {
                border-color: rgba(${theme.accentRgb}, 0.4) !important;
                background: rgba(${theme.accentRgb}, 0.05) !important;
            }
            .nav-artifact.active {
                background: linear-gradient(0deg, rgba(${theme.accentRgb}, 0.15) 0%, transparent 100%) !important;
                border-color: var(--accent-color) !important;
                box-shadow: inset 0 -3px 15px rgba(${theme.accentRgb}, 0.15) !important;
                position: relative;
            }
            .nav-artifact.active::after {
                content: "";
                position: absolute;
                bottom: -1px;
                left: 0;
                width: 100%;
                height: 2px;
                background: var(--accent-color);
                box-shadow: 0 0 10px var(--accent-color);
            }

            /* ─── Buttons: Blood Glow ─── */
            .btn {
                border: 1px solid rgba(${theme.accentRgb}, 0.4) !important;
            }
            .btn:hover {
                background: rgba(${theme.accentRgb}, 0.1) !important;
                box-shadow: 0 0 20px rgba(${theme.accentRgb}, 0.3),
                            inset 0 0 15px rgba(${theme.accentRgb}, 0.1) !important;
                border-color: var(--accent-color) !important;
            }
            .btn-primary {
                background: linear-gradient(180deg, rgba(${theme.accentRgb}, 0.4) 0%, rgba(${theme.accentRgb}, 0.1) 100%) !important;
                border-color: var(--accent-color) !important;
                color: #fff !important;
                text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
            }

            /* ─── Typography: Elegant Filigree ─── */
            h1, h2, h3, .display-title {
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.15em;
            }
            .display-title::before {
                content: "✟ ";
                opacity: 0.5;
                font-size: 0.7em;
                vertical-align: middle;
            }
            .display-title::after {
                content: " ✟";
                opacity: 0.5;
                font-size: 0.7em;
                vertical-align: middle;
            }

            /* ─── Cards: Aristocratic Frames ─── */
            .combat-card, .item-card, .bestiary-entry {
                border: 1px solid rgba(${theme.accentRgb}, 0.3) !important;
                outline: 1px solid rgba(${theme.accentRgb}, 0.15);
                outline-offset: -3px;
                background: linear-gradient(180deg, rgba(${theme.accentRgb}, 0.08) 0%, transparent 40%) !important;
            }

            /* ─── Modals: Coffin Frames ─── */
            .modal-content, .consequence-modal {
                border: 1px solid var(--accent-color) !important;
                outline: 1px solid rgba(${theme.accentRgb}, 0.3);
                outline-offset: -6px;
                box-shadow:
                    0 0 100px rgba(0, 0, 0, 0.95),
                    0 0 50px rgba(${theme.accentRgb}, 0.15),
                    inset 0 0 80px rgba(${theme.accentRgb}, 0.05) !important;
                background: linear-gradient(
                    180deg,
                    rgba(15, 5, 5, 0.98) 0%,
                    rgba(8, 2, 2, 1) 100%
                ) !important;
            }

            /* ─── Display Header ─── */
            .display-header {
                border-bottom: 1px solid rgba(${theme.accentRgb}, 0.2) !important;
                position: relative;
            }
            .display-header::after {
                content: "✟ ✤ ✟";
                position: absolute;
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.7rem;
                color: rgba(${theme.accentRgb}, 0.4);
                background: ${theme.bgColor};
                padding: 0 15px;
            }

            /* ─── Scrolls / Rituals: Old Paper Feel but Dark ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border: 1px solid rgba(${theme.accentRgb}, 0.3) !important;
                background: rgba(0, 0, 0, 0.4) !important;
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                border-color: var(--accent-color) !important;
                box-shadow: inset 0 0 15px rgba(${theme.accentRgb}, 0.1),
                            0 0 15px rgba(${theme.accentRgb}, 0.2) !important;
            }
        ` : ''}

        ${theme.id === 'espacial' ? `
            /* ═══ DEEP SPACE RED NEON UI ═══ */

            @keyframes neon-pulse {
                0%, 100% { opacity: 0.8; box-shadow: 0 0 10px rgba(${theme.accentRgb}, 0.5); }
                50% { opacity: 1; box-shadow: 0 0 25px rgba(${theme.accentRgb}, 0.9); }
            }

            @keyframes starry-drift {
                from { background-position: 0 0; }
                to { background-position: -100px 50px; }
            }

            /* Story 56: avoid continuous background animation on reduced-motion setups.
               This effect is visual-only and should never force extra render work. */
            @media (prefers-reduced-motion: no-preference) {
                body:not([data-disable-theme-animation="true"]) {
                    animation: starry-drift 180s linear infinite;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                body {
                    animation: none !important;
                }
            }

            /* ─── Panels: Minimalist Dark Glass with Neon Sidebars ─── */
            .solid {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.5) !important;
                border-left: 3px solid var(--accent-color) !important;
                background: linear-gradient(
                    135deg,
                    rgba(8, 10, 20, 0.96) 0%,
                    rgba(3, 4, 10, 0.98) 100%
                ) !important;
                box-shadow:
                    0 15px 50px rgba(0, 0, 0, 0.95),
                    inset 2px 0 15px rgba(${theme.accentRgb}, 0.08) !important;
                position: relative;
            }

            .solid::before {
                display: none;
            }

            /* Tech Corner Marks */
            .solid::after {
                content: "⌜";
                position: absolute;
                top: 2px;
                right: 5px;
                color: rgba(${theme.secondaryRgb}, 0.8);
                font-family: monospace;
                font-size: 1.2rem;
                pointer-events: none;
            }

            /* ─── Navigation: Clean HUD Data Lines ─── */
            .nav-artifact {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.3) !important;
                background: transparent !important;
                color: ${theme.textSecondary} !important;
                border-radius: 4px !important;
            }
            .nav-artifact:hover {
                border-color: rgba(${theme.accentRgb}, 0.4) !important;
                color: ${theme.textPrimary} !important;
                background: rgba(${theme.accentRgb}, 0.03) !important;
            }
            .nav-artifact.active {
                border-color: var(--accent-color) !important;
                background: rgba(${theme.accentRgb}, 0.08) !important;
                color: var(--accent-color) !important;
                box-shadow: inset 0 0 15px rgba(${theme.accentRgb}, 0.15),
                            0 0 10px rgba(${theme.accentRgb}, 0.1) !important;
            }
            .nav-artifact.active .nav-icon {
                color: var(--accent-color) !important;
                text-shadow: 0 0 15px var(--accent-color);
            }

            /* ─── Buttons: Neon Frame ─── */
            .btn {
                border: 1px solid rgba(${theme.accentRgb}, 0.5) !important;
                background: transparent !important;
                color: var(--accent-color) !important;
                border-radius: 4px !important;
                position: relative;
                overflow: hidden;
            }
            .btn:hover {
                background: rgba(${theme.accentRgb}, 0.15) !important;
                box-shadow: 0 0 20px rgba(${theme.accentRgb}, 0.3),
                            inset 0 0 15px rgba(${theme.accentRgb}, 0.2) !important;
            }
            .btn-primary {
                background: rgba(${theme.accentRgb}, 0.1) !important;
                box-shadow: inset 0 0 10px rgba(${theme.accentRgb}, 0.2) !important;
                font-weight: 700;
                letter-spacing: 0.1em;
            }
            .btn-primary:hover {
                background: rgba(${theme.accentRgb}, 0.25) !important;
                animation: neon-pulse 1s infinite alternate;
            }

            /* ─── Typography: Sci-Fi Tech ─── */
            h1, h2, h3, .display-title {
                text-transform: uppercase;
                letter-spacing: 0.2em;
                font-weight: 700;
            }
            .display-title {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .display-title::before {
                content: "";
                display: block;
                width: 40px;
                height: 2px;
                background: var(--accent-color);
                box-shadow: 0 0 10px var(--accent-color);
            }

            /* ─── Section Headers: Sub-systems ─── */
            .display-header {
                border-bottom: 1px solid rgba(${theme.secondaryRgb}, 0.5) !important;
                position: relative;
                padding-bottom: 10px;
            }
            .display-header::after {
                content: "SYS.ONLINE";
                position: absolute;
                bottom: -8px;
                right: 15px;
                font-family: 'Rajdhani', sans-serif;
                font-size: 0.6rem;
                letter-spacing: 0.2em;
                color: rgba(${theme.accentRgb}, 0.6);
                background: ${theme.bgColor};
                padding: 0 5px;
            }

            /* ─── Group Titles: Tech Data ─── */
            .group-title {
                letter-spacing: 0.15em !important;
                font-family: 'Orbitron', sans-serif !important;
                font-size: 0.8rem !important;
                color: ${theme.textSecondary} !important;
                text-transform: uppercase;
                border-left: 2px solid rgba(${theme.accentRgb}, 0.4);
                padding-left: 10px !important;
            }

            /* ─── Cards: Clean Data Frames ─── */
            .combat-card, .item-card, .bestiary-entry {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.4) !important;
                border-left: 2px solid rgba(${theme.accentRgb}, 0.6) !important;
                background: rgba(3, 4, 10, 0.8) !important;
                border-radius: 4px !important;
            }
            .combat-card:hover, .item-card:hover {
                border-left-color: var(--accent-color) !important;
                box-shadow: inset 5px 0 15px rgba(${theme.accentRgb}, 0.05),
                            0 5px 20px rgba(0, 0, 0, 0.8) !important;
            }

            /* ─── Modals: Targeting System ─── */
            .modal-content, .consequence-modal {
                border: 1px solid rgba(${theme.accentRgb}, 0.5) !important;
                border-radius: 8px !important;
                background: rgba(5, 7, 15, 0.98) !important;
                box-shadow:
                    0 0 80px rgba(0, 0, 0, 0.95),
                    0 0 30px rgba(${theme.accentRgb}, 0.1),
                    inset 0 0 50px rgba(${theme.accentRgb}, 0.05) !important;
                position: relative;
            }
            .modal-content::before, .consequence-modal::before {
                content: "⌖ TARGET LOCKED";
                position: absolute;
                top: -10px;
                left: 20px;
                font-family: 'Orbitron', sans-serif;
                font-size: 0.65rem;
                color: var(--accent-color);
                background: ${theme.bgColor};
                padding: 0 10px;
                letter-spacing: 0.1em;
            }

            /* ─── Inputs: Clean Neon Bounds ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.5) !important;
                background: rgba(3, 4, 10, 0.6) !important;
                color: ${theme.textPrimary} !important;
                border-radius: 2px !important;
                font-family: 'Rajdhani', sans-serif !important;
                letter-spacing: 0.05em;
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                border-color: var(--accent-color) !important;
                box-shadow: inset 0 0 10px rgba(${theme.accentRgb}, 0.15),
                            0 0 15px rgba(${theme.accentRgb}, 0.2) !important;
            }

            /* ─── Scrollbar: Thin Red Laser ─── */
            .scrollbar-arcane::-webkit-scrollbar {
                width: 6px !important;
            }
            .scrollbar-arcane::-webkit-scrollbar-thumb {
                border-radius: 0 !important;
                background: rgba(${theme.accentRgb}, 0.4) !important;
            }
            .scrollbar-arcane::-webkit-scrollbar-thumb:hover {
                background: var(--accent-color) !important;
                box-shadow: 0 0 10px var(--accent-color);
            }
        ` : ''}

        ${theme.id === 'pirata' ? `
            /* ═══ PIRATE NAUTICAL DARK UI ═══ */

            @keyframes pirate-firelight {
                0%, 100% { opacity: 0.4; }
                30% { opacity: 0.55; }
                60% { opacity: 0.35; }
                80% { opacity: 0.6; }
            }

            /* ─── Panels: Dark Wooden Frames ─── */
            .solid {
                border: 2px solid rgba(${theme.secondaryRgb}, 0.4) !important;
                border-top: 2px solid rgba(${theme.accentRgb}, 0.3) !important;
                background: linear-gradient(
                    180deg,
                    rgba(20, 14, 8, 0.97) 0%,
                    rgba(14, 10, 6, 0.98) 50%,
                    rgba(18, 12, 7, 0.97) 100%
                ) !important;
                background-image: ${theme.surfacePattern} !important;
                box-shadow:
                    0 10px 50px rgba(0, 0, 0, 0.95),
                    inset 0 0 40px rgba(${theme.accentRgb}, 0.02),
                    inset 0 1px 0 rgba(${theme.accentRgb}, 0.08) !important;
                position: relative;
            }

            /* Top worn line */
            .solid::before {
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(${theme.secondaryRgb}, 0.3) 10%,
                    ${theme.accentColor}70 40%,
                    ${theme.accentColor}90 50%,
                    ${theme.accentColor}70 60%,
                    rgba(${theme.secondaryRgb}, 0.3) 90%,
                    transparent 100%
                ) !important;
                height: 2px !important;
                animation: pirate-firelight 5s ease-in-out infinite;
            }

            /* Skull ornament on panels */
            .solid::after {
                content: "☠";
                position: absolute;
                bottom: 5px;
                right: 8px;
                font-size: 0.65rem;
                color: rgba(${theme.accentRgb}, 0.1);
                pointer-events: none;
                z-index: 1;
            }

            /* Status bar: no clip */
            .system-status-bar.solid {
                border-left: 2px solid rgba(${theme.secondaryRgb}, 0.35) !important;
                border-right: 2px solid rgba(${theme.secondaryRgb}, 0.35) !important;
            }

            /* ─── Navigation: Nautical Tabs ─── */
            .nav-artifact {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.15) !important;
                transition: all 0.4s ease !important;
            }
            .nav-artifact:hover {
                border-color: rgba(${theme.accentRgb}, 0.2) !important;
                background: rgba(${theme.secondaryRgb}, 0.06) !important;
            }
            .nav-artifact.active {
                background: linear-gradient(180deg, rgba(${theme.secondaryRgb}, 0.1) 0%, rgba(${theme.secondaryRgb}, 0.04) 100%) !important;
                border-color: rgba(${theme.accentRgb}, 0.3) !important;
                border-bottom: 3px solid ${theme.accentColor} !important;
                box-shadow: inset 0 0 20px rgba(${theme.accentRgb}, 0.04) !important;
            }
            .nav-artifact.active .nav-icon {
                color: var(--accent-color) !important;
                text-shadow: 0 0 12px rgba(${theme.accentRgb}, 0.4);
            }

            /* ─── Buttons: Rustic Thick Border ─── */
            .btn {
                border: 2px solid rgba(${theme.secondaryRgb}, 0.4) !important;
                position: relative;
            }
            .btn:hover {
                border-color: rgba(${theme.accentRgb}, 0.5) !important;
                box-shadow: 0 0 15px rgba(${theme.accentRgb}, 0.12),
                            inset 0 0 15px rgba(${theme.accentRgb}, 0.03) !important;
            }
            .btn-primary {
                background: ${theme.goldGradient} !important;
                border-color: rgba(${theme.accentRgb}, 0.5) !important;
                color: #0a0704 !important;
                font-weight: 700;
                box-shadow: 0 2px 10px rgba(${theme.accentRgb}, 0.15) !important;
            }

            /* ─── Typography: Weathered ─── */
            h1, h2, h3 {
                font-style: italic;
                text-shadow: ${theme.headerTextShadow};
                color: var(--accent-color) !important;
            }
            .display-title {
                text-shadow: ${theme.headerTextShadow};
                color: var(--accent-color) !important;
            }
            .display-title::before {
                content: "⚓ ";
                font-style: normal;
                opacity: 0.4;
            }

            /* ─── Cards: Weathered Panels ─── */
            .combat-card, .item-card, .bestiary-entry {
                border: 2px solid rgba(${theme.secondaryRgb}, 0.3) !important;
                border-left: 3px solid rgba(${theme.accentRgb}, 0.25) !important;
                box-shadow:
                    0 5px 25px rgba(0, 0, 0, 0.6),
                    inset 0 0 25px rgba(${theme.accentRgb}, 0.015) !important;
                position: relative;
            }
            .combat-card::after, .item-card::after {
                content: "⚓";
                position: absolute;
                top: 6px;
                right: 8px;
                font-size: 0.55rem;
                color: rgba(${theme.accentRgb}, 0.12);
                pointer-events: none;
            }

            /* ─── Modals: Dark Cabin Frame ─── */
            .modal-content, .consequence-modal {
                border: 2px solid rgba(${theme.secondaryRgb}, 0.5) !important;
                border-top: 2px solid rgba(${theme.accentRgb}, 0.35) !important;
                box-shadow:
                    0 0 80px rgba(0, 0, 0, 0.95),
                    0 0 30px rgba(${theme.accentRgb}, 0.04),
                    inset 0 0 50px rgba(${theme.accentRgb}, 0.015) !important;
                background: linear-gradient(
                    180deg,
                    rgba(16, 12, 8, 0.99) 0%,
                    rgba(10, 7, 4, 1) 100%
                ) !important;
            }

            /* ─── Inputs: Weathered Parchment ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border: 1px solid rgba(${theme.secondaryRgb}, 0.25) !important;
                background: rgba(${theme.secondaryRgb}, 0.04) !important;
                box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                border-color: rgba(${theme.accentRgb}, 0.4) !important;
                box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3),
                            0 0 12px rgba(${theme.accentRgb}, 0.08) !important;
            }

            /* ─── Display Header ─── */
            .display-header {
                border-bottom: 2px solid rgba(${theme.secondaryRgb}, 0.2) !important;
                position: relative;
            }
            .display-header::after {
                content: "~~~ ☠ ~~~";
                position: absolute;
                bottom: -9px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 0.55rem;
                color: rgba(${theme.accentRgb}, 0.15);
                background: ${theme.bgColor};
                padding: 0 10px;
                letter-spacing: 0.2em;
                pointer-events: none;
            }

            /* ─── Group Titles ─── */
            .group-title {
                font-style: italic !important;
                position: relative;
                padding-left: 16px !important;
            }
            .group-title::before {
                content: "⚓";
                position: absolute;
                left: 0;
                color: rgba(${theme.accentRgb}, 0.3);
                font-size: 0.6rem;
                font-style: normal;
                top: 50%;
                transform: translateY(-50%);
            }

            /* ─── Scrollbar: Wooden ─── */
            .scrollbar-arcane::-webkit-scrollbar-thumb {
                border-radius: 2px !important;
                border: 1px solid rgba(${theme.secondaryRgb}, 0.2);
            }

            /* ─── Aspect Tokens ─── */
            .scene-aspect-token {
                border: 2px solid rgba(${theme.secondaryRgb}, 0.2) !important;
                box-shadow: inset 0 0 15px rgba(${theme.accentRgb}, 0.015);
            }
        ` : ''}

        ${theme.id === 'comic' ? `
            /* ═══ COMIC BOOK HALFTONE UI ═══ */

            body {
                background-color: var(--accent-color);
                background-image:
                    radial-gradient(#000 15%, transparent 16%),
                    radial-gradient(#000 15%, transparent 16%);
                background-size: 8px 8px;
                background-position: 0 0, 4px 4px;
                background-attachment: fixed;
            }

            /* Black outline for EVERYTHING */
            * {
                box-sizing: border-box;
            }

            /* ─── Panels: White Comic Panels with Halftones ─── */
            .solid {
                border: 4px solid #000 !important;
                background-color: #fff !important;
                background-image: radial-gradient(rgba(0,0,0,0.1) 15%, transparent 16%),
                                  radial-gradient(rgba(0,0,0,0.1) 15%, transparent 16%) !important;
                background-size: 10px 10px !important;
                background-position: 0 0, 5px 5px !important;
                box-shadow: 8px 8px 0px #000 !important;
                transform: skew(-1deg, 0deg);
                color: #000 !important;
                border-radius: 0 !important;
            }
            .solid::before {
                display: none;
            }

            /* ─── Typography: Bold & Black ─── */
            h1, h2, h3, .display-title {
                color: #fff !important;
                text-shadow: 3px 3px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 2px 2px 0px #000 !important;
                font-family: 'Bangers', cursive;
                letter-spacing: 0.1em;
                transform: rotate(-1deg);
                text-transform: uppercase;
            }

            p, span, div {
                color: #000 !important;
            }
            /* Exception for components that must stay white like the title shadow above */
            .display-title { color: var(--accent-color) !important; }

            /* ─── Navigation: Action Tabs ─── */
            .nav-artifact {
                border: 3px solid #000 !important;
                background: #fff !important;
                color: #000 !important;
                transform: skew(-10deg);
                border-radius: 0 !important;
                box-shadow: 4px 4px 0px #000 !important;
                font-family: 'Bangers', cursive;
                font-size: 1.2rem;
                padding: 10px 20px !important;
                transition: all 0.1s linear !important;
            }
            .nav-artifact:hover {
                transform: skew(-10deg) scale(1.05) translateY(-2px);
                background: var(--accent-color) !important;
                box-shadow: 6px 6px 0px #000 !important;
            }
            .nav-artifact.active {
                background: ${theme.secondaryColor} !important;
                color: #fff !important;
                box-shadow: 6px 6px 0px #000 !important;
                transform: skew(-10deg) scale(1.1) translateY(-4px);
            }
            .nav-artifact .nav-icon {
                transform: skew(10deg); /* un-skew icon */
            }
            .nav-artifact .nav-label {
                transform: skew(10deg); /* un-skew text */
            }

            /* ─── Buttons: Speech Bubbles & Action Lines ─── */
            .btn {
                border: 3px solid #000 !important;
                background: #fff !important;
                color: #000 !important;
                border-radius: 5px !important;
                box-shadow: 4px 4px 0px #000 !important;
                font-family: 'Bangers', cursive;
                font-size: 1.1rem;
                text-transform: uppercase;
                position: relative;
                overflow: visible !important;
                transition: all 0.1s linear !important;
            }
            .btn:hover {
                background: var(--accent-color) !important;
                transform: translateY(-2px) rotate(1deg);
                box-shadow: 6px 6px 0px #000 !important;
            }
            .btn-primary {
                background: var(--accent-color) !important;
                border-radius: 50% / 100% !important; /* Make it a speech bubble */
                border-bottom-left-radius: 0 !important; /* The weird stretch */
                padding: 12px 24px !important;
                transform: rotate(-2deg);
            }
            /* The speech bubble tail */
            .btn-primary::after {
                content: "";
                position: absolute;
                bottom: -10px;
                left: -3px;
                width: 20px;
                height: 20px;
                background: var(--accent-color);
                border-bottom: 3px solid #000;
                border-left: 3px solid #000;
                transform: skewX(-45deg);
                z-index: -1;
            }
            .btn-primary:hover {
                background: ${theme.secondaryColor} !important;
                color: #fff !important;
                transform: scale(1.1) rotate(2deg);
            }
            .btn-primary:hover::after {
                background: ${theme.secondaryColor} !important;
            }

            /* Log Filter Buttons (special fix, they are small) */
            .log-filter-btn {
                border-radius: 0 !important;
                transform: skew(-10deg);
            }

            /* ─── Cards & Entries: Action Panels ─── */
            .combat-card, .item-card, .bestiary-entry, .char-artifact {
                border: 4px solid #000 !important;
                background: #fff !important;
                box-shadow: 5px 5px 0px #000 !important;
                border-radius: 0 !important;
                margin-bottom: 15px;
                color: #000 !important;
            }
            .combat-card, .item-card, .bestiary-entry {
                transform: rotate(-1deg);
            }
            .combat-card:hover, .item-card:hover {
                transform: scale(1.02) rotate(-1deg);
                box-shadow: 8px 8px 0px #000 !important;
            }

            /* Titles inside cards */
            .combat-card h3, .item-card h3 {
                background: var(--accent-color);
                border-bottom: 3px solid #000;
                margin: -15px -15px 10px -15px !important;
                padding: 10px;
                color: #000 !important;
                text-shadow: none !important;
                display: inline-block;
                width: calc(100% + 30px);
                border-right: 3px solid #000;
                box-sizing: border-box;
            }

            /* ─── Modals: BAM! Pow! ─── */
            .modal-content, .consequence-modal {
                border: 5px solid #000 !important;
                background-color: #fff !important;
                background-image:
                    radial-gradient(#000 10%, transparent 11%),
                    radial-gradient(#000 10%, transparent 11%) !important;
                background-size: 20px 20px !important;
                background-position: 0 0, 10px 10px !important;
                border-radius: 0 !important;
                box-shadow: 15px 15px 0px #000 !important;
                transform: rotate(-1deg);
            }
            /* Modal Header needs white bg so text is readable */
            .modal-content h2 {
                background: var(--accent-color);
                color: #000 !important;
                text-shadow: none !important;
                padding: 10px;
                border: 3px solid #000;
                display: inline-block;
                box-shadow: 4px 4px 0px #000;
                transform: rotate(1deg) translateY(-20px);
            }

            /* ─── Inputs: Comic Boxes ─── */
            .glass-input, .select-ritual, .input-ritual, .modal-input {
                border: 3px solid #000 !important;
                background: #fff !important;
                color: #000 !important;
                box-shadow: 4px 4px 0px #000 !important;
                border-radius: 0 !important;
                font-family: 'Comic Neue', cursive !important;
                font-weight: bold;
            }
            .glass-input:focus, .select-ritual:focus, .input-ritual:focus, .modal-input:focus {
                background: #FFFFBB !important;
                outline: none;
                box-shadow: 6px 6px 0px #000 !important;
                transform: translateY(-2px);
            }

            /* Override all other text colors */
            .group-title, .status-label, .meta-value {
                color: #fff !important;
                font-family: 'Bangers', cursive;
            }
            .character-summary, .log-message, .threat-description {
                color: #fff !important;
            }

            /* Scrollbar Comic */
            ::-webkit-scrollbar {
                width: 12px;
                border-left: 3px solid #000;
            }
            ::-webkit-scrollbar-track {
                background: #fff;
            }
            ::-webkit-scrollbar-thumb {
                background: var(--accent-color);
                border: 3px solid #000;
            }

            /* Badge/Tags */
            .px-2.py-1.rounded, .inline-flex.items-center.rounded-full {
                border: 2px solid #000 !important;
                border-radius: 0 !important;
                box-shadow: 2px 2px 0px #000 !important;
                font-family: 'Bangers', cursive;
                transform: rotate(-2deg);
                display: inline-block;
            }
        ` : ''}
    `;
}

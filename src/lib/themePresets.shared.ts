// ═══════════════════════════════════════════════════════════════
// THEMATIC PRESETS — Shared types, data, and utilities
// Safe to import in server components, API routes, and client code
// ═══════════════════════════════════════════════════════════════

export type ThemePresetId = "default" | "medieval" | "cyberpunk" | "pirata" | "gotico" | "espacial" | "comic" | "synthwave";

export interface ThemePreset {
    id: ThemePresetId;
    label: string;
    icon: string;           // Main ornament emoji/unicode
    description: string;

    // ─── Colors ──────────────────────────────────────
    accentColor: string;      // Primary accent hex (UI: buttons, borders, ornaments)
    accentRgb: string;        // RGB triplet e.g. "197, 160, 89"
    titleColor: string;       // Title color hex (h1/h2/h3, .display-title)
    titleRgb: string;         // RGB triplet for title color
    secondaryColor: string;   // Secondary/highlight hex
    secondaryRgb: string;
    bgColor: string;          // Page background
    surfaceColor: string;     // Card/panel surfaces
    dangerColor: string;      // Damage/danger tint
    textPrimary: string;
    textSecondary: string;

    // ─── Typography ──────────────────────────────────
    fontHeader: string;       // CSS font-family for headers
    fontNarrative: string;    // CSS font-family for narrative/flavor text
    fontUI: string;           // CSS font-family for UI labels
    googleFontsUrl: string;   // @import URL for required fonts

    // ─── Decorations & Effects ───────────────────────
    ornamentLeft: string;     // Decorative chars for left side
    ornamentRight: string;    // Decorative chars for right side
    ornamentDivider: string;  // Used in dividers and separators
    borderStyle: string;      // Default border CSS
    borderRadius: string;     // Corners sharpness
    glowIntensity: number;    // Multiplier 0-3 for glow effects
    shadowStyle: string;      // Box-shadow override
    goldGradient: string;     // Primary gradient for buttons/accents

    // ─── Background Textures ─────────────────────────
    bgPattern: string;        // CSS background pattern for body
    surfacePattern: string;   // Subtle pattern for cards

    // ─── Animations ──────────────────────────────────
    transitionSpeed: string;  // CSS transition duration
    hoverScale: string;       // Transform scale on hover
    glowAnimation: string;    // Keyframe-name or "none"

    // ─── Scrollbar ────────────────────────────────────
    scrollbarThumbColor: string;
    scrollbarTrackColor: string;

    // ─── Special Overrides ────────────────────────────
    navBorderChar: string;    // Character for nav decorations
    headerTextShadow: string; // Text-shadow for h1
    buttonTextTransform: string; // uppercase, none, etc.
    inputBgColor: string;
    modalBorderColor: string;
}

// ═══════════════════════════════════════════════════════════════
// THEME DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const DEFAULT: ThemePreset = {
    id: "default",
    label: "PADRÃO",
    icon: "◆",
    description: "Visual clássico do sistema",

    accentColor: "#C5A059",
    accentRgb: "197, 160, 89",
    titleColor: "#F9E79F",
    titleRgb: "249, 231, 159",
    secondaryColor: "#F9E79F",
    secondaryRgb: "249, 231, 159",
    bgColor: "#080808",
    surfaceColor: "rgba(15, 15, 15, 0.95)",
    dangerColor: "#5d0000",
    textPrimary: "#f2f2f2",
    textSecondary: "#a0a0a0",

    fontHeader: "'Cinzel', serif",
    fontNarrative: "'Playfair Display', serif",
    fontUI: "'Inter', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap",

    ornamentLeft: "◆ ",
    ornamentRight: " ◆",
    ornamentDivider: "═══ ◆ ═══",
    borderStyle: "1px solid",
    borderRadius: "2px",
    glowIntensity: 1,
    shadowStyle: "0 10px 40px rgba(0, 0, 0, 0.9)",
    goldGradient: "linear-gradient(135deg, #C5A059 0%, #F9E79F 50%, #C5A059 100%)",

    bgPattern: "radial-gradient(circle at 50% 50%, rgba(10, 10, 10, 0) 0%, #080808 100%)",
    surfacePattern: "linear-gradient(135deg, rgba(197,160,89,0.02) 0%, transparent 50%, rgba(197,160,89,0.02) 100%)",

    transitionSpeed: "0.5s",
    hoverScale: "1.02",
    glowAnimation: "none",

    scrollbarThumbColor: "rgba(197, 160, 89, 0.2)",
    scrollbarTrackColor: "rgba(0, 0, 0, 0.2)",

    navBorderChar: "✧",
    headerTextShadow: "0 0 30px rgba(197, 160, 89, 0.2)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(197, 160, 89, 0.02)",
    modalBorderColor: "#C5A059",
};

const MEDIEVAL: ThemePreset = {
    id: "medieval",
    label: "MEDIEVAL",
    icon: "⚜",
    description: "Reinos antigos e cavalaria",

    accentColor: "#C9A84C",
    accentRgb: "201, 168, 76",
    titleColor: "#E8DCC8",
    titleRgb: "232, 220, 200",
    secondaryColor: "#8B2500",
    secondaryRgb: "139, 37, 0",
    bgColor: "#0d0907",
    surfaceColor: "rgba(22, 16, 12, 0.97)",
    dangerColor: "#5d0000",
    textPrimary: "#e8dcc8",
    textSecondary: "#8a7a60",

    fontHeader: "'Berkshire Swash', cursive",
    fontNarrative: "'Cormorant Garamond', serif",
    fontUI: "'Crimson Text', serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Berkshire+Swash&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&display=swap",

    ornamentLeft: "⚜ ",
    ornamentRight: " ⚜",
    ornamentDivider: "═══ ⚜ ═══",
    borderStyle: "1px solid",
    borderRadius: "2px",
    glowIntensity: 1.2,
    shadowStyle: "0 10px 50px rgba(0, 0, 0, 0.95), 0 0 80px rgba(201, 168, 76, 0.04)",
    goldGradient: "linear-gradient(135deg, #8B6914 0%, #C9A84C 30%, #F0D78C 50%, #C9A84C 70%, #8B6914 100%)",

    bgPattern: `
        radial-gradient(ellipse at 50% 0%, rgba(201, 168, 76, 0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 0% 50%, rgba(139, 37, 0, 0.03) 0%, transparent 40%),
        radial-gradient(ellipse at 100% 50%, rgba(139, 37, 0, 0.03) 0%, transparent 40%),
        radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.6) 0%, transparent 60%),
        linear-gradient(180deg, #0d0907 0%, #0a0704 100%)
    `,
    surfacePattern: "linear-gradient(135deg, rgba(201,168,76,0.03) 0%, transparent 30%, rgba(139,37,0,0.02) 70%, rgba(201,168,76,0.03) 100%)",

    transitionSpeed: "0.5s",
    hoverScale: "1.02",
    glowAnimation: "medieval-ember",

    scrollbarThumbColor: "rgba(201, 168, 76, 0.25)",
    scrollbarTrackColor: "rgba(13, 9, 7, 0.5)",

    navBorderChar: "✧",
    headerTextShadow: "0 0 30px rgba(201, 168, 76, 0.25), 0 2px 4px rgba(0, 0, 0, 0.8)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(201, 168, 76, 0.03)",
    modalBorderColor: "#C9A84C",
};

const CYBERPUNK: ThemePreset = {
    id: "cyberpunk",
    label: "CYBERPUNK",
    icon: "◈",
    description: "Neon e tecnologia sombria",

    accentColor: "#E83050",
    accentRgb: "232, 48, 80",
    titleColor: "#00D4FF",
    titleRgb: "0, 212, 255",
    secondaryColor: "#00D4FF",
    secondaryRgb: "0, 212, 255",
    bgColor: "#0a0608",
    surfaceColor: "rgba(12, 8, 10, 0.96)",
    dangerColor: "#ff0040",
    textPrimary: "#f0c8c8",
    textSecondary: "#6a4a5a",

    fontHeader: "'Orbitron', sans-serif",
    fontNarrative: "'Share Tech Mono', monospace",
    fontUI: "'Rajdhani', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600;700&display=swap",

    ornamentLeft: "[ ",
    ornamentRight: " ]",
    ornamentDivider: "▖▖▖ ◈ ▖▖▖",
    borderStyle: "1px solid",
    borderRadius: "0px",
    glowIntensity: 2.5,
    shadowStyle: "0 0 30px rgba(232, 48, 80, 0.1), 0 10px 40px rgba(0, 0, 0, 0.9)",
    goldGradient: "linear-gradient(135deg, #E83050 0%, #a02040 50%, #E83050 100%)",

    bgPattern: `
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(232,48,80,0.006) 2px, rgba(232,48,80,0.006) 4px),
        radial-gradient(ellipse at 20% 80%, rgba(232,48,80,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.02) 0%, transparent 50%),
        linear-gradient(180deg, #0a0608 0%, #050305 100%)
    `,
    surfacePattern: `
        repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(232,48,80,0.012) 1px, rgba(232,48,80,0.012) 2px),
        repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(232,48,80,0.008) 60px, rgba(232,48,80,0.008) 61px)
    `,

    transitionSpeed: "0.2s",
    hoverScale: "1.01",
    glowAnimation: "cyber-flicker",

    scrollbarThumbColor: "rgba(232, 48, 80, 0.3)",
    scrollbarTrackColor: "rgba(10, 0, 5, 0.5)",

    navBorderChar: "▸",
    headerTextShadow: "0 0 20px rgba(232, 48, 80, 0.6), 0 0 60px rgba(232, 48, 80, 0.2)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(232, 48, 80, 0.03)",
    modalBorderColor: "#E83050",
};

const PIRATA: ThemePreset = {
    id: "pirata",
    label: "PIRATA",
    icon: "☠",
    description: "Mares perigosos e tesouros",

    accentColor: "#C8DD2C",
    accentRgb: "200, 221, 44",
    titleColor: "#E8D5B8",
    titleRgb: "232, 213, 184",
    secondaryColor: "#6B3A1F",
    secondaryRgb: "107, 58, 31",
    bgColor: "#0a0704",
    surfaceColor: "rgba(16, 12, 8, 0.96)",
    dangerColor: "#6b1a1a",
    textPrimary: "#e8d5b8",
    textSecondary: "#7a6a50",

    fontHeader: "'Pirata One', cursive",
    fontNarrative: "'EB Garamond', serif",
    fontUI: "'Josefin Sans', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Pirata+One&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Josefin+Sans:wght@300;400;500;600;700&display=swap",

    ornamentLeft: "☠ ",
    ornamentRight: " ☠",
    ornamentDivider: "~~~ ☠ ~~~",
    borderStyle: "2px solid",
    borderRadius: "3px",
    glowIntensity: 0.8,
    shadowStyle: "0 8px 40px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(200, 221, 44, 0.08)",
    goldGradient: "linear-gradient(135deg, #6B3A1F 0%, #C8DD2C 40%, #E6F56A 55%, #C8DD2C 70%, #6B3A1F 100%)",

    bgPattern: `
        radial-gradient(ellipse at 50% 0%, rgba(200,221,44,0.04) 0%, transparent 45%),
        radial-gradient(ellipse at 20% 70%, rgba(107,58,31,0.05) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107,58,31,0.04) 0%, transparent 40%),
        radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 60%),
        linear-gradient(180deg, #0a0704 0%, #060402 100%)
    `,
    surfacePattern: `
        repeating-linear-gradient(135deg, transparent, transparent 30px, rgba(107,58,31,0.015) 30px, rgba(107,58,31,0.015) 31px),
        linear-gradient(160deg, rgba(107,58,31,0.04) 0%, transparent 30%, rgba(200,221,44,0.02) 100%)
    `,

    transitionSpeed: "0.4s",
    hoverScale: "1.02",
    glowAnimation: "none",

    scrollbarThumbColor: "rgba(200, 221, 44, 0.2)",
    scrollbarTrackColor: "rgba(10, 7, 4, 0.5)",

    navBorderChar: "⚓",
    headerTextShadow: "2px 2px 6px rgba(0, 0, 0, 0.9), 0 0 20px rgba(200, 221, 44, 0.12)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(107, 58, 31, 0.06)",
    modalBorderColor: "#C8DD2C",
};

const GOTICO: ThemePreset = {
    id: "gotico",
    label: "GÓTICO",
    icon: "✟",
    description: "Trevas, sangue e mistério",

    accentColor: "#9a031d",
    accentRgb: "154, 3, 29",
    titleColor: "#f5f0ea",
    titleRgb: "245, 240, 234",
    secondaryColor: "#4a1212",
    secondaryRgb: "74, 18, 18",
    bgColor: "#070303",
    surfaceColor: "rgba(12, 6, 6, 0.96)",
    dangerColor: "#5e0000",
    textPrimary: "#e8d8d8",
    textSecondary: "#8a7878",

    fontHeader: "'Grenze Gotisch', cursive",
    fontNarrative: "'Spectral', serif",
    fontUI: "'Spectral', serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",

    ornamentLeft: "❦ ",
    ornamentRight: " ❧",
    ornamentDivider: "✟ ✤ ✟",
    borderStyle: "1px solid",
    borderRadius: "2px",
    glowIntensity: 1.2,
    shadowStyle: "0 10px 50px rgba(0, 0, 0, 0.95), inset 0 0 30px rgba(0, 0, 0, 0.8)",
    goldGradient: "linear-gradient(135deg, #4a1212 0%, #9b0a0a 50%, #4a1212 100%)",

    bgPattern: `
        radial-gradient(ellipse at 50% 0%, rgba(155,10,10,0.08) 0%, transparent 60%),
        radial-gradient(circle at 15% 20%, rgba(155,10,10,0.03) 0%, transparent 35%),
        radial-gradient(circle at 85% 75%, rgba(155,10,10,0.03) 0%, transparent 35%),
        radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.8) 0%, transparent 80%),
        linear-gradient(180deg, #070303 0%, #0a0404 100%)
    `,
    surfacePattern: "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)",

    transitionSpeed: "0.5s",
    hoverScale: "1.02",
    glowAnimation: "none",

    scrollbarThumbColor: "rgba(155, 10, 10, 0.4)",
    scrollbarTrackColor: "rgba(5, 2, 2, 0.6)",

    navBorderChar: "✟",
    headerTextShadow: "2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 15px rgba(154, 3, 29, 0.4)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(154, 3, 29, 0.05)",
    modalBorderColor: "#9a031d",
};

const ESPACIAL: ThemePreset = {
    id: "espacial",
    label: "ESPACIAL",
    icon: "⌖",
    description: "Vazio cósmico e tecnologia vermelha",

    accentColor: "#FFFFFF",
    accentRgb: "255, 255, 255",
    titleColor: "#FF3060",
    titleRgb: "255, 48, 96",
    secondaryColor: "#1A233A",
    secondaryRgb: "26, 35, 58",
    bgColor: "#03040A",
    surfaceColor: "rgba(5, 7, 15, 0.94)",
    dangerColor: "#ff0040",
    textPrimary: "#E0E5FF",
    textSecondary: "#63739E",

    fontHeader: "'Orbitron', sans-serif",
    fontNarrative: "'Rajdhani', sans-serif",
    fontUI: "'Titillium Web', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600&family=Titillium+Web:wght@300;400;600&display=swap",

    ornamentLeft: "▪ ",
    ornamentRight: " ▪",
    ornamentDivider: "— — ⌖ — —",
    borderStyle: "1px solid",
    borderRadius: "0px",
    glowIntensity: 1.5,
    shadowStyle: "0 10px 40px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 255, 255, 0.15)",
    goldGradient: "linear-gradient(135deg, #1A233A 0%, #FFFFFF 50%, #1A233A 100%)",

    bgPattern: `
        radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,0.4) 0%, transparent 100%),
        radial-gradient(1px 1px at 30% 70%, rgba(255,255,255,0.2) 0%, transparent 100%),
        radial-gradient(2px 2px at 60% 15%, rgba(255,255,255,0.5) 0%, transparent 100%),
        radial-gradient(1px 1px at 85% 80%, rgba(255,255,255,0.15) 0%, transparent 100%),
        radial-gradient(2px 2px at 80% 40%, rgba(255,255,255,0.3) 0%, transparent 100%),
        radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.1) 0%, transparent 60%),
        radial-gradient(ellipse at 100% 100%, rgba(26,35,58,0.3) 0%, transparent 60%),
        linear-gradient(180deg, #03040A 0%, #010103 100%)
    `,
    surfacePattern: "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.03) 0%, transparent 60%)",

    transitionSpeed: "0.3s",
    hoverScale: "1.01",
    glowAnimation: "neon-pulse",

    scrollbarThumbColor: "rgba(255, 255, 255, 0.4)",
    scrollbarTrackColor: "rgba(3, 4, 10, 0.8)",

    navBorderChar: "⌖",
    headerTextShadow: "0 0 20px rgba(255, 255, 255, 0.6), 0 0 50px rgba(255, 255, 255, 0.2)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(255, 255, 255, 0.04)",
    modalBorderColor: "#FFFFFF",
};

const COMIC: ThemePreset = {
    id: "comic",
    label: "COMIC BOOK",
    icon: "💥",
    description: "Quadrinhos e super-heróis",

    accentColor: "#FFCC00",
    accentRgb: "255, 204, 0",
    titleColor: "#FFFFFF",
    titleRgb: "255, 255, 255",
    secondaryColor: "#00BFFF",
    secondaryRgb: "0, 191, 255",
    bgColor: "#121212",
    surfaceColor: "rgba(255, 255, 255, 1)",
    dangerColor: "#FF2A2A",
    textPrimary: "#000000",
    textSecondary: "#333333",

    fontHeader: "'Bangers', cursive",
    fontNarrative: "'Comic Neue', cursive",
    fontUI: "'Nunito', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,300&family=Permanent+Marker&display=swap",

    ornamentLeft: "🗯️ ",
    ornamentRight: " 🗯️",
    ornamentDivider: "★ BOOM ★",
    borderStyle: "4px solid",
    borderRadius: "0px",
    glowIntensity: 0,
    shadowStyle: "6px 6px 0px #000000, 0 0 0 2px #000000",
    goldGradient: "linear-gradient(135deg, #FFCC00 0%, #FF9900 50%, #FFCC00 100%)",

    bgPattern: `
        radial-gradient(circle at 10% 10%, rgba(255, 204, 0, 0.4) 20%, transparent 20%),
        radial-gradient(circle at 10% 10%, rgba(255, 204, 0, 0.4) 20%, transparent 20%)
    `,
    surfacePattern: "radial-gradient(circle, #000000 2px, transparent 2.5px)",

    transitionSpeed: "0.15s",
    hoverScale: "1.06",
    glowAnimation: "none",

    scrollbarThumbColor: "#FFCC00",
    scrollbarTrackColor: "#121212",

    navBorderChar: "★",
    headerTextShadow: "3px 3px 0px #000000, -1px -1px 0px #000000, 1px -1px 0px #000000, -1px 1px 0px #000000",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(255, 255, 255, 0.9)",
    modalBorderColor: "#000000",
};

const SYNTHWAVE: ThemePreset = {
    id: "synthwave",
    label: "SYNTHWAVE",
    icon: "▲",
    description: "Neon retrô e grade infinita",

    accentColor: "#ff2bd6",
    accentRgb: "255, 43, 214",
    titleColor: "#00f0ff",
    titleRgb: "0, 240, 255",
    secondaryColor: "#7b00ff",
    secondaryRgb: "123, 0, 255",
    bgColor: "#0a0010",
    surfaceColor: "rgba(12, 2, 20, 0.96)",
    dangerColor: "#ff003c",
    textPrimary: "#e8e0ff",
    textSecondary: "#8070a0",

    fontHeader: "'Vampiro One', cursive",
    fontNarrative: "'Titillium Web', sans-serif",
    fontUI: "'Titillium Web', sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Vampiro+One&family=Titillium+Web:wght@300;400;600;700&display=swap",

    ornamentLeft: "▲ ",
    ornamentRight: " ▲",
    ornamentDivider: "─── ▲ ───",
    borderStyle: "1px solid",
    borderRadius: "0px",
    glowIntensity: 2,
    shadowStyle: "0 0 30px rgba(255, 43, 214, 0.1), 0 10px 40px rgba(0, 0, 0, 0.9)",
    goldGradient: "linear-gradient(135deg, #ff2bd6 0%, #7b00ff 50%, #ff2bd6 100%)",

    bgPattern: `
        linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(255, 43, 214, 0.04) 100%),
        repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(123, 0, 255, 0.05) 60px, rgba(123, 0, 255, 0.05) 61px),
        repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(123, 0, 255, 0.05) 60px, rgba(123, 0, 255, 0.05) 61px),
        radial-gradient(ellipse at 50% 120%, rgba(255, 43, 214, 0.15) 0%, transparent 60%),
        linear-gradient(180deg, #0a0010 0%, #05000a 100%)
    `,
    surfacePattern: "linear-gradient(135deg, rgba(255,43,214,0.03) 0%, transparent 50%, rgba(0,240,255,0.02) 100%)",

    transitionSpeed: "0.3s",
    hoverScale: "1.02",
    glowAnimation: "none",

    scrollbarThumbColor: "rgba(255, 43, 214, 0.3)",
    scrollbarTrackColor: "rgba(10, 0, 16, 0.6)",

    navBorderChar: "▲",
    headerTextShadow: "0 0 4px rgba(0, 240, 255, 0.9), 0 0 10px rgba(0, 240, 255, 0.6), 0 0 22px rgba(255, 43, 214, 0.35)",
    buttonTextTransform: "uppercase",
    inputBgColor: "rgba(255, 43, 214, 0.04)",
    modalBorderColor: "#ff2bd6",
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
    default: DEFAULT,
    medieval: MEDIEVAL,
    cyberpunk: CYBERPUNK,
    pirata: PIRATA,
    gotico: GOTICO,
    espacial: ESPACIAL,
    comic: COMIC,
    synthwave: SYNTHWAVE,
};

export const THEME_LIST: ThemePreset[] = [
    DEFAULT, MEDIEVAL, CYBERPUNK, PIRATA, GOTICO, ESPACIAL, COMIC, SYNTHWAVE
];

export function getThemePreset(id: string | undefined): ThemePreset {
    return THEME_PRESETS[(id as ThemePresetId)] || MEDIEVAL;
}

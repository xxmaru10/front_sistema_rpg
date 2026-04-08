"use client";

export interface SkillPalette {
    accent: string;
    borderColor: string;
    background: string;
    labelColor: string;
    valueColor: string;
    shadow: string;
}

export function getSkillPalette(level: number): SkillPalette {
    if (level <= -1) {
        return {
            accent: "#ff6b6b",
            borderColor: "rgba(255, 107, 107, 0.34)",
            background: "linear-gradient(135deg, rgba(116, 28, 36, 0.24), rgba(18, 8, 10, 0.84))",
            labelColor: "#ffd0d0",
            valueColor: "#ff9393",
            shadow: "0 0 18px rgba(255, 107, 107, 0.12)",
        };
    }

    if (level === 0) {
        return {
            accent: "rgba(255, 255, 255, 0.32)",
            borderColor: "rgba(255, 255, 255, 0.06)",
            background: "rgba(255, 255, 255, 0.02)",
            labelColor: "rgba(255, 255, 255, 0.72)",
            valueColor: "#f2ebdc",
            shadow: "none",
        };
    }

    if (level === 1) {
        return {
            accent: "#43c77a",
            borderColor: "rgba(67, 199, 122, 0.3)",
            background: "linear-gradient(135deg, rgba(24, 92, 52, 0.24), rgba(10, 16, 13, 0.82))",
            labelColor: "#dcfbe8",
            valueColor: "#83f0ac",
            shadow: "0 0 18px rgba(67, 199, 122, 0.12)",
        };
    }

    if (level === 2) {
        return {
            accent: "#4ea4ff",
            borderColor: "rgba(78, 164, 255, 0.3)",
            background: "linear-gradient(135deg, rgba(24, 60, 110, 0.26), rgba(9, 12, 22, 0.84))",
            labelColor: "#d9edff",
            valueColor: "#8ac5ff",
            shadow: "0 0 18px rgba(78, 164, 255, 0.12)",
        };
    }

    if (level === 3) {
        return {
            accent: "#a86dff",
            borderColor: "rgba(168, 109, 255, 0.3)",
            background: "linear-gradient(135deg, rgba(68, 38, 122, 0.28), rgba(15, 10, 24, 0.86))",
            labelColor: "#f0e4ff",
            valueColor: "#cba7ff",
            shadow: "0 0 18px rgba(168, 109, 255, 0.12)",
        };
    }

    if (level === 4) {
        return {
            accent: "#ff9f43",
            borderColor: "rgba(255, 159, 67, 0.32)",
            background: "linear-gradient(135deg, rgba(118, 66, 18, 0.28), rgba(25, 14, 9, 0.84))",
            labelColor: "#fff0df",
            valueColor: "#ffc37f",
            shadow: "0 0 18px rgba(255, 159, 67, 0.14)",
        };
    }

    return {
        accent: "#e5c15a",
        borderColor: "rgba(229, 193, 90, 0.34)",
        background: "linear-gradient(135deg, rgba(118, 92, 20, 0.3), rgba(25, 18, 8, 0.86))",
        labelColor: "#fff6db",
        valueColor: "#ffe08a",
        shadow: "0 0 18px rgba(229, 193, 90, 0.14)",
    };
}

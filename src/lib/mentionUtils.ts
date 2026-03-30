import { WorldEntityType } from "@/types/domain";

export const MENTION_COLORS: Record<string, string> = {
    "PERSONAGEM": "#f5a623", // Laranja
    "LOCALIZACAO": "#7ed321", // Verde
    "MAPA": "#7ed321", // Verde (Cenário)
    "FACAO": "#bd10e0", // Rosa/Roxo
    "FAMILIA": "#bd10e0", // Rosa (Facção/Grupo)
    "BESTIARIO": "#FF4444", // Vermelho
    "RACA": "#50e3c2", // Ciano (Outros)
    "ITEM": "#4a90e2", // Azul
    "HABILIDADE": "#bd10e0", // Rosa
    "MISSÃO": "#C5A059", // Dourado
    "TAG": "#C5A059" // Dourado
};

export const getDisplayTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        "PERSONAGEM": "Personagem",
        "LOCALIZACAO": "Localização",
        "MAPA": "Mapa",
        "FACAO": "Facção",
        "FAMILIA": "Família",
        "BESTIARIO": "Bestiário",
        "RACA": "Raça",
        "ITEM": "Item",
        "HABILIDADE": "Habilidade",
        "MISSÃO": "Missão"
    };
    return labels[type] || type;
};

/**
 * Parses text and wraps mentions/tags in styled span elements.
 * Mentions are expected to be in the format: @[Name](type:id)
 * Tags are expected to be in the format: #[TagName]
 */
export function renderMentions(text: string): string {
    if (!text) return "";

    // If it already contains mention-link spans, it's already HTML from MentionEditor
    if (text.includes('class="mention-link"') || text.includes('class="tag-link"')) {
        return text;
    }

    // Parse Mentions: @[Name](type:id)
    let processed = text.replace(/@\[([^\]]+)\]\(([^:]+):([^)]+)\)/g, (match, name, type, id) => {
        const color = MENTION_COLORS[type] || "#C5A059";
        return `<span class="mention-link" data-mention-id="${id}" data-mention-type="${type}" style="color: ${color}; font-weight: bold; cursor: pointer; text-shadow: 0 0 5px ${color}44;">${name}</span>`;
    });

    // Parse Tags: #Tag
    processed = processed.replace(/#(\w+)/g, (match, tag) => {
        const color = MENTION_COLORS["TAG"];
        return `<span class="tag-link" data-tag="${tag}" style="color: ${color}; font-weight: bold; cursor: pointer; text-decoration: underline;">#${tag}</span>`;
    });

    return processed;
}

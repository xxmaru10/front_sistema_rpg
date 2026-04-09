export type MentionNavigationRequest = {
    mentionId?: string;
    mentionType?: string;
    tag?: string;
};

export function getMentionNavigationRequest(target: EventTarget | null): MentionNavigationRequest | null {
    const element = target instanceof HTMLElement
        ? target.closest("[data-mention-id], [data-tag]") as HTMLElement | null
        : null;

    if (!element) return null;

    const tag = element.getAttribute("data-tag");
    if (tag) return { tag };

    const mentionId = element.getAttribute("data-mention-id");
    const mentionType = element.getAttribute("data-mention-type");

    if (mentionId && mentionType) {
        return { mentionId, mentionType };
    }

    return null;
}

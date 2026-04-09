import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Check, X } from "lucide-react";
import { MentionSuggestions } from "./MentionSuggestions";
import { MENTION_COLORS, escapeMentionRegExp, normalizeMentionSearch } from "@/lib/mentionUtils";

interface MentionEditorProps {
    value: string;
    style?: React.CSSProperties;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    mentionEntities: any[];
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

type MentionCandidate = {
    id: string;
    name: string;
    type: string;
    displayType?: string;
    isTag?: boolean;
};

function isBoundaryCharacter(char?: string): boolean {
    if (!char) return true;
    return /[\s.,;:!?()[\]{}"'`~<>/\\|+=\-_*]/.test(char);
}

function getSelectionOffset(root: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0).cloneRange();
    const preRange = range.cloneRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString().length;
}

function restoreSelectionOffset(root: HTMLElement, offset: number) {
    const selection = window.getSelection();
    if (!selection) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let consumed = 0;

    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const nextConsumed = consumed + (node.textContent || "").length;
        if (offset <= nextConsumed) {
            const range = document.createRange();
            range.setStart(node, Math.max(0, offset - consumed));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        consumed = nextConsumed;
    }

    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.addRange(range);
}

function createMentionElement(item: MentionCandidate): HTMLSpanElement {
    const span = document.createElement("span");
    const color = MENTION_COLORS[item.displayType || item.type] || "#C5A059";
    span.className = item.isTag ? "tag-link" : "mention-link";
    span.style.color = color;
    span.style.fontWeight = "bold";
    span.style.cursor = "pointer";
    span.contentEditable = "false";

    if (item.isTag) {
        span.setAttribute("data-tag", item.name);
        span.textContent = `#${item.name}`;
        span.style.textDecoration = "underline";
    } else {
        span.setAttribute("data-mention-id", item.id);
        span.setAttribute("data-mention-type", item.displayType || item.type);
        span.textContent = item.name;
        span.style.textShadow = `0 0 5px ${color}44`;
    }

    return span;
}

function placeCaretAfterNode(node: Node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

export const MentionEditor = forwardRef<HTMLDivElement, MentionEditorProps>(({
    value,
    style,
    onChange,
    placeholder,
    className,
    mentionEntities,
    onKeyDown
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => editorRef.current!);

    const [mentionState, setMentionState] = useState<{
        active: boolean;
        query: string;
        position: { top: number; left: number };
    }>({ active: false, query: "", position: { top: 0, left: 0 } });
    const [mentionActionState, setMentionActionState] = useState<{
        active: boolean;
        target: HTMLElement | null;
        position: { top: number; left: number };
    }>({ active: false, target: null, position: { top: 0, left: 0 } });

    const autoMentionCandidates = useMemo(() => {
        const seen = new Set<string>();
        return (mentionEntities || [])
            .filter((entity): entity is MentionCandidate => !!entity?.id && !!entity?.name && !entity.isTag)
            .map(entity => ({
                id: entity.id,
                name: entity.name,
                type: entity.type,
                displayType: entity.displayType,
                isTag: entity.isTag
            }))
            .filter(entity => {
                const key = normalizeMentionSearch(entity.name);
                if (!key || key.length < 2 || seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => b.name.length - a.name.length);
    }, [mentionEntities]);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value;
                if (!value) editorRef.current.innerHTML = "";
            }
        }
    }, [value]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const syncValue = () => onChange(editor.innerHTML);

        const autoLinkTypedMentions = () => {
            if (autoMentionCandidates.length === 0) return false;

            const caretOffset = getSelectionOffset(editor);
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (parent.closest(".mention-link, .tag-link")) return NodeFilter.FILTER_REJECT;
                    if (!(node.textContent || "").trim()) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            const textNodes: Text[] = [];
            while (walker.nextNode()) {
                textNodes.push(walker.currentNode as Text);
            }

            let changed = false;

            textNodes.forEach((node) => {
                const source = node.textContent || "";
                if (!source.trim()) return;

                let cursor = 0;
                const fragment = document.createDocumentFragment();
                let nodeChanged = false;

                while (cursor < source.length) {
                    let bestMatch: null | {
                        start: number;
                        end: number;
                        candidate: MentionCandidate;
                    } = null;

                    for (const candidate of autoMentionCandidates) {
                        const regex = new RegExp(escapeMentionRegExp(candidate.name), "ig");
                        regex.lastIndex = cursor;
                        const match = regex.exec(source);
                        if (!match) continue;

                        const start = match.index;
                        const end = start + match[0].length;
                        const prevChar = source[start - 1];
                        const nextChar = source[end];
                        if (!isBoundaryCharacter(prevChar) || !isBoundaryCharacter(nextChar)) continue;

                        if (!bestMatch || start < bestMatch.start || (start === bestMatch.start && match[0].length > (bestMatch.end - bestMatch.start))) {
                            bestMatch = { start, end, candidate };
                        }
                    }

                    if (!bestMatch) break;

                    if (bestMatch.start > cursor) {
                        fragment.appendChild(document.createTextNode(source.slice(cursor, bestMatch.start)));
                    }

                    fragment.appendChild(createMentionElement(bestMatch.candidate));
                    cursor = bestMatch.end;
                    nodeChanged = true;
                }

                if (!nodeChanged) return;
                if (cursor < source.length) {
                    fragment.appendChild(document.createTextNode(source.slice(cursor)));
                }
                node.replaceWith(fragment);
                changed = true;
            });

            if (changed) {
                restoreSelectionOffset(editor, caretOffset);
            }

            return changed;
        };

        const updateMentionSuggestions = () => {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const preRange = range.cloneRange();
                preRange.selectNodeContents(editor);
                preRange.setEnd(range.endContainer, range.endOffset);
                const text = preRange.toString();

                const match = text.match(/@([^\s]*)$/);
                if (match) {
                    const query = match[1];
                    let rect: DOMRect | null = null;
                    const rects = range.getClientRects();
                    if (rects.length > 0) {
                        rect = rects[0] as DOMRect;
                    } else {
                        try {
                            const marker = document.createElement("span");
                            marker.textContent = "\u200B";
                            range.insertNode(marker);
                            rect = marker.getBoundingClientRect();
                            marker.remove();
                        } catch {
                            rect = editor.getBoundingClientRect();
                        }
                    }

                    if (rect) {
                        const dropdownHeight = 250;
                        let top = rect.bottom + 5;
                        if (top + dropdownHeight > window.innerHeight && rect.top > dropdownHeight) {
                            top = rect.top - dropdownHeight - 5;
                        }
                        top = Math.max(10, Math.min(top, window.innerHeight - dropdownHeight - 10));

                        setMentionState({
                            active: true,
                            query,
                            position: { top, left: rect.left }
                        });
                        return;
                    }
                }
            }

            setMentionState(prev => ({ ...prev, active: false }));
        };

        const handleInput = () => {
            autoLinkTypedMentions();
            syncValue();
            updateMentionSuggestions();
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "@" || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter" || e.key.length === 1) {
                handleInput();
            }
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            const mentionElement = target?.closest(".mention-link, .tag-link") as HTMLElement | null;
            if (mentionElement && editor.contains(mentionElement)) {
                e.preventDefault();
                const rect = mentionElement.getBoundingClientRect();
                const editorRect = editor.getBoundingClientRect();
                setMentionActionState({
                    active: true,
                    target: mentionElement,
                    position: {
                        top: rect.top - editorRect.top - 36,
                        left: Math.max(8, rect.left - editorRect.left)
                    }
                });
                setMentionState(prev => ({ ...prev, active: false }));
                return;
            }

            setMentionActionState(prev => ({ ...prev, active: false, target: null }));
            updateMentionSuggestions();
        };

        const handleSelectionChange = () => {
            if (!editor.contains(document.activeElement) && mentionActionState.active) {
                setMentionActionState(prev => ({ ...prev, active: false, target: null }));
            }
        };

        editor.addEventListener("input", handleInput);
        editor.addEventListener("keyup", handleKeyUp);
        editor.addEventListener("click", handleClick);
        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            editor.removeEventListener("input", handleInput);
            editor.removeEventListener("keyup", handleKeyUp);
            editor.removeEventListener("click", handleClick);
            document.removeEventListener("selectionchange", handleSelectionChange);
        };
    }, [autoMentionCandidates, mentionActionState.active, onChange]);

    const handleSelectMention = (item: any) => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const candidate: MentionCandidate = {
            id: item.id,
            name: item.name,
            type: item.type,
            displayType: item.displayType,
            isTag: item.isTag
        };

        let found = false;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            const text = textNode.textContent || "";
            const lastAt = text.lastIndexOf("@", range.startOffset - 1);
            if (lastAt !== -1) {
                range.setStart(textNode, lastAt);
                range.setEnd(textNode, range.startOffset);
                range.deleteContents();
                found = true;
            }
        }

        if (!found) {
            const preRange = range.cloneRange();
            preRange.selectNodeContents(editorRef.current);
            preRange.setEnd(range.startContainer, range.startOffset);
        }

        const mentionNode = createMentionElement(candidate);
        range.insertNode(mentionNode);
        const space = document.createTextNode("\u00A0");
        range.setStartAfter(mentionNode);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);

        onChange(editorRef.current.innerHTML);
        setMentionState({ active: false, query: "", position: { top: 0, left: 0 } });
        setTimeout(() => editorRef.current?.focus(), 10);
    };

    const handleKeepMention = () => {
        setMentionActionState({ active: false, target: null, position: { top: 0, left: 0 } });
        setTimeout(() => editorRef.current?.focus(), 10);
    };

    const handleRemoveMention = () => {
        const mentionElement = mentionActionState.target;
        if (!mentionElement || !editorRef.current || !editorRef.current.contains(mentionElement)) {
            setMentionActionState({ active: false, target: null, position: { top: 0, left: 0 } });
            return;
        }

        const textContent = mentionElement.classList.contains("tag-link")
            ? `#${mentionElement.getAttribute("data-tag") || mentionElement.textContent || ""}`
            : (mentionElement.textContent || "");
        const replacement = document.createTextNode(textContent);
        mentionElement.replaceWith(replacement);
        placeCaretAfterNode(replacement);
        onChange(editorRef.current.innerHTML);
        setMentionActionState({ active: false, target: null, position: { top: 0, left: 0 } });
        setTimeout(() => editorRef.current?.focus(), 10);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    };

    return (
        <div className="mention-editor-container" style={{ position: "relative", width: "100%" }}>
            <div
                ref={editorRef}
                contentEditable
                className={`mention-rich-editor ${className || ""}`}
                data-placeholder={placeholder}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                    const selection = window.getSelection();
                    const anchorNode = selection?.anchorNode;
                    const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode as HTMLElement | null;

                    if (mentionState.active && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape")) {
                        e.preventDefault();
                        return;
                    }
                    if (e.key === "Escape" && mentionActionState.active) {
                        e.preventDefault();
                        handleKeepMention();
                        return;
                    }
                    if (e.key === "Shift" && mentionActionState.active) {
                        return;
                    }
                    if (e.key === "Enter" && e.shiftKey && anchorElement?.closest("li")) {
                        e.preventDefault();
                        document.execCommand("insertHTML", false, "</li><li>");
                        onChange(editorRef.current?.innerHTML || "");
                        return;
                    }
                    onKeyDown?.(e);
                }}
                onBlur={() => {
                    setTimeout(() => {
                        setMentionState(prev => ({ ...prev, active: false }));
                    }, 250);
                }}
                spellCheck="false"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                style={{
                    minHeight: "60px",
                    outline: "none",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    transition: "all 0.2s ease",
                    ...style
                }}
            />
            {mentionState.active && (
                <MentionSuggestions
                    query={mentionState.query}
                    entities={mentionEntities || []}
                    onSelect={handleSelectMention}
                    position={mentionState.position}
                    onClose={() => setMentionState(prev => ({ ...prev, active: false }))}
                />
            )}
            {mentionActionState.active && (
                <div
                    className="mention-action-popover"
                    style={{
                        position: "absolute",
                        top: Math.max(4, mentionActionState.position.top),
                        left: mentionActionState.position.left,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 8px",
                        borderRadius: "999px",
                        background: "rgba(10,10,10,0.96)",
                        border: "1px solid rgba(197,160,89,0.55)",
                        boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
                        zIndex: 50
                    }}
                >
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleRemoveMention}
                        className="tool-btn"
                        title="Remover menção"
                    >
                        <X size={12} />
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleKeepMention}
                        className="tool-btn"
                        title="Manter menção"
                    >
                        <Check size={12} />
                    </button>
                </div>
            )}
        </div>
    );
});

MentionEditor.displayName = "MentionEditor";

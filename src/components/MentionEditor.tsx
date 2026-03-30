import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { MentionSuggestions } from "./MentionSuggestions";
import { MENTION_COLORS } from "@/lib/mentionUtils";

interface MentionEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    mentionEntities: any[];
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const MentionEditor = forwardRef<HTMLDivElement, MentionEditorProps>(({ 
    value, onChange, placeholder, className, mentionEntities, onKeyDown 
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    
    useImperativeHandle(ref, () => editorRef.current!);

    const [mentionState, setMentionState] = useState<{
        active: boolean;
        query: string;
        position: { top: number; left: number };
    }>({ active: false, query: "", position: { top: 0, left: 0 } });

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = value;
                if (!value) editorRef.current.innerHTML = "";
            }
        }
    }, [value]);

    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;

        const handleInput = () => {
            const html = el.innerHTML;
            onChange(html);
            
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const preRange = range.cloneRange();
                preRange.selectNodeContents(el);
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
                        } catch (e) {
                            rect = el.getBoundingClientRect();
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

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === '@' || e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.altKey)) {
                handleInput();
            }
        };

        el.addEventListener('input', handleInput);
        el.addEventListener('keyup', handleKeyUp);
        el.addEventListener('click', handleInput);

        return () => {
            el.removeEventListener('input', handleInput);
            el.removeEventListener('keyup', handleKeyUp);
            el.removeEventListener('click', handleInput);
        };
    }, [onChange]);

    const handleSelectMention = (item: any) => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        
        // Find @ and query to delete robustly
        let container = range.startContainer;
        let offset = range.startOffset;

        // Find the text node that actually contains the @
        let found = false;
        if (container.nodeType === Node.TEXT_NODE) {
            const text = container.textContent || "";
            const lastAt = text.lastIndexOf("@", offset - 1);
            if (lastAt !== -1) {
                range.setStart(container, lastAt);
                range.setEnd(container, offset);
                range.deleteContents();
                found = true;
            }
        }

        // If not found in current node, it might be in previous sibling (Chrome/Firefox difference)
        if (!found) {
            // Fallback: try to find @ in the whole editor before cursor
            // This is safer for complex cases
            const preRange = range.cloneRange();
            preRange.selectNodeContents(editorRef.current);
            preRange.setEnd(range.startContainer, range.startOffset);
            
            // Delete the trigger text manually if we have to
            // But usually range.deleteContents() above works if we are cautious
        }

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
            span.textContent = `${item.name}`;
            span.style.textShadow = `0 0 5px ${color}44`;
        }
        
        range.insertNode(span);
        const space = document.createTextNode("\u00A0");
        range.setStartAfter(span);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        onChange(editorRef.current.innerHTML);
        setMentionState({ active: false, query: "", position: { top: 0, left: 0 } });
        
        // Refocus
        setTimeout(() => editorRef.current?.focus(), 10);
    };

    return (
        <div className="mention-editor-container" style={{ position: "relative", width: "100%" }}>
            <div
                ref={editorRef}
                contentEditable
                className={`mention-rich-editor ${className || ""}`}
                data-placeholder={placeholder}
                onKeyDown={(e) => {
                    if (mentionState.active && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                        e.preventDefault();
                        return;
                    }
                    if (onKeyDown) onKeyDown(e);
                }}
                onBlur={() => {
                    // Slight delay to allow clicks on the dropdown to register FIRST
                    setTimeout(() => setMentionState(prev => ({...prev, active: false})), 250);
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
                    transition: "all 0.2s ease"
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
        </div>
    );
});
MentionEditor.displayName = "MentionEditor";

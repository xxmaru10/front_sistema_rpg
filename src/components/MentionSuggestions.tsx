import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MENTION_COLORS } from '@/lib/mentionUtils';

interface MentionSuggestionsProps {
    query: string;
    entities: any[];
    onSelect: (item: any) => void;
    position: { top: number; left: number };
    onClose: () => void;
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
    query, entities, onSelect, position, onClose
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filteredSuggestions = query === "" 
        ? entities.slice(0, 10) 
        : entities.filter(e => e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredSuggestions.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + Math.max(1, filteredSuggestions.length)) % Math.max(1, filteredSuggestions.length));
            } else if (e.key === 'Enter') {
                if (filteredSuggestions.length > 0) {
                    e.preventDefault();
                    onSelect(filteredSuggestions[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredSuggestions, selectedIndex, onSelect, onClose]);

    if (filteredSuggestions.length === 0) {
        if (!query) return null;
        return ReactDOM.createPortal(
            <div className="mention-suggestions-dropdown" style={{ 
                position: "fixed", 
                top: position.top, 
                left: position.left,
                zIndex: 2147483647,
                padding: "10px", 
                color: "#666",
                fontSize: "0.85rem",
                background: "rgba(0, 0, 0, 0.95)", 
                border: "1px solid #333",
                borderRadius: "4px",
            }}>
                NENHUM RESULTADO PARA "{query.toUpperCase()}"
            </div>,
            document.body
        );
    }

    const content = (
        <div 
            className="mention-suggestions-dropdown global-dropdown scrollbar-arcane"
            style={{ 
                position: "fixed", 
                top: position.top, 
                left: position.left,
                zIndex: 2147483647,
                background: "#0a0a0a",
                border: "1px solid #C5A059",
                boxShadow: "0 10px 30px rgba(0,0,0,0.8), 0 0 0 1px rgba(197, 160, 89, 0.2)",
                borderRadius: "6px",
                width: "min(300px, 90vw)",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "6px 0",
                display: "block",
                visibility: "visible"
            }}
        >
            <div style={{ padding: "6px 12px", fontSize: "0.65rem", color: "#C5A059", opacity: 0.6, fontWeight: "bold", borderBottom: "1px solid rgba(197, 160, 89, 0.1)", marginBottom: "4px", letterSpacing: "1px" }}>
                SUGESTÕES DE MENÇÃO
            </div>
            {filteredSuggestions.map((item, index) => (
                <div
                    key={item.id}
                    className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                    onMouseDown={(e) => {
                        e.preventDefault(); // Stop focus from leaving editor
                        onSelect(item);
                    }}
                    style={{
                        padding: "10px 15px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        backgroundColor: index === selectedIndex ? "rgba(197, 160, 89, 0.15)" : "transparent",
                    }}
                >
                    <div className="suggestion-icon" style={{ 
                        width: "8px", height: "8px", borderRadius: "50%", 
                        backgroundColor: MENTION_COLORS[item.displayType || item.type] || "#C5A059",
                        boxShadow: `0 0 8px ${MENTION_COLORS[item.displayType || item.type] || "#C5A059"}88`
                    }} />
                    <div className="suggestion-info" style={{ display: "flex", flexDirection: "column" }}>
                        <span className="suggestion-name" style={{ 
                            color: index === selectedIndex ? "#C5A059" : "#eee", 
                            fontWeight: index === selectedIndex ? "bold" : "normal", 
                            fontSize: "0.95rem" 
                        }}>
                            {item.name.toUpperCase()}
                        </span>
                        <span className="suggestion-category" style={{ fontSize: "0.6rem", color: "#888", fontWeight: "bold" }}>
                            {item.displayType || item.category}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};

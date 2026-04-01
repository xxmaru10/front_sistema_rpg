interface CharacterSelectionProps {
    availableCharacters: any[];
    onSelectCharacter: (char: any) => void;
    onBack: () => void;
}

export function CharacterSelection({
    availableCharacters,
    onSelectCharacter,
    onBack
}: CharacterSelectionProps) {
    return (
        <div className="character-selection animate-reveal">
            <h2 className="selection-title victorian-title">ESCOLHA SEU PERSONAGEM</h2>
            <div className="character-grid">
                {availableCharacters.map(char => (
                    <button key={char.id} className="char-select-card" onClick={() => onSelectCharacter(char)}>
                        <div className="char-avatar-ring">
                            <div className="char-avatar-glyph">
                                {char.name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div className="char-name-label">{char.name}</div>
                        <div className="char-card-glow"></div>
                    </button>
                ))}
            </div>
            <div className="selection-actions">
                <button className="mystic-btn back-btn" onClick={onBack}>
                    VOLTAR AO INÍCIO
                </button>
            </div>
        </div>
    );
}

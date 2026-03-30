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
            <h2 className="selection-title">ESCOLHA SEU PERSONAGEM</h2>
            <div className="character-grid-list">
                {availableCharacters.map(char => (
                    <button key={char.id} className="char-select-card" onClick={() => onSelectCharacter(char)}>
                        <div className="char-avatar-placeholder">
                            {char.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="char-name">{char.name}</div>
                    </button>
                ))}
            </div>
            <button className="back-btn" onClick={onBack}>
                VOLTAR
            </button>
        </div>
    );
}

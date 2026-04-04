export function WorldTabStyles() {
    return (
        <style>{`
    .note-badge-count {
        position: absolute;
        top: -10px;
        right: -10px;
        background: #c5a059;
        color: #000;
        font-size: 0.8rem;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        border: 1px solid #000;
    }

    .bestiary-note-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
        padding-left: 10px;
        opacity: 0.8;
    }

    .bestiary-note-badge span {
        font-size: 0.75rem;
        font-weight: bold;
    }
        `}</style>
    );
}

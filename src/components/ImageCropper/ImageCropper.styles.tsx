export function ImageCropperStyles() {
    return (
        <style>{`
            .ic-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.88);
                backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                animation: ic-fade-in 0.2s ease;
            }
            @keyframes ic-fade-in {
                from { opacity: 0; transform: scale(0.96); }
                to   { opacity: 1; transform: scale(1); }
            }
            .ic-container {
                background: #0a0a0a;
                border: 1px solid #C5A059;
                border-radius: 4px;
                padding: 22px 24px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                box-shadow: 0 0 40px rgba(197, 160, 89, 0.15), 0 20px 60px rgba(0, 0, 0, 0.85);
                max-width: 95vw;
                max-height: 95vh;
            }
            .ic-header {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .ic-title {
                font-size: 0.7rem;
                font-weight: bold;
                letter-spacing: 0.15em;
                color: #C5A059;
                text-transform: uppercase;
            }
            .ic-close {
                background: none;
                border: none;
                color: #555;
                cursor: pointer;
                padding: 4px;
                line-height: 1;
                transition: color 0.2s;
            }
            .ic-close:hover { color: #ccc; }
            .ic-hint {
                font-size: 0.58rem;
                color: #444;
                letter-spacing: 0.07em;
                margin: -6px 0 0;
                text-align: center;
            }
            .ic-frame {
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(197, 160, 89, 0.35);
                flex-shrink: 0;
            }
            .ic-canvas { display: block; }
            .ic-border-overlay {
                position: absolute;
                inset: 0;
                border: 2px solid rgba(197, 160, 89, 0.55);
                pointer-events: none;
                box-shadow:
                    inset 0 0 0 1px rgba(0, 0, 0, 0.5),
                    inset 0 0 20px rgba(0, 0, 0, 0.2);
            }
            /* Corner guides */
            .ic-border-overlay::before,
            .ic-border-overlay::after {
                content: '';
                position: absolute;
                width: 14px;
                height: 14px;
                border-color: #C5A059;
                border-style: solid;
            }
            .ic-border-overlay::before {
                top: 6px; left: 6px;
                border-width: 2px 0 0 2px;
            }
            .ic-border-overlay::after {
                bottom: 6px; right: 6px;
                border-width: 0 2px 2px 0;
            }
            .ic-controls {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .ic-btn {
                background: #141414;
                border: 1px solid #2a2a2a;
                color: #C5A059;
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: border-color 0.2s, background 0.2s;
                flex-shrink: 0;
            }
            .ic-btn:hover {
                border-color: #C5A059;
                background: #1e1e1e;
            }
            .ic-zoom-label {
                font-size: 0.6rem;
                color: #555;
                min-width: 38px;
                text-align: center;
                letter-spacing: 0.04em;
            }
            .ic-footer {
                display: flex;
                gap: 10px;
                width: 100%;
                justify-content: flex-end;
                padding-top: 2px;
            }
            .ic-cancel-btn {
                background: transparent;
                border: 1px solid #2a2a2a;
                color: #666;
                padding: 8px 16px;
                font-size: 0.62rem;
                letter-spacing: 0.1em;
                cursor: pointer;
                transition: border-color 0.2s, color 0.2s;
                border-radius: 2px;
                text-transform: uppercase;
            }
            .ic-cancel-btn:hover { border-color: #555; color: #aaa; }
            .ic-confirm-btn {
                background: linear-gradient(135deg, #C5A059 0%, #8B7240 100%);
                border: none;
                color: #0a0a0a;
                padding: 8px 18px;
                font-size: 0.62rem;
                font-weight: bold;
                letter-spacing: 0.1em;
                cursor: pointer;
                transition: opacity 0.2s;
                border-radius: 2px;
                display: flex;
                align-items: center;
                gap: 6px;
                text-transform: uppercase;
            }
            .ic-confirm-btn:hover { opacity: 0.85; }
        `}</style>
    );
}

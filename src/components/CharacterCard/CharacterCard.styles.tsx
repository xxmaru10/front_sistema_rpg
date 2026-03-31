"use client";

import React from 'react';

export const CharacterCardStyles = () => (
    <style jsx global>{`
.char-artifact {
    background: #080808;
    border: 1px solid var(--border-color);
    padding: 1px;
    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
    min-width: 340px;
    min-height: 600px;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    position: relative;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    overflow: visible;
}

.operative-arcano {
    --accent-color: #C9A84C;
    --accent-glow: rgba(197, 160, 89, 0.3);
    --accent-rgb: 197, 160, 89;
}

.threat-arcano {
    --accent-color: #ff4444;
    --accent-glow: rgba(255, 68, 68, 0.3);
    --accent-rgb: 255, 68, 68;
}

.char-artifact.compact {
    min-width: 250px;
}

.tarot-inner {
    border: 1px solid rgba(var(--accent-rgb), 0.15);
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 40px;
    background: radial-gradient(circle at 50% 0%, rgba(var(--accent-rgb), 0.05) 0%, transparent 70%);
}

.compact .tarot-inner {
    padding: 20px;
    gap: 24px;
}

.char-artifact:hover {
    border-color: var(--accent-color);
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9), 0 0 30px var(--accent-glow);
}

.top-layout-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 16px;
    margin-bottom: -15px;
}

@media (max-width: 1024px) {
    .top-layout-grid {
        grid-template-columns: 1fr;
        margin-bottom: 0;
    }
    .inventory-floating {
        position: relative !important;
        top: auto !important;
        right: auto !important;
        width: 100% !important;
        margin-top: 20px;
        box-shadow: none !important;
    }
    .char-artifact {
        min-width: 100% !important;
    }
    .tarot-inner {
        padding: 24px 16px !important;
        gap: 24px !important;
    }
    .skills-grid {
        grid-template-columns: 1fr !important;
    }
}

.compact .top-layout-grid {
    display: flex;
    flex-direction: column;
}

.lower-content-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.lower-col-left {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.lower-col-right {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.compact-consequences .consequences-list {
    gap: 4px;
}

.compact-consequences .consequence-slot.small-slot {
    padding: 4px 8px;
    font-size: 0.7rem;
}

.compact-consequences .consequence-slot.small-slot .slot-label {
    font-size: 0.6rem;
}

.compact-consequences .consequence-slot.small-slot .penalty-badge {
    font-size: 1.1rem;
    font-weight: bold;
    padding: 2px 6px;
}

.compact-consequences .consequence-slot.small-slot .active-consequence,
.compact-consequences .consequence-slot.small-slot .placeholder-text {
    font-size: 0.65rem;
}

.inventory-floating {
    position: absolute;
    top: 40px;
    left: -260px;
    width: 240px;
    background: rgba(8, 8, 8, 0.98);
    border: 1px solid rgba(197, 160, 89, 0.4);
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    backdrop-filter: blur(10px);
    z-index: 100;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.inventory-floating:hover {
    border-color: rgba(197, 160, 89, 0.8);
    box-shadow: 0 15px 40px rgba(197, 160, 89, 0.15);
}

.inventory-floating.dragging {
    opacity: 0.9;
    box-shadow: 0 20px 50px rgba(0,0,0,0.9);
    pointer-events: none;
}

.inventory-floating .drag-handle {
    cursor: grab;
    user-select: none;
}

.inventory-floating .drag-handle:active {
    cursor: grabbing;
}

.inventory-floating .compact-header {
    padding: 4px 8px;
    font-size: 0.75rem;
}

.inventory-floating .compact-header .symbol {
    font-size: 0.9rem;
}

.inventory-floating .compact-list {
    gap: 3px;
}

.inventory-floating .compact-slot {
    padding: 3px 6px;
    font-size: 0.7rem;
}

.inventory-floating .compact-slot .inv-name-col {
    font-size: 0.7rem;
}

.inventory-floating .compact-slot .bonus-badge {
    font-size: 0.7rem;
    padding: 1px 4px;
}

.add-mild2-btn {
    background: rgba(197, 160, 89, 0.1);
    border: 1px solid rgba(197, 160, 89, 0.3);
    color: var(--accent-color);
    width: 22px;
    height: 22px;
    font-size: 1rem;
    cursor: pointer;
    margin-left: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.add-mild2-btn:hover {
    background: rgba(197, 160, 89, 0.25);
    border-color: var(--accent-color);
}

.inventory-slot {
    position: relative;
}

.inventory-slot.size-l {
    background: #1a4d2e !important;
    border: 1px solid #2ecc71;
    box-shadow: inset 0 0 20px rgba(46, 204, 113, 0.2);
}

.inventory-slot.size-m {
    background: #6e4200 !important;
    border: 1px solid #f39c12;
    box-shadow: inset 0 0 20px rgba(243, 156, 18, 0.2);
}

.inventory-slot.size-g {
    background: #4d1a1a !important;
    border: 1px solid #e74c3c;
    box-shadow: inset 0 0 20px rgba(231, 76, 60, 0.2);
}

.inventory-slot.size-l .inv-name-col { color: #fff; text-shadow: 0 0 10px #2ecc71; }
.inventory-slot.size-m .inv-name-col { color: #fff; text-shadow: 0 0 10px #f39c12; }
.inventory-slot.size-g .inv-name-col { color: #fff; text-shadow: 0 0 10px #e74c3c; }

.inventory-slot.size-l .inv-description-row, .inventory-slot.size-l .qty-label { color: #a9dfbf; }
.inventory-slot.size-m .inv-description-row, .inventory-slot.size-m .qty-label { color: #f9e79f; }
.inventory-slot.size-g .inv-description-row, .inventory-slot.size-g .qty-label { color: #f2d7d5; }

.inventory-slot.filled:hover {
    filter: brightness(1.3);
}

.inv-slot-number {
    width: 18px;
    height: 18px;
    background: rgba(197, 160, 89, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    color: var(--accent-color);
    flex-shrink: 0;
}

.inv-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.inv-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.inv-description-row {
    font-size: 0.6rem;
    color: rgba(197, 160, 89, 0.7);
    font-style: italic;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

.inv-quantity-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.55rem;
}

.qty-label {
    color: rgba(197, 160, 89, 0.5);
}

.qty-value {
    color: var(--accent-color);
    font-weight: bold;
}

.inventory-slot-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}

.inv-quantity-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 4px 8px;
    background: rgba(197, 160, 89, 0.1);
    border-top: 1px solid rgba(197, 160, 89, 0.15);
}

.qty-btn {
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(197, 160, 89, 0.3);
    color: var(--accent-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    transition: all 0.2s;
}

.qty-btn:hover {
    background: rgba(197, 160, 89, 0.25);
    border-color: var(--accent-color);
}

.qty-btn.qty-decrease:hover {
    background: rgba(255, 100, 100, 0.2);
    border-color: #f88;
    color: #f88;
}

.qty-btn.qty-increase:hover {
    background: rgba(100, 255, 100, 0.2);
    border-color: #8f8;
    color: #8f8;
}

.qty-display {
    font-size: 0.75rem;
    color: var(--accent-color);
    font-weight: bold;
    min-width: 40px;
    text-align: center;
}

.inv-quantity-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.6rem;
    padding: 3px 8px;
    background: rgba(197, 160, 89, 0.1);
    border-top: 1px solid rgba(197, 160, 89, 0.15);
}

.inv-size-indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: bold;
    flex-shrink: 0;
}

.inv-size-indicator.size-l {
    background: rgba(0, 180, 100, 0.3);
    color: #00b464;
    border: 1px solid #00b464;
}

.inv-size-indicator.size-m {
    background: rgba(255, 165, 0, 0.3);
    color: #ffa500;
    border: 1px solid #ffa500;
}

.inv-size-indicator.size-g {
    background: rgba(255, 68, 68, 0.3);
    color: #f44;
    border: 1px solid #f44;
}

.item-tooltip {
    display: none;
}

.slot-actions-overlay {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to left, rgba(0,0,0,0.95) 80%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    z-index: 20;
    animation: fadeIn 0.2s ease;
    border-left: 1px solid rgba(var(--accent-rgb), 0.3);
}

.slot-action-btn {
    width: 32px;
    height: 32px;
    background: rgba(0,0,0,0.9);
    border: 1px solid var(--accent-color);
    color: var(--accent-color);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    transition: all 0.2s;
}

.slot-action-btn:hover {
    background: var(--accent-color);
    color: #000;
    transform: scale(1.1);
}

.vi-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
}

.vi-modal-content {
    background: #111;
    border: 1px solid var(--accent-color);
    width: 100%;
    max-width: 1000px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 50px rgba(0,0,0,1);
}

.vi-modal-header {
    padding: 16px;
    background: rgba(var(--accent-rgb), 0.1);
    border-bottom: 1px solid var(--accent-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.vi-modal-header h3 {
    margin: 0;
    color: var(--accent-color);
    font-family: var(--font-header);
}

.vi-modal-header button {
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
}

.image-viewer-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.95);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.image-viewer-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
}

.image-viewer-content img {
    max-width: 100%;
    max-height: 90vh;
    border: 2px solid var(--accent-color);
    box-shadow: 0 0 50px rgba(var(--accent-rgb), 0.5);
}

.close-viewer-btn {
    position: absolute;
    top: -40px;
    right: -40px;
    background: none;
    border: none;
    color: #fff;
    font-size: 2rem;
    cursor: pointer;
}

.inventory-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
}

.inventory-modal {
    background: rgba(12, 12, 12, 0.98);
    border: 2px solid var(--accent-color);
    padding: 20px;
    min-width: 360px;
    max-width: 420px;
    box-shadow: 0 0 40px rgba(197, 160, 89, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5);
    animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.inv-modal-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
}

.inv-modal-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.inv-modal-field.small {
    flex: 1;
    min-width: 0;
}

.inv-modal-field label {
    font-size: 0.65rem;
    color: var(--accent-color);
    opacity: 0.8;
    letter-spacing: 0.1em;
}

.inv-modal-row {
    display: flex;
    gap: 12px;
}

.inv-modal-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(197, 160, 89, 0.3);
    color: var(--accent-color);
    padding: 8px 10px;
    font-size: 0.85rem;
    font-family: var(--font-ui);
    outline: none;
    transition: border-color 0.2s;
}

.inv-modal-input:focus {
    border-color: var(--accent-color);
}

.inv-modal-input[type="number"] {
    text-align: center;
}

.inv-modal-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(197, 160, 89, 0.3);
    color: var(--accent-color);
    padding: 8px 10px;
    font-size: 0.8rem;
    font-family: var(--font-ui);
    outline: none;
    resize: vertical;
    min-height: 60px;
    max-height: 120px;
    transition: border-color 0.2s;
}

.inv-modal-textarea:focus {
    border-color: var(--accent-color);
}

.inv-size-selector {
    display: flex;
    gap: 8px;
}

.size-btn {
    flex: 1;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(100, 100, 100, 0.3);
    color: rgba(150, 150, 150, 0.8);
    font-weight: bold;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.size-btn.size-l { border-color: rgba(0, 180, 100, 0.3); }
.size-btn.size-l:hover, .size-btn.size-l.active { background: rgba(0, 180, 100, 0.3); border-color: #00b464; color: #00b464; }
.size-btn.size-m { border-color: rgba(255, 165, 0, 0.3); }
.size-btn.size-m:hover, .size-btn.size-m.active { background: rgba(255, 165, 0, 0.3); border-color: #ffa500; color: #ffa500; }
.size-btn.size-g { border-color: rgba(255, 68, 68, 0.3); }
.size-btn.size-g:hover, .size-btn.size-g.active { background: rgba(255, 68, 68, 0.3); border-color: #f44; color: #f44; }

.consequence-modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; animation: fadeIn 0.2s ease;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.consequence-modal {
    background: linear-gradient(135deg, #0a0a0a 0%, #151515 100%);
    border: 2px solid var(--accent-color);
    padding: 32px;
    min-width: 380px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 0 60px rgba(197, 160, 89, 0.3), inset 0 0 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.25s ease;
}

@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.modal-header {
    display: flex; align-items: center; gap: 12px;
    font-family: var(--font-header); font-size: 1.1rem;
    color: var(--accent-color); letter-spacing: 0.15em;
    border-bottom: 1px solid rgba(197, 160, 89, 0.2);
    padding-bottom: 12px;
}

.modal-input {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(197, 160, 89, 0.3);
    padding: 14px 16px;
    color: var(--text-color);
    font-family: var(--font-header);
    font-size: 1rem;
    letter-spacing: 0.05em;
    outline: none;
    transition: all 0.2s;
}

.modal-input:focus { border-color: var(--accent-color); box-shadow: 0 0 15px rgba(197, 160, 89, 0.2); }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
.modal-btn { padding: 10px 20px; font-family: var(--font-header); font-size: 0.85rem; letter-spacing: 0.15em; cursor: pointer; transition: all 0.2s; border: 1px solid; }
.modal-btn.save { background: rgba(197, 160, 89, 0.15); border-color: var(--accent-color); color: var(--accent-color); }
.modal-btn.cancel { background: rgba(100, 50, 50, 0.15); border-color: rgba(200, 100, 100, 0.5); color: rgba(200, 100, 100, 0.8); }

.consequence-debuff-row { display: flex; gap: 16px; align-items: flex-end; }
.debuff-field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.debuff-field label { font-size: 0.65rem; color: var(--accent-color); opacity: 0.7; letter-spacing: 0.1em; }
.debuff-skill-select { background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(197, 160, 89, 0.3); padding: 10px 12px; color: var(--text-color); font-family: var(--font-ui); font-size: 0.9rem; outline: none; cursor: pointer; }
.debuff-skill-select option { background: #0a0a0a; color: var(--text-color); }
.debuff-field.value-field { flex: 0 0 100px; }
.debuff-value-input { display: flex; align-items: center; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 100, 100, 0.4); padding: 8px 12px; }
.debuff-minus { color: #ff6b6b; font-size: 1.2rem; font-weight: bold; margin-right: 4px; }
.debuff-number-input { background: transparent; border: none; color: #ff6b6b; font-size: 1.1rem; font-weight: bold; width: 50px; text-align: center; outline: none; }

.skill-debuff { color: #ff6b6b; font-weight: bold; margin-left: 4px; }
.consequence-debuff-badge { font-size: 0.65rem; color: #ff6b6b; background: rgba(255, 100, 100, 0.15); border: 1px solid rgba(255, 100, 100, 0.3); padding: 2px 8px; border-radius: 3px; font-weight: bold; letter-spacing: 0.05em; }

.portrait-column { position: relative; display: flex; flex-direction: column; gap: 12px; height: 100%; }
.char-name-portrait { font-family: var(--font-victorian); font-size: 1.8rem; font-weight: 600; font-style: italic; line-height: 1.2; color: var(--accent-color); text-align: center; text-shadow: 0 0 20px rgba(197, 160, 89, 0.2); margin: 0; }
.compact .char-name-portrait { font-size: 1.4rem; }

.character-portrait {
    width: 100%; flex: 1; background-color: rgba(0, 0, 0, 0.3); background-image: url('/fundo_retrato.png');
    background-size: cover; background-position: center; background-repeat: no-repeat;
    border-style: solid; border-color: rgba(197, 160, 89, 0.6); border-width: 10px 5px 10px 5px;
    box-shadow: 0 0 20px rgba(197, 160, 89, 0.4), inset 0 0 30px rgba(0, 0, 0, 0.5);
    display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; transition: all 0.3s;
}

.portrait-image { width: 100%; height: 100%; background-size: cover; background-position: center; background-repeat: no-repeat; }
.lore-accordion-box { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(197, 160, 89, 0.1); display: flex; flex-direction: column; transition: all 0.3s; }
.lore-accordion-box.expanded { background: rgba(0, 0, 0, 0.4); border-color: var(--accent-color); }

.skill-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(197, 160, 89, 0.05); border: 1px solid transparent; }
.skill-row:hover { background: rgba(197, 160, 89, 0.1); }
.skill-row.has-points { border: 1px solid rgba(197, 160, 89, 0.2); background: rgba(197, 160, 89, 0.08); }

.skill-name { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; }
.skill-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.skill-value { font-family: var(--font-header); font-size: 0.9rem; color: #fff; width: 24px; text-align: center; }

.info-tower-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
}

.aspects-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.aspect-label-vertical {
    font-family: var(--font-header);
    font-size: 0.6rem;
    color: var(--accent-color);
    opacity: 0.7;
    letter-spacing: 0.2em;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tiny-edit-btn {
    background: none;
    border: none;
    color: var(--accent-color);
    cursor: pointer;
    font-size: 0.7rem;
    opacity: 0.4;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
}

.tiny-edit-btn:hover {
    opacity: 1;
    transform: scale(1.2);
}

.lore-accordion-header { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: rgba(197, 160, 89, 0.05); }
.lore-title { font-family: var(--font-header); font-size: 1.0rem; letter-spacing: 0.2em; color: var(--accent-color); }
.lore-accordion-content { padding: 12px; border-top: 1px solid rgba(197, 160, 89, 0.1); font-family: var(--font-narrative); font-size: 0.8rem; color: #ccc; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; word-break: break-word; }

.lore-textarea-stack { width: 100%; min-height: 80px; background: rgba(0,0,0,0.5); border: 1px solid var(--accent-color); color: white; padding: 8px; font-family: inherit; font-size: 0.8rem; margin-bottom: 8px; resize: vertical; }

.lore-text-stack {
    font-family: var(--font-narrative);
    font-size: 0.9rem;
    line-height: 1.6;
    color: #ccc;
    padding: 0;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
}

.sheet-aspect-box-vertical { background: rgba(197, 160, 89, 0.05); border: 1px solid rgba(197, 160, 89, 0.2); padding: 8px 12px; display: flex; flex-direction: column; min-height: 60px; }
.sheet-aspect-box-vertical.trouble { background: rgba(255, 50, 50, 0.05); border-color: rgba(255, 50, 50, 0.3); }

.aspect-display-vertical { font-family: var(--font-header); font-size: 0.75rem; color: #ddd; text-transform: uppercase; word-break: break-word; }

.aspects-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
.compact .aspects-row { grid-template-columns: 1fr; }
.sheet-aspect-box { background: rgba(197, 160, 89, 0.05); border: 1px solid rgba(197, 160, 89, 0.2); padding: 12px; display: flex; flex-direction: column; min-height: 80px; }
.sheet-aspect-box.trouble { background: rgba(255, 50, 50, 0.05); border-color: rgba(255, 50, 50, 0.3); }
.aspect-display { font-family: var(--font-header); font-size: 0.8rem; color: #ddd; text-transform: uppercase; word-break: break-word; }

.artifact-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(197, 160, 89, 0.1); padding-bottom: 16px; }
.char-name { 
    font-family: var(--font-header); 
    font-size: 2.2rem; 
    line-height: 1.2; 
    color: var(--accent-color); 
    margin-bottom: 20px; 
    text-shadow: 0 0 20px var(--accent-glow), 0 0 10px rgba(0,0,0,0.5); 
}
.compact .char-name { font-size: 1.2rem; }

.fate-reserve { 
    text-align: right; 
    background: rgba(var(--accent-rgb), 0.1); 
    padding: 12px 20px; 
    border-left: 2px solid var(--accent-color); 
    box-shadow: inset 5px 0 15px rgba(0,0,0,0.3);
}
.reserve-value { display: flex; align-items: center; gap: 16px; font-family: var(--font-header); font-size: 1.6rem; color: var(--accent-color); }

.section-title {
    font-family: var(--font-header);
    font-size: 0.9rem;
    letter-spacing: 0.3em;
    color: var(--accent-color);
    text-align: center;
    margin: 24px 0 16px 0;
    opacity: 0.9;
    text-shadow: 0 0 10px var(--accent-glow);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.section-title::before, .section-title::after {
    content: "";
    height: 1px;
    flex: 1;
    background: linear-gradient(to right, transparent, var(--accent-color), transparent);
    opacity: 0.3;
}

/* Stress Tracks & Vitality */
.char-core-info {
    display: flex;
    flex-direction: column;
    gap: 32px;
    margin-top: 24px;
}

.header-stress-tracks {
    display: flex;
    flex-direction: column;
    gap: 22px;
}

.matrix-track-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.track-label-row {
    font-family: var(--font-header);
    font-size: 0.75rem;
    letter-spacing: 0.25em;
    color: var(--accent-color);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.9;
}

.node-array-header {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.integrity-node-header {
    width: 34px;
    height: 34px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(var(--accent-rgb), 0.3);
    position: relative;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.integrity-node-header::after {
    content: "";
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(var(--accent-rgb), 0.1);
    transition: all 0.3s;
}

.integrity-node-header:hover:not(:disabled) {
    border-color: var(--accent-color);
    background: rgba(var(--accent-rgb), 0.1);
}

.integrity-node-header:hover:not(:disabled)::after {
    border-color: rgba(var(--accent-rgb), 0.5);
    background: rgba(var(--accent-rgb), 0.05);
}

.integrity-node-header.ruptured {
    background: var(--accent-color);
    border-color: var(--accent-color);
    box-shadow: 0 0 20px var(--accent-glow);
}

.integrity-node-header.ruptured::after {
    border-color: #000;
}

.integrity-node-header.ruptured .node-index {
    color: #000;
    text-shadow: none;
}

.integrity-node-header .node-index {
    font-family: var(--font-header);
    font-size: 1.1rem;
    color: var(--accent-color);
    z-index: 2;
    font-weight: bold;
    text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.5);
}

.integrity-node-header .node-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, var(--accent-glow) 0%, transparent 80%);
    opacity: 0;
    transition: opacity 0.4s;
}

.integrity-node-header.ruptured .node-glow {
    opacity: 1;
}

.header-track-controls {
    display: flex;
    gap: 6px;
    margin-left: 12px;
}

.h-add-btn {
    width: 24px;
    height: 24px;
    background: rgba(var(--accent-rgb), 0.1);
    border: 1px solid rgba(var(--accent-rgb), 0.3);
    color: var(--accent-color);
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    border-radius: 50%;
}

.h-add-btn:hover {
    background: var(--accent-color);
    color: #000;
    transform: scale(1.1);
}

.integrity-matrix { display: flex; flex-direction: column; gap: 32px; }
.track-header { display: flex; align-items: center; gap: 12px; font-family: var(--font-header); font-size: 0.75rem; letter-spacing: 0.15em; color: var(--accent-color); margin-bottom: 16px; }

.capability-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(197, 160, 89, 0.05); }

.skill-resource-track { display: flex; align-items: center; gap: 4px; margin-left: 8px; font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; }
.res-val { font-family: monospace; color: #fff; min-width: 12px; text-align: center; }
.res-val.current { color: #4ade80; }
.res-val.max { color: #fb923c; }

.anomaly-item { font-family: var(--font-narrative); font-style: italic; font-size: 1rem; margin-bottom: 12px; padding: 16px 20px; background: rgba(197, 160, 89, 0.02); border: 1px solid rgba(197, 160, 89, 0.05); color: var(--text-primary); line-height: 1.5; }

.skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    row-gap: 8px;
}

.skill-level {
    font-family: var(--font-header);
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.3);
    min-width: 24px;
    text-align: right;
}

.skill-level.active {
    color: var(--accent-color);
    text-shadow: 0 0 5px var(--accent-glow);
}

.skill-btn {
    background: transparent;
    border: none;
    color: rgba(197, 160, 89, 0.4);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 2px;
    transition: all 0.2s;
}

.skill-btn:hover {
    color: var(--accent-color);
    transform: scale(1.2);
}

.gm-delete-control {
    position: absolute;
    top: 140px;
    right: 12px;
    z-index: 100;
}

.gm-delete-btn {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #f44;
    color: #f44;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.6;
    font-size: 1rem;
    border-radius: 4px;
    transition: all 0.2s;
}

.gm-delete-btn:hover {
    opacity: 1;
    background: rgba(100, 0, 0, 0.2);
}
    `}</style>
);

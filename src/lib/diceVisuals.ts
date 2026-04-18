/**
 * FunÃƒÂ§ÃƒÂµes de desenho de Canvas para os dados Fate.
 * ExtraÃƒÂ­do de FateDice3D para permitir reuso e organizaÃƒÂ§ÃƒÂ£o.
 */

/** Garante cor vibrante para neon Ã¢â‚¬â€ evita vermelhos muito escuros */
export function getVibrantDanger(hex: string): string {
    if (!hex || hex.length < 7 || hex[0] !== '#') return '#ff2255';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return Math.max(r, g, b) >= 120 ? hex : '#ff2255';
}

/** Converte hex para rgba com opacidade customizada */
export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
}

/** Desenha retÃƒÂ¢ngulo arredondado */
export function drawRRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/** Fundo temÃƒÂ¡tico para a face do dado */
export function drawThemeFaceBackground(ctx: CanvasRenderingContext2D, S: number, bgHex: string, themeName: string) {
    if (themeName === 'medieval') {
        ctx.fillStyle = '#3a1c07';
        ctx.fillRect(0, 0, S, S);
        ctx.save();
        for (let y = 0; y < S + 20; y += 8) {
            ctx.beginPath();
            for (let x = 0; x <= S; x += 24) {
                const wy = y + Math.sin(x * 0.018 + y * 0.007) * 12;
                x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
            }
            const a = 0.04 + (y % 4) * 0.014;
            ctx.strokeStyle = `rgba(190,115,38,${a})`;
            ctx.lineWidth = 1 + (y % 3) * 0.4;
            ctx.stroke();
        }
        const vigM = ctx.createRadialGradient(S/2, S/2, S*0.28, S/2, S/2, S*0.75);
        vigM.addColorStop(0, 'rgba(0,0,0,0)');
        vigM.addColorStop(1, 'rgba(0,0,0,0.56)');
        ctx.fillStyle = vigM;
        ctx.fillRect(0, 0, S, S);
        ctx.restore();

    } else if (themeName === 'cyberpunk') {
        ctx.fillStyle = '#09091a';
        ctx.fillRect(0, 0, S, S);
        ctx.save();
        for (let y = 0; y < S; y += 3) {
            const a = 0.015 + (y % 7 === 0 ? 0.06 : 0) + Math.random() * 0.018;
            ctx.fillStyle = `rgba(55,100,200,${a})`;
            ctx.fillRect(0, y, S, 1);
        }
        ctx.strokeStyle = 'rgba(0,220,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= S; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
        for (let y = 0; y <= S; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
        ctx.restore();

    } else if (themeName === 'pirata') {
        ctx.fillStyle = '#d8c9a3';
        ctx.fillRect(0, 0, S, S);
        ctx.save();
        ctx.strokeStyle = 'rgba(95,72,40,0.28)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            let bx = 80 + Math.random() * (S - 160);
            let by = 80 + Math.random() * (S - 160);
            ctx.moveTo(bx, by);
            for (let j = 0; j < 4; j++) { bx += (Math.random()-0.5)*88; by += (Math.random()-0.5)*88; ctx.lineTo(bx, by); }
            ctx.stroke();
        }
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = `rgba(115,88,48,${0.02 + Math.random() * 0.05})`;
            ctx.beginPath(); ctx.arc(Math.random()*S, Math.random()*S, 8+Math.random()*18, 0, Math.PI*2); ctx.fill();
        }
        const vigP = ctx.createRadialGradient(S/2, S/2, S*0.25, S/2, S/2, S*0.72);
        vigP.addColorStop(0, 'rgba(0,0,0,0)');
        vigP.addColorStop(1, 'rgba(75,40,8,0.44)');
        ctx.fillStyle = vigP; ctx.fillRect(0, 0, S, S);
        ctx.restore();

    } else if (themeName === 'gotico') {
        ctx.fillStyle = '#060608';
        ctx.fillRect(0, 0, S, S);
        ctx.save();
        ctx.strokeStyle = 'rgba(52,46,72,0.34)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
            ctx.beginPath();
            let gx = Math.random() * S; let gy = Math.random() * S;
            ctx.moveTo(gx, gy);
            for (let j = 0; j < 5; j++) { gx += (Math.random()-0.5)*108; gy += (Math.random()-0.5)*108; ctx.lineTo(gx, gy); }
            ctx.stroke();
        }
        ctx.restore();

    } else if (themeName === 'espacial') {
        ctx.fillStyle = '#080c16';
        ctx.fillRect(0, 0, S, S);
        const sheen = ctx.createRadialGradient(S*0.35, S*0.3, 0, S/2, S/2, S*0.65);
        sheen.addColorStop(0, 'rgba(150,185,235,0.10)');
        sheen.addColorStop(0.5, 'rgba(88,120,175,0.04)');
        sheen.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sheen; ctx.fillRect(0, 0, S, S);
        ctx.save();
        for (let y = 0; y < S; y += 4) {
            ctx.fillStyle = `rgba(135,165,210,${0.012 + Math.random() * 0.02})`;
            ctx.fillRect(0, y, S, 1.5);
        }
        ctx.restore();

    } else if (themeName === 'comic') {
        ctx.fillStyle = '#f5f0dc';
        ctx.fillRect(0, 0, S, S);
        ctx.save();
        for (let cx = 0; cx < S + 16; cx += 16) {
            for (let cy = 0; cy < S + 16; cy += 16) {
                ctx.fillStyle = 'rgba(0,0,0,0.055)';
                ctx.beginPath();
                ctx.arc(cx + (Math.floor(cy/16) % 2 === 0 ? 0 : 8), cy, 4.5, 0, Math.PI*2);
                ctx.fill();
            }
        }
        ctx.restore();

    } else {
        const bg = ctx.createRadialGradient(S*0.4, S*0.35, S*0.05, S/2, S/2, S*0.72);
        bg.addColorStop(0, bgHex);
        bg.addColorStop(0.65, bgHex);
        bg.addColorStop(1, '#010101');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, S, S);
    }
}

/** Borda temÃƒÂ¡tica para a face do dado */
export function drawThemeFaceBorder(ctx: CanvasRenderingContext2D, S: number, accentHex: string, themeName: string) {
    if (themeName === 'comic') {
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 22;
        ctx.lineJoin = 'round';
        drawRRect(ctx, 11, 11, S - 22, S - 22, 26);
        ctx.stroke();
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 5;
        drawRRect(ctx, 26, 26, S - 52, S - 52, 14);
        ctx.stroke();
    } else if (themeName === 'medieval') {
        ctx.save();
        ctx.shadowColor = accentHex;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 7;
        drawRRect(ctx, 5, 5, S - 10, S - 10, 36);
        ctx.stroke();
        ctx.fillStyle = accentHex;
        const dm: [number, number][] = [[28, 28], [S-28, 28], [28, S-28], [S-28, S-28]];
        for (const [dx, dy] of dm) {
            ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.PI/4);
            ctx.fillRect(-6, -6, 12, 12);
            ctx.restore();
        }
        ctx.restore();
    } else {
        ctx.save();
        ctx.shadowColor = accentHex;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = accentHex;
        ctx.lineWidth = 8;
        drawRRect(ctx, 5, 5, S - 10, S - 10, 44);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = accentHex + '40';
        ctx.lineWidth = 2.5;
        drawRRect(ctx, 18, 18, S - 36, S - 36, 32);
        ctx.stroke();
        const c: [number, number][] = [[32, 32], [S-32, 32], [32, S-32], [S-32, S-32]];
        ctx.save();
        ctx.shadowColor = accentHex;
        ctx.shadowBlur = 10;
        ctx.fillStyle = accentHex;
        for (const [cx, cy] of c) { ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
}

/** Preenche a forma geomÃƒÂ©trica do sÃƒÂ­mbolo (neon tube shape) */
export function fillSymbolShape(ctx: CanvasRenderingContext2D, S: number, symbol: string) {
    const cx = S / 2, cy = S / 2;
    if (symbol === '+') {
        drawRRect(ctx, cx - 17, cy - 102, 34, 204, 14); ctx.fill();
        drawRRect(ctx, cx - 102, cy - 17, 204, 34, 14); ctx.fill();
    } else if (symbol === 'Ã¢Ë†â€™') {
        drawRRect(ctx, cx - 105, cy - 16, 210, 32, 14); ctx.fill();
    } else if (symbol === 'Ã¢â€”Â') {
        ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
    } else if (/^\d+$/.test(symbol)) {
        // Canvas 2D nÃ£o resolve CSS var() em font-family com consistÃªncia.
        // Stack direta para garantir renderizaÃ§Ã£o dos numerais.
        ctx.font = `800 ${S * 0.34}px "Cinzel", "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbol, cx, cy + S * 0.035);
    } else if (symbol.startsWith("pip:")) {
        const count = parseInt(symbol.split(":")[1]);
        const d = S * 0.22;
        const r = S * 0.045;
        const pips: Record<number, [number, number][]> = {
            1: [[cx, cy]],
            2: [[cx-d, cy-d], [cx+d, cy+d]],
            3: [[cx-d, cy-d], [cx, cy], [cx+d, cy+d]],
            4: [[cx-d, cy-d], [cx+d, cy-d], [cx-d, cy+d], [cx+d, cy+d]],
            5: [[cx-d, cy-d], [cx+d, cy-d], [cx, cy], [cx-d, cy+d], [cx+d, cy+d]],
            6: [[cx-d, cy-d], [cx+d, cy-d], [cx-d, cy], [cx+d, cy], [cx-d, cy+d], [cx+d, cy+d]],
        };
        (pips[count] || []).forEach(([px, py]) => {
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        });
    }
}

/** Desenha o sÃƒÂ­mbolo neon lÃƒÂ¢mpada */
export function drawNeonLampSymbol(ctx: CanvasRenderingContext2D, S: number, symbol: string, colorHex: string, themeName: string) {
    const isComic = themeName === 'comic';
    if (isComic) {
        const cx = S/2, cy = S/2;
        function comicStroke(lw: number, color: string) {
            ctx.save();
            ctx.strokeStyle = color; ctx.lineWidth = lw;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            if (symbol === '+') {
                ctx.beginPath(); ctx.moveTo(cx, cy-100); ctx.lineTo(cx, cy+100); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx-100, cy); ctx.lineTo(cx+100, cy); ctx.stroke();
            } else if (symbol === 'Ã¢Ë†â€™') {
                ctx.beginPath(); ctx.moveTo(cx-100, cy); ctx.lineTo(cx+100, cy); ctx.stroke();
            } else if (symbol === 'Ã¢â€”Â') {
                ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI*2); ctx.stroke();
            } else {
                 fillSymbolShape(ctx, S, symbol);
                 ctx.stroke();
            }
            ctx.restore();
        }
        comicStroke(28, '#111111');
        comicStroke(12, colorHex);
        comicStroke(4,  '#ffffff');
        return;
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Canvas offscreen para acÃƒÂºmulo aditivo Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const gc = document.createElement('canvas');
    gc.width = S; gc.height = S;
    const g = gc.getContext('2d')!;

    // Blending aditivo: cada camada soma os valores de cor Ã¢â‚¬â€ o centro fica branco
    g.globalCompositeOperation = 'lighter';

    // 10 camadas Ã¢â‚¬â€ halo largo atÃƒÂ© o core incandescente
    const layers: [number, number][] = [
        [210, 0.07], [154, 0.13], [112, 0.21], [77,  0.31], [50,  0.42],
        [31,  0.53], [17,  0.62], [8,   0.67], [3,   0.70], [1,   0.70],
    ];
    for (const [blur, alpha] of layers) {
        g.save();
        g.shadowColor = colorHex;
        g.shadowBlur  = blur;
        g.fillStyle   = hexToRgba(colorHex, alpha);
        fillSymbolShape(g, S, symbol);
        g.restore();
    }

    // NÃƒÂºcleo branco quente Ã¢â‚¬â€ duas passagens
    g.globalCompositeOperation = 'source-over';
    g.save();
    g.shadowColor = '#ffffff';
    g.shadowBlur  = 17;
    g.globalAlpha = 0.70;
    g.fillStyle   = '#ffffff';
    fillSymbolShape(g, S, symbol);
    g.restore();
    g.save();
    g.globalAlpha = 0.49;
    g.shadowColor = colorHex;
    g.shadowBlur  = 28;
    g.fillStyle   = '#ffffff';
    fillSymbolShape(g, S, symbol);
    g.restore();

    // CompÃƒÂµe o glow sobre o canvas principal
    ctx.drawImage(gc, 0, 0);

    // Passe extra no canvas principal
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur  = 63;
    ctx.fillStyle   = hexToRgba(colorHex, 0.32);
    fillSymbolShape(ctx, S, symbol);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
}

/** Cria textura canvas para uma face do dado */
export function createFaceTexture(THREE: any, symbol: string, accentHex: string, bgHex: string, themeName: string): any {
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    drawThemeFaceBackground(ctx, S, bgHex, themeName);
    drawThemeFaceBorder(ctx, S, accentHex, themeName);

    drawNeonLampSymbol(ctx, S, symbol, accentHex, themeName);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
}

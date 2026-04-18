/**
 * Hook customizado para gerenciar a simulação 3D dos dados Fate.
 * Encapsula Three.js, física e interações.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { 
    PhysicsDie, 
    TrapWalls, 
    computeTrapWalls, 
    physicsStep, 
    isSettled, 
    resolveCollisions, 
    cursorToWorld, 
    readFaceUpWithIndex,
    fetchRandomOrg,
    FLOOR_Y,
    DIE_HALF,
    THROW_TIMEOUT,
    SETTLE_FRAMES
} from "../lib/dicePhysics";
import { 
    createFaceTexture, 
    getVibrantDanger 
} from "../lib/diceVisuals";
import { DiceBreakdownEntry, DicePoolEntry, DieType } from "@/types/domain";

const DICE_ORDER: DieType[] = ["dF", "d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const IDLE_Y = FLOOR_Y + 1.45;
const DIE_VISUAL_SCALE = 0.7;
const POOL_CENTER_Z = -0.35;

interface RuntimeDie extends PhysicsDie {
    sourceType: DieType;
    d100GroupIndex?: number;
    d100Part?: "tens" | "units";
}

function sortBreakdown(entries: DiceBreakdownEntry[]): DiceBreakdownEntry[] {
    return entries
        .filter((entry) => entry.values.length > 0)
        .sort((a, b) => DICE_ORDER.indexOf(a.type) - DICE_ORDER.indexOf(b.type));
}

interface SceneState {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dice: RuntimeDie[];
    dieLights: THREE.PointLight[];
    animFrameId: number;
    phase: "idle" | "held" | "thrown" | "snapping" | "done";
    settledFrames: number;
    throwTime: number;
    containerW: number;
    containerH: number;
    trapWalls: TrapWalls;
}

interface UseFateDiceSimulationProps {
    isVisible: boolean;
    initialPool?: DicePoolEntry[];
    accentColor: string;
    onSettled: (results: number[], breakdown: DiceBreakdownEntry[]) => void;
    onPreResult?: (results: number[]) => void;
}

export function useFateDiceSimulation({
    isVisible,
    initialPool,
    accentColor,
    onSettled,
    onPreResult,
}: UseFateDiceSimulationProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneState | null>(null);
    const [dicePool, setDicePool] = useState<DicePoolEntry[]>(initialPool || [{ type: "dF", count: 4 }]);
    const onSettledRef = useRef(onSettled);
    const onPreResultRef = useRef(onPreResult);
    
    // Atualiza refs para evitar stale closures no loop de animação
    onSettledRef.current = onSettled;
    onPreResultRef.current = onPreResult;

    const mouseRef = useRef({ x: 0, y: 0 });
    const mousePrevRef = useRef({ x: 0, y: 0 });
    const mouseVelRef = useRef({ x: 0, y: 0 });
    const isHeldRef = useRef(false);
    const randBufRef = useRef<number[]>([]);

    const [uiPhase, setUiPhase] = useState<"idle" | "held" | "thrown" | "snapping" | "done">("idle");
    const [uiResults, setUiResults] = useState<number[] | null>(null);
    const [uiBreakdown, setUiBreakdown] = useState<DiceBreakdownEntry[] | null>(null);
    const [resolvedAccent, setResolvedAccent] = useState(accentColor);
    const [resolvedDanger, setResolvedDanger] = useState("#ff2255");

    useEffect(() => {
        if (!isVisible || !mountRef.current) return;

        let alive = true;
        let cleanup: (() => void) | null = null;

        setUiPhase("idle");
        setUiResults(null);
        setUiBreakdown(null);
        isHeldRef.current = false;

        // Pré-busca números aleatórios
        fetchRandomOrg(80).then(nums => { if (alive) randBufRef.current = nums; });

        import("three").then((THREE) => {
            if (!alive || !mountRef.current) return;

            function consumeRand(): number {
                if (randBufRef.current.length > 0) return randBufRef.current.shift()!;
                return Math.random();
            }

            // ── Ler variáveis CSS ─────────────────────────────────────────────
            const root = document.documentElement;
            const cssProp = (name: string, fallback: string) =>
                getComputedStyle(root).getPropertyValue(name).trim() || fallback;
            
            const themeAccent = cssProp('--accent-color', accentColor);
            const themeDanger = cssProp('--danger-color', '#ff0040');
            const themeBg = cssProp('--bg-color', '#080808');
            const themeName = cssProp('--theme-name', 'default');
            const vDanger = getVibrantDanger(themeDanger);
            
            setResolvedAccent(themeAccent);
            setResolvedDanger(vDanger);

            const container = mountRef.current;
            const W = container.clientWidth;
            const H = container.clientHeight;

            // ── Renderer ──────────────────────────────────────────────────────
            let renderer: THREE.WebGLRenderer;
            try {
                renderer = new THREE.WebGLRenderer({ 
                    antialias: false, // Otimizado para low-end (removido MSAA) 
                    alpha: true,
                    powerPreference: "low-power" // Sugere que use menos GPU se possível
                });
                
                // Tratar perda de contexto WebGL
                renderer.domElement.addEventListener("webglcontextlost", (event: Event) => {
                    event.preventDefault();
                    console.warn("WebGL Context Lost! Fallback para rolagem instantânea.");
                    bailOutAndRollInstantly();
                }, false);

            } catch (e) {
                console.warn("Falha crítica ao iniciar WebGL. Usando fallback 2D.", e);
                bailOutAndRollInstantly();
                return;
            }
            function bailOutAndRollInstantly() {
                const results: number[] = [];
                const breakdown: DiceBreakdownEntry[] = [];
                dicePool.forEach(p => {
                    const values: number[] = [];
                    for (let i = 0; i < p.count; i++) {
                        let v = 0;
                        if (p.type === "dF") {
                            v = Math.floor(Math.random() * 3) - 1;
                        } else if (p.type === "d100") {
                            const tens = Math.floor(Math.random() * 10);
                            const units = Math.floor(Math.random() * 10);
                            v = tens === 0 && units === 0 ? 100 : tens * 10 + units;
                        } else {
                            const sides = parseInt(p.type.substring(1), 10) || 6;
                            v = Math.floor(Math.random() * sides) + 1;
                        }
                        results.push(v);
                        values.push(v);
                    }
                    breakdown.push({ type: p.type, values });
                });

                if (results.length === 0) { // Fallback 4dF
                    const values: number[] = [];
                    for (let i = 0; i < 4; i++) {
                        const v = Math.floor(Math.random() * 3) - 1;
                        results.push(v);
                        values.push(v);
                    }
                    breakdown.push({ type: "dF", values });
                }

                const sortedBreakdown = sortBreakdown(breakdown);
                setUiPhase("done");
                setUiResults(results);
                setUiBreakdown(sortedBreakdown);
                onPreResultRef.current?.(results);
                onSettledRef.current(results, sortedBreakdown);
            }

            renderer.setSize(W, H);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limita a escala para evitar excesso de pixels
            renderer.shadowMap.enabled = false; // Sombras desativadas para performance no mobile
            container.appendChild(renderer.domElement);

            // ── Cena e câmera ─────────────────────────────────────────────────
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
            const cameraXOffset = -0.65; // Deslocamento para alinhar com o 'left: 52.5%'
            camera.position.set(cameraXOffset, 9, 13);
            camera.lookAt(cameraXOffset, 0, 0);

            // ── Iluminação ────────────────────────────────────────────────────
            scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dirLight = new THREE.DirectionalLight(0xffdda0, 1.0);
            dirLight.position.set(4, 14, 7);
            scene.add(dirLight);
            
            const accentNum = parseInt(themeAccent.replace('#', ''), 16) || 0xa0c0ff;
            const fillLight = new THREE.DirectionalLight(accentNum, 0.4);
            fillLight.position.set(-6, 4, -4);
            scene.add(fillLight);

            // ── Mesa ──────────────────────────────────────────────────────────
            const bgNum = parseInt(themeBg.replace('#', ''), 16) || 0x080808;
            const tableGeo = new THREE.PlaneGeometry(80, 60);
            const tableMat = new THREE.MeshStandardMaterial({
                color: bgNum,
                roughness: 0.95,
                transparent: true,
                opacity: 0, // Piso invisível para os dados flutuarem sobre a arena
            });
            const tableMesh = new THREE.Mesh(tableGeo, tableMat);
            tableMesh.rotation.x = -Math.PI / 2;
            tableMesh.position.y = FLOOR_Y;
            scene.add(tableMesh);

            // ── Texturas e Materiais ──────────────────────────────────────────
            const textureCache = new Map<string, any>();
            function getCachedTexture(symbol: string) {
                const key = `${symbol}|${themeAccent}|${themeBg}|${themeName}`;
                if (textureCache.has(key)) return textureCache.get(key);
                const tex = createFaceTexture(THREE, symbol, themeAccent, themeBg, themeName);
                textureCache.set(key, tex);
                return tex;
            }

            function makeMats(type: DieType) {
                let rough = 0.25, metal = 0.15;
                if (themeName === 'cyberpunk' || themeName === 'espacial') { rough = 0.12; metal = 0.80; }
                else if (themeName === 'medieval') { rough = 0.85; metal = 0.04; }
                else if (themeName === 'pirata')   { rough = 0.70; metal = 0.02; }
                else if (themeName === 'gotico')   { rough = 0.90; metal = 0.03; }
                else if (themeName === 'comic')    { rough = 0.85; metal = 0.00; }
                
                function m(tex: any) {
                    return new THREE.MeshStandardMaterial({
                        map: tex,
                        emissiveMap: tex,
                        emissive: new THREE.Color(1, 1, 1),
                        emissiveIntensity: 1.8,
                        roughness: rough,
                        metalness: metal,
                    });
                }

                if (type === "dF") {
                    return [
                        getCachedTexture(""), getCachedTexture(""),
                        getCachedTexture("+"), getCachedTexture("+"),
                        getCachedTexture("−"), getCachedTexture("−")
                    ].map(m);
                }
                if (type === "d6") {
                    return [
                        getCachedTexture("pip:4"), getCachedTexture("pip:3"),
                        getCachedTexture("pip:2"), getCachedTexture("pip:5"),
                        getCachedTexture("pip:6"), getCachedTexture("pip:1")
                    ].map(m);
                }
                if (type === "d4") {
                    return [
                         getCachedTexture("1"), getCachedTexture("2"),
                         getCachedTexture("3"), getCachedTexture("4")
                    ].map(m);
                }
                if (type === "d8") {
                    return Array.from({length: 8}, (_, i) => getCachedTexture((i+1).toString())).map(m);
                }
                if (type === "d10" || type === "d100") {
                    return Array.from({length: 10}, (_, i) => getCachedTexture((i+1).toString())).map(m);
                }
                if (type === "d12") {
                    return Array.from({length: 12}, (_, i) => getCachedTexture((i+1).toString())).map(m);
                }
                if (type === "d20") {
                    return Array.from({length: 20}, (_, i) => getCachedTexture((i+1).toString())).map(m);
                }
                return [getCachedTexture("?")].map(m);
            }

            function createDieGeometry(type: DieType) {
                if (type === "dF" || type === "d6") return new THREE.BoxGeometry(1, 1, 1);
                if (type === "d4") return new THREE.TetrahedronGeometry(1.0);
                if (type === "d8") return new THREE.OctahedronGeometry(1.0);
                if (type === "d12") return new THREE.DodecahedronGeometry(1.0);
                if (type === "d20") return new THREE.IcosahedronGeometry(1.0);
                if (type === "d10" || type === "d100") {
                    // d10 is a pentagonal trapezohedron. We'll use a simplified Cyrano geometry or Cylinder with 10 segments
                    const geo = new THREE.CylinderGeometry(0, 1.1, 1.2, 10);
                    return geo;
                }
                return new THREE.BoxGeometry(1, 1, 1);
            }

            // ── Dados ─────────────────────────────────────────────────────────
            const dice: RuntimeDie[] = [];
            const flatPool: Array<{
                renderType: Exclude<DieType, "d100">;
                sourceType: DieType;
                d100GroupIndex?: number;
                d100Part?: "tens" | "units";
            }> = [];
            dicePool.forEach(p => {
                if (p.type === "d100") {
                    for (let i = 0; i < p.count; i++) {
                        flatPool.push({ renderType: "d10", sourceType: "d100", d100GroupIndex: i, d100Part: "tens" });
                        flatPool.push({ renderType: "d10", sourceType: "d100", d100GroupIndex: i, d100Part: "units" });
                    }
                } else {
                    for (let i = 0; i < p.count; i++) flatPool.push({ renderType: p.type, sourceType: p.type });
                }
            });

            const N_TOTAL = flatPool.length;
            const SPACING = 1.2;
            const ROWS = N_TOTAL > 0 ? Math.ceil(Math.sqrt(N_TOTAL)) : 1;
            const COLS = N_TOTAL > 0 ? Math.ceil(N_TOTAL / ROWS) : 1;
            
            flatPool.forEach((entry, i) => {
                const geo = createDieGeometry(entry.renderType);
                const mats = makeMats(entry.renderType);
                const mesh = new THREE.Mesh(geo, mats);
                
                const r = Math.floor(i / COLS);
                const c = i % COLS;
                const px = (c - (COLS-1)/2) * SPACING;
                const pz = (r - (ROWS-1)/2) * SPACING + POOL_CENTER_Z;

                mesh.position.set(px, IDLE_Y, pz);
                mesh.scale.setScalar(DIE_VISUAL_SCALE);
                mesh.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                );
                scene.add(mesh);
                
                dice.push({
                    mesh,
                    type: entry.renderType,
                    sourceType: entry.sourceType,
                    d100GroupIndex: entry.d100GroupIndex,
                    d100Part: entry.d100Part,
                    pos: { x: px, y: IDLE_Y, z: pz },
                    vel: { x: 0, y: 0, z: 0 },
                    angVel: {
                        x: (Math.random() - 0.5) * 0.07,
                        y: (Math.random() - 0.5) * 0.07,
                        z: (Math.random() - 0.5) * 0.05,
                    },
                    onFloor: false,
                });
            });

            camera.updateMatrixWorld();

            const state: SceneState = {
                renderer, scene, camera, dice, dieLights: [],
                animFrameId: 0,
                phase: "idle",
                settledFrames: 0,
                throwTime: 0,
                containerW: W,
                containerH: H,
                trapWalls: computeTrapWalls(THREE, camera),
            };
            sceneRef.current = state;

            function startSnap() {
                if (state.phase === "snapping" || state.phase === "done") return;

                state.dice.forEach(die => {
                    die.vel.x = die.vel.y = die.vel.z = 0;
                    die.angVel.x = die.angVel.y = die.angVel.z = 0;
                    die.pos.y = FLOOR_Y + DIE_HALF;
                    die.mesh.position.y = die.pos.y;
                });

                const results: number[] = [];
                const breakdownMap: Partial<Record<DieType, number[]>> = {};
                const d100Parts = new Map<number, { tens?: number; units?: number }>();

                state.dice.forEach(die => {
                    const { value, matIndex } = readFaceUpWithIndex(die.mesh, die.type, THREE);
                    const materials = Array.isArray(die.mesh.material) ? die.mesh.material : [die.mesh.material];
                    materials.forEach((mat: THREE.MeshStandardMaterial, mi: number) => {
                        if (mi === matIndex) {
                            mat.emissive.setHex(accentNum);
                            mat.emissiveIntensity = 2.4;
                        } else {
                            mat.color.setHex(0x2a2a2a);
                            mat.emissiveIntensity = 0.08;
                        }
                    });
                    if (die.sourceType === "d100") {
                        const key = die.d100GroupIndex ?? 0;
                        const pair = d100Parts.get(key) ?? {};
                        if (die.d100Part === "tens") pair.tens = value % 10;
                        else pair.units = value % 10;
                        d100Parts.set(key, pair);
                        return;
                    }

                    results.push(value);
                    if (!breakdownMap[die.sourceType]) breakdownMap[die.sourceType] = [];
                    breakdownMap[die.sourceType]!.push(value);
                });

                if (d100Parts.size > 0) {
                    const d100Values: number[] = [];
                    const orderedPairs = Array.from(d100Parts.entries()).sort((a, b) => a[0] - b[0]);
                    orderedPairs.forEach(([, pair]) => {
                        const tens = pair.tens ?? Math.floor(Math.random() * 10);
                        const units = pair.units ?? Math.floor(Math.random() * 10);
                        const total = tens === 0 && units === 0 ? 100 : tens * 10 + units;
                        d100Values.push(total);
                        results.push(total);
                    });
                    breakdownMap.d100 = d100Values;
                }

                if (results.length === 0) {
                    const fallback = Array.from({ length: 4 }, () => Math.floor(Math.random() * 3) - 1);
                    breakdownMap.dF = fallback;
                    results.push(...fallback);
                }

                const breakdown = sortBreakdown(
                    Object.entries(breakdownMap).map(([type, values]) => ({
                        type: type as DieType,
                        values: values ?? [],
                    })),
                );

                state.phase = "done";
                setUiPhase("done");
                setUiResults(results);
                setUiBreakdown(breakdown);
                onPreResultRef.current?.(results);
                setTimeout(() => onSettledRef.current(results, breakdown), 2000);
            }

            function animate() {
                if (!alive) return;
                state.animFrameId = requestAnimationFrame(animate);

                if (state.phase === "idle") {
                    const t = Date.now() * 0.001;
                    state.dice.forEach((die, i) => {
                        die.angVel.x *= 0.995;
                        die.angVel.y *= 0.995;
                        die.angVel.z *= 0.995;
                        die.mesh.rotation.x += die.angVel.x;
                        die.mesh.rotation.y += die.angVel.y;
                        die.mesh.rotation.z += die.angVel.z;
                        die.pos.y = IDLE_Y + Math.sin(t + i * 1.3) * 0.1;
                        die.mesh.position.y = die.pos.y;
                    });

                } else if (state.phase === "held") {
                    const HELD_Y = 2.0;
                    const SPRING = 0.20;
                    const wp = cursorToWorld(THREE, mouseRef.current.x, mouseRef.current.y,
                                             state.containerW, state.containerH, camera, HELD_Y);

                    state.dice.forEach((die, i) => {
                        const tx = wp ? wp.x + (i - (state.dice.length-1)/2) * 1.2 : die.pos.x;
                        const tz = wp ? wp.z : die.pos.z;
                        die.vel.x += (tx     - die.pos.x) * SPRING;
                        die.vel.y += (HELD_Y - die.pos.y) * SPRING;
                        die.vel.z += (tz     - die.pos.z) * SPRING;
                        die.vel.x *= 0.75; die.vel.y *= 0.75; die.vel.z *= 0.75;
                        die.pos.x += die.vel.x;
                        die.pos.y += die.vel.y;
                        die.pos.z += die.vel.z;
                        die.angVel.x *= 0.97; die.angVel.y *= 0.97; die.angVel.z *= 0.97;
                        die.mesh.rotation.x += die.angVel.x;
                        die.mesh.rotation.y += die.angVel.y;
                        die.mesh.rotation.z += die.angVel.z;
                        die.mesh.position.set(die.pos.x, die.pos.y, die.pos.z);
                    });

                } else if (state.phase === "thrown") {
                    state.dice.forEach(d => physicsStep(d, state.trapWalls));
                    state.dice.forEach(d => {
                        const sp = new THREE.Vector3(d.pos.x, d.pos.y, d.pos.z).project(camera);
                        const LIM = 0.90;
                        const B = 0.65;
                        if (sp.x >  LIM && d.vel.x > 0) { d.vel.x *= -B; d.pos.x += d.vel.x; }
                        if (sp.x < -LIM && d.vel.x < 0) { d.vel.x *= -B; d.pos.x += d.vel.x; }
                        if (sp.y < -LIM && d.vel.z > 0) { d.vel.z *= -B; d.pos.z += d.vel.z; }
                        if (sp.y >  LIM && d.vel.z < 0) { d.vel.z *= -B; d.pos.z += d.vel.z; }
                        d.mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
                    });
                    resolveCollisions(state.dice);

                    const timedOut = performance.now() - state.throwTime > THROW_TIMEOUT;
                    if (timedOut || state.dice.every(isSettled)) {
                        state.settledFrames++;
                        if (state.settledFrames >= SETTLE_FRAMES || timedOut) {
                            startSnap();
                        }
                    } else {
                        state.settledFrames = 0;
                    }
                }

                // (Removido o rastreamento das point lights pois foram retiradas para performance)

                renderer.render(scene, camera);
            }

            requestAnimationFrame(animate);

            // ── Handlers ──────────────────────────────────────────────────────
            function startHold(cx: number, cy: number) {
                if (state.phase !== "idle") return;
                mouseRef.current = mousePrevRef.current = { x: cx, y: cy };
                mouseVelRef.current = { x: 0, y: 0 };
                isHeldRef.current = true;
                state.phase = "held";
                setUiPhase("held");
            }

            function onMove(cx: number, cy: number) {
                mousePrevRef.current = { ...mouseRef.current };
                mouseRef.current = { x: cx, y: cy };
                const dx = cx - mousePrevRef.current.x;
                const dy = cy - mousePrevRef.current.y;
                mouseVelRef.current.x = mouseVelRef.current.x * 0.55 + dx * 0.45;
                mouseVelRef.current.y = mouseVelRef.current.y * 0.55 + dy * 0.45;

                if (isHeldRef.current && state.phase === "held") {
                    const spd = Math.hypot(dx, dy) * 0.02;
                    state.dice.forEach(die => {
                        die.angVel.x += (Math.random() - 0.5) * spd;
                        die.angVel.y += (Math.random() - 0.5) * spd;
                        die.angVel.z += (Math.random() - 0.5) * spd * 0.7;
                    });
                }
            }

            function release() {
                if (!isHeldRef.current || state.phase !== "held") return;
                isHeldRef.current = false;

                const mvx = mouseVelRef.current.x;
                const mvy = mouseVelRef.current.y;
                const speed = Math.hypot(mvx, mvy);
                const threw = speed > 3;

                if (randBufRef.current.length < 10) {
                    fetchRandomOrg(80).then(nums => { randBufRef.current = [...randBufRef.current, ...nums]; });
                }
                state.dice.forEach(die => {
                    if (threw) {
                        const sc = Math.min(speed * 0.006, 0.15);
                        die.vel.x = mvx * sc + (consumeRand() - 0.5) * 0.05;
                        die.vel.z = mvy * sc * 0.55 + (consumeRand() - 0.5) * 0.05;
                    } else {
                        const ang = consumeRand() * Math.PI * 2;
                        die.vel.x = Math.cos(ang) * (0.06 + consumeRand() * 0.06);
                        die.vel.z = Math.sin(ang) * (0.04 + consumeRand() * 0.04);
                    }
                    die.vel.y = 0.10 + consumeRand() * 0.12;
                    const sf = 0.18 + speed * 0.003;
                    die.angVel.x += (consumeRand() - 0.5) * sf;
                    die.angVel.y += (consumeRand() - 0.5) * sf;
                    die.angVel.z += (consumeRand() - 0.5) * sf * 0.7;
                });

                state.phase = "thrown";
                state.throwTime = performance.now();
                setUiPhase("thrown");
            }

            const relPos = (e: MouseEvent | Touch) => {
                const r = container.getBoundingClientRect();
                return { x: e.clientX - r.left, y: e.clientY - r.top };
            };

            const onMouseDown = (e: MouseEvent) => { const p = relPos(e); startHold(p.x, p.y); };
            const onMouseMove = (e: MouseEvent) => { const p = relPos(e); onMove(p.x, p.y); };
            const onMouseUp = () => release();
            const onMouseLeave = () => release();
            const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const p = relPos(e.touches[0]); startHold(p.x, p.y); };
            const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const p = relPos(e.touches[0]); onMove(p.x, p.y); };
            const onTouchEnd = () => release();

            container.addEventListener("mousedown",  onMouseDown);
            container.addEventListener("mousemove",  onMouseMove);
            container.addEventListener("mouseup",    onMouseUp);
            container.addEventListener("mouseleave", onMouseLeave);
            container.addEventListener("touchstart", onTouchStart, { passive: false });
            container.addEventListener("touchmove",  onTouchMove,  { passive: false });
            container.addEventListener("touchend",   onTouchEnd);

            const onResize = () => {
                const w = container.clientWidth;
                const h = container.clientHeight;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
                state.containerW = w;
                state.containerH = h;
                camera.updateMatrixWorld();
                state.trapWalls = computeTrapWalls(THREE, camera);
            };
            window.addEventListener("resize", onResize);

            cleanup = () => {
                window.removeEventListener("resize", onResize);
                container.removeEventListener("mousedown",  onMouseDown);
                container.removeEventListener("mousemove",  onMouseMove);
                container.removeEventListener("mouseup",    onMouseUp);
                container.removeEventListener("mouseleave", onMouseLeave);
                container.removeEventListener("touchstart", onTouchStart);
                container.removeEventListener("touchmove",  onTouchMove);
                container.removeEventListener("touchend",   onTouchEnd);
                cancelAnimationFrame(state.animFrameId);
                renderer.dispose();
                if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
                sceneRef.current = null;
            };
        });

        return () => {
            alive = false;
            cleanup?.();
        };
    }, [isVisible, accentColor, dicePool]); // Re-run when dicePool changes

    const updatePool = (newPool: DicePoolEntry[]) => {
        setDicePool(newPool);
    };

    const autoRoll = () => {
        const state = sceneRef.current;
        if (!state || state.phase !== "idle") return;
        
        function consumeRand(): number {
            if (randBufRef.current.length > 0) return randBufRef.current.shift()!;
            return Math.random();
        }

        if (randBufRef.current.length < 10) {
            fetchRandomOrg(80).then(nums => { randBufRef.current = [...randBufRef.current, ...nums]; });
        }
        state.dice.forEach((die: PhysicsDie) => {
            const ang = consumeRand() * Math.PI * 2;
            const spd = 0.13 + consumeRand() * 0.10;
            die.vel.x = Math.cos(ang) * spd;
            die.vel.z = Math.sin(ang) * spd * 0.7;
            die.vel.y = 0.16 + consumeRand() * 0.14;
            die.angVel.x = (consumeRand() - 0.5) * 0.36;
            die.angVel.y = (consumeRand() - 0.5) * 0.36;
            die.angVel.z = (consumeRand() - 0.5) * 0.28;
        });
        state.phase = "thrown";
        state.throwTime = performance.now();
        setUiPhase("thrown");
    };

    return {
        mountRef,
        uiPhase,
        uiResults,
        uiBreakdown,
        autoRoll,
        resolvedAccent,
        resolvedDanger,
        dicePool,
        updatePool,
    };
}

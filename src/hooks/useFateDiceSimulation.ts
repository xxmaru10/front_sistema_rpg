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

interface SceneState {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dice: PhysicsDie[];
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
    accentColor: string;
    onSettled: (results: number[]) => void;
    onPreResult?: (results: number[]) => void;
}

export function useFateDiceSimulation({
    isVisible,
    accentColor,
    onSettled,
    onPreResult,
}: UseFateDiceSimulationProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneState | null>(null);
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
    const [resolvedAccent, setResolvedAccent] = useState(accentColor);
    const [resolvedDanger, setResolvedDanger] = useState("#ff2255");

    useEffect(() => {
        if (!isVisible || !mountRef.current) return;

        let alive = true;
        let cleanup: (() => void) | null = null;

        setUiPhase("idle");
        setUiResults(null);
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
                const fbResults = Array.from({length: 4}, () => [1, 0, -1][Math.floor(Math.random() * 3)]);
                setUiPhase("done");
                setUiResults(fbResults);
                onPreResultRef.current?.(fbResults);
                onSettledRef.current(fbResults);
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
            const texBlank = createFaceTexture(THREE, "",  themeAccent, themeBg, themeName);
            const texPlus  = createFaceTexture(THREE, "+", themeAccent, themeBg, themeName);
            const texMinus = createFaceTexture(THREE, "−", themeAccent, themeBg, themeName);

            function makeMats() {
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
                return [m(texBlank), m(texBlank), m(texPlus), m(texPlus), m(texMinus), m(texMinus)];
            }

            // ── Dados ─────────────────────────────────────────────────────────
            const N_DICE = 4;
            const SPACING = 1.5;
            const IDLE_Y = 1.0;
            const startX = -((N_DICE - 1) * SPACING) / 2;

            const dice: PhysicsDie[] = [];
            // Removemos as dieLights (PointLights) individuais por dado para aliviar severamente a GPU no mobile.
            // A iluminação fica a cargo da Ambient + 2 Directionals.

            for (let i = 0; i < N_DICE; i++) {
                const geo = new THREE.BoxGeometry(1, 1, 1);
                const mats = makeMats();
                const mesh = new THREE.Mesh(geo, mats);
                const px = startX + i * SPACING;
                mesh.position.set(px, IDLE_Y, 0);
                mesh.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                );
                scene.add(mesh);
                
                dice.push({
                    mesh,
                    pos: { x: px, y: IDLE_Y, z: 0 },
                    vel: { x: 0, y: 0, z: 0 },
                    angVel: {
                        x: (Math.random() - 0.5) * 0.07,
                        y: (Math.random() - 0.5) * 0.07,
                        z: (Math.random() - 0.5) * 0.05,
                    },
                    onFloor: false,
                });
            }

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

                const results: number[] = state.dice.map(die => {
                    const { value, matIndex } = readFaceUpWithIndex(die.mesh, THREE);
                    (die.mesh.material as THREE.MeshStandardMaterial[]).forEach((mat, mi) => {
                        if (mi === matIndex) {
                            mat.emissive.setHex(accentNum);
                            mat.emissiveIntensity = 2.4;
                        } else {
                            mat.color.setHex(0x2a2a2a);
                            mat.emissiveIntensity = 0.08;
                        }
                    });
                    return value;
                });

                state.phase = "done";
                setUiPhase("done");
                setUiResults(results);
                onPreResultRef.current?.(results);
                setTimeout(() => onSettledRef.current(results), 2000);
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
                        die.pos.y = IDLE_Y + Math.sin(t + i * 1.3) * 0.2;
                        die.mesh.position.y = die.pos.y;
                    });

                } else if (state.phase === "held") {
                    const HELD_Y = 2.6;
                    const SPRING = 0.20;
                    const wp = cursorToWorld(THREE, mouseRef.current.x, mouseRef.current.y,
                                             state.containerW, state.containerH, camera, HELD_Y);

                    state.dice.forEach((die, i) => {
                        const tx = wp ? wp.x + (i - 1.5) * 2.3 : die.pos.x;
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
    }, [isVisible, accentColor]);

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
        autoRoll,
        resolvedAccent,
        resolvedDanger,
    };
}

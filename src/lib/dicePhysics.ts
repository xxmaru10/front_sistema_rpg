/**
 * Lógica de física e colisão para os dados Fate.
 * Extraído de FateDice3D para facilitar manutenção e reuso.
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

import { DieType } from "../types/domain";

export interface PhysicsDie {
    mesh: any;
    type: DieType;
    pos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    angVel: { x: number; y: number; z: number };
    onFloor: boolean;
}

export interface TrapWalls {
    xNear: number;  // x máx no lado near (baixo da tela, z positivo)
    xFar:  number;  // x máx no lado far  (cima da tela, z negativo)
    zNear: number;  // parede z perto (positivo, borda inferior)
    zFar:  number;  // parede z longe (negativo, borda superior)
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const GRAVITY        = 0.012;
export const FLOOR_Y        = 0;
export const DIE_HALF       = 0.5;
export const WALL_X         = 7.5;
export const WALL_Z         = 5.5;
export const BOUNCE         = 0.28;
export const FLOOR_FRIC     = 0.82;
export const ANG_DAMP_FLOOR = 0.86;
export const ANG_DAMP_AIR   = 0.990;
export const SETTLE_VEL     = 0.030;
export const SETTLE_ANG     = 0.018;
export const SETTLE_FRAMES  = 35;
export const THROW_TIMEOUT  = 11000;

// ─── Funções de Cálculo ────────────────────────────────────────────────────────

/**
 * Projeta os limites da tela no plano do chão para obter as paredes de contenção.
 */
export function computeTrapWalls(THREE: any, camera: any): TrapWalls {
    const raycaster = new THREE.Raycaster();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(FLOOR_Y + DIE_HALF));
    const pt = new THREE.Vector3();

    // Borda direita no centro vertical da tela
    raycaster.setFromCamera(new THREE.Vector2(1, 0), camera);
    const hitX = !!raycaster.ray.intersectPlane(floor, pt);
    const wx = hitX ? Math.min(Math.abs(pt.x) - DIE_HALF, 10.5) : WALL_X;

    // Borda inferior no centro horizontal
    raycaster.setFromCamera(new THREE.Vector2(0, -1), camera);
    const hitZ = !!raycaster.ray.intersectPlane(floor, pt);
    const wz = hitZ ? Math.min(pt.z - DIE_HALF, 7.5) : WALL_Z;

    const wx2 = Math.max(wx, 5);
    const wz2 = Math.max(wz, 4);
    return { xNear: wx2, xFar: wx2, zNear: wz2, zFar: -wz2 };
}

/**
 * Executa um passo da simulação física para um dado.
 */
export function physicsStep(die: PhysicsDie, walls: TrapWalls): void {
    die.vel.y -= GRAVITY;

    die.pos.x += die.vel.x;
    die.pos.y += die.vel.y;
    die.pos.z += die.vel.z;

    die.onFloor = false;

    const floorRest = FLOOR_Y + DIE_HALF;
    if (die.pos.y < floorRest) {
        die.pos.y = floorRest;
        die.vel.y = Math.abs(die.vel.y) * BOUNCE;
        if (die.vel.y < 0.025) { die.vel.y = 0; die.pos.y = floorRest; }
        die.vel.x *= FLOOR_FRIC;
        die.vel.z *= FLOOR_FRIC;
        die.onFloor = true;
    }

    const zRange = walls.zNear - walls.zFar;
    const tZ = zRange > 0 ? Math.max(0, Math.min(1, (walls.zNear - die.pos.z) / zRange)) : 0.5;
    const xLim = walls.xNear + (walls.xFar - walls.xNear) * tZ;

    const WALL_BOUNCE = 0.65;
    if (die.pos.x >  xLim) { die.pos.x =  xLim; die.vel.x = -Math.abs(die.vel.x) * WALL_BOUNCE; }
    if (die.pos.x < -xLim) { die.pos.x = -xLim; die.vel.x =  Math.abs(die.vel.x) * WALL_BOUNCE; }
    if (die.pos.z >  walls.zNear) { die.pos.z =  walls.zNear; die.vel.z = -Math.abs(die.vel.z) * WALL_BOUNCE; }
    if (die.pos.z <  walls.zFar)  { die.pos.z =  walls.zFar;  die.vel.z =  Math.abs(die.vel.z) * WALL_BOUNCE; }

    const ad = die.onFloor ? ANG_DAMP_FLOOR : ANG_DAMP_AIR;
    die.angVel.x *= ad;
    die.angVel.y *= ad;
    die.angVel.z *= ad;

    die.mesh.rotation.x += die.angVel.x;
    die.mesh.rotation.y += die.angVel.y;
    die.mesh.rotation.z += die.angVel.z;
    die.mesh.position.set(die.pos.x, die.pos.y, die.pos.z);
}

/**
 * Checa se o dado parou de se mover.
 */
export function isSettled(die: PhysicsDie): boolean {
    const nearFloor = Math.abs(die.pos.y - (FLOOR_Y + DIE_HALF)) < 0.08;
    return (
        nearFloor &&
        Math.hypot(die.vel.x, die.vel.y, die.vel.z) < SETTLE_VEL &&
        Math.hypot(die.angVel.x, die.angVel.y, die.angVel.z) < SETTLE_ANG
    );
}

/**
 * Resolve colisões entre múltiplos dados.
 */
export function resolveCollisions(dice: PhysicsDie[]): void {
    const MIN_DIST = 2.3;
    for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
            const a = dice[i], b = dice[j];
            const dx = b.pos.x - a.pos.x;
            const dy = b.pos.y - a.pos.y;
            const dz = b.pos.z - a.pos.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq >= MIN_DIST * MIN_DIST || distSq < 0.0001) continue;

            const dist  = Math.sqrt(distSq);
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;
            const sep = (MIN_DIST - dist) * 0.55;

            a.pos.x -= nx * sep;  a.pos.y -= ny * sep;  a.pos.z -= nz * sep;
            b.pos.x += nx * sep;  b.pos.y += ny * sep;  b.pos.z += nz * sep;
            a.mesh.position.set(a.pos.x, a.pos.y, a.pos.z);
            b.mesh.position.set(b.pos.x, b.pos.y, b.pos.z);

            const relV = (a.vel.x - b.vel.x)*nx + (a.vel.y - b.vel.y)*ny + (a.vel.z - b.vel.z)*nz;
            if (relV > 0) {
                const impulse = relV * 0.92;
                a.vel.x -= impulse * nx;  a.vel.y -= impulse * ny;  a.vel.z -= impulse * nz;
                b.vel.x += impulse * nx;  b.vel.y += impulse * ny;  b.vel.z += impulse * nz;
                if (a.onFloor) a.vel.y += impulse * 0.4;
                if (b.onFloor) b.vel.y += impulse * 0.4;
                const spin = impulse * 0.55;
                a.angVel.x += (Math.random()-0.5)*spin;  a.angVel.z += (Math.random()-0.5)*spin;
                b.angVel.x += (Math.random()-0.5)*spin;  b.angVel.z += (Math.random()-0.5)*spin;
                a.angVel.y += (Math.random()-0.5)*spin * 0.6;
                b.angVel.y += (Math.random()-0.5)*spin * 0.6;
            }
        }
    }
}

/**
 * Converte coordenadas de mouse para posição no mundo 3D.
 */
export function cursorToWorld(
    THREE: any,
    mx: number, my: number,
    cw: number, ch: number,
    camera: any,
    atY: number
): { x: number; z: number } | null {
    const ndcX =  (mx / cw) * 2 - 1;
    const ndcY = -(my / ch) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const plane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), -atY);
    const target = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, target) ? { x: target.x, z: target.z } : null;
}

/**
 * Lê qual face do dado está voltada para cima.
 */
export function readFaceUpWithIndex(mesh: any, type: DieType, THREE: any): { value: number; matIndex: number } {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const mat     = new THREE.Matrix4().makeRotationFromEuler(mesh.rotation);

    let faces: Array<{ n: any, v: number, idx: number }>;

    if (type === "dF") {
        faces = [
            { n: new THREE.Vector3( 1, 0, 0), v:  0, idx: 0 },
            { n: new THREE.Vector3(-1, 0, 0), v:  0, idx: 1 },
            { n: new THREE.Vector3( 0, 1, 0), v:  1, idx: 2 },
            { n: new THREE.Vector3( 0,-1, 0), v:  1, idx: 3 },
            { n: new THREE.Vector3( 0, 0, 1), v: -1, idx: 4 },
            { n: new THREE.Vector3( 0, 0,-1), v: -1, idx: 5 },
        ];
    } else if (type === "d6") {
        faces = [
            { n: new THREE.Vector3( 1, 0, 0), v: 4, idx: 0 },
            { n: new THREE.Vector3(-1, 0, 0), v: 3, idx: 1 },
            { n: new THREE.Vector3( 0, 1, 0), v: 2, idx: 2 },
            { n: new THREE.Vector3( 0,-1, 0), v: 5, idx: 3 },
            { n: new THREE.Vector3( 0, 0, 1), v: 6, idx: 4 },
            { n: new THREE.Vector3( 0, 0,-1), v: 1, idx: 5 },
        ];
    } else if (type === "d4") {
        // Tetraedro: normal de cada face
        const s = 1/Math.sqrt(3);
        faces = [
            { n: new THREE.Vector3( s,  s,  s), v: 1, idx: 0 },
            { n: new THREE.Vector3( s, -s, -s), v: 2, idx: 1 },
            { n: new THREE.Vector3(-s,  s, -s), v: 3, idx: 2 },
            { n: new THREE.Vector3(-s, -s,  s), v: 4, idx: 3 },
        ];
    } else if (type === "d8") {
        const s = 1/Math.sqrt(3);
        faces = [
            { n: new THREE.Vector3( s,  s,  s), v: 1, idx: 0 },
            { n: new THREE.Vector3( s,  s, -s), v: 2, idx: 1 },
            { n: new THREE.Vector3( s, -s,  s), v: 3, idx: 2 },
            { n: new THREE.Vector3( s, -s, -s), v: 4, idx: 3 },
            { n: new THREE.Vector3(-s,  s,  s), v: 5, idx: 4 },
            { n: new THREE.Vector3(-s,  s, -s), v: 6, idx: 5 },
            { n: new THREE.Vector3(-s, -s,  s), v: 7, idx: 6 },
            { n: new THREE.Vector3(-s, -s, -s), v: 8, idx: 7 },
        ];
    } else if (type === "d12") {
        // Aproximação das normais do dodecaedro (Faces são pentágonos)
        const phi = (1 + Math.sqrt(5)) / 2;
        const invPhi = 1 / phi;
        const normals = [
            [0, invPhi, phi], [0, invPhi, -phi], [0, -invPhi, phi], [0, -invPhi, -phi],
            [invPhi, phi, 0], [invPhi, -phi, 0], [-invPhi, phi, 0], [-invPhi, -phi, 0],
            [phi, 0, invPhi], [phi, 0, -invPhi], [-phi, 0, invPhi], [-phi, 0, -invPhi],
        ];
        faces = normals.map((n, i) => ({ n: new THREE.Vector3(...n).normalize(), v: i + 1, idx: i }));
    } else if (type === "d20") {
        // Icosaedro: 20 faces triangulares
        const phi = (1 + Math.sqrt(5)) / 2;
        const vertices = [
            [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
            [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
            [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
        ];
        // Faces do icosaedro (índices de vértices)
        const faceIndices = [
            [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
            [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
            [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
            [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
        ];
        faces = faceIndices.map((fi, i) => {
            const v0 = new THREE.Vector3(...vertices[fi[0]]);
            const v1 = new THREE.Vector3(...vertices[fi[1]]);
            const v2 = new THREE.Vector3(...vertices[fi[2]]);
            const normal = new THREE.Vector3().crossVectors(
                v1.clone().sub(v0),
                v2.clone().sub(v0)
            ).normalize();
            return { n: normal, v: i + 1, idx: i };
        });
    } else if (type === "d10" || type === "d100") {
        // d10 is complex to normalize manually, but let's use a simplified approach
        // 10 faces (pentagonal trapezohedron)
        // For d10, we'll assume a standard mapping or just use 10 directions
        const angles = Array.from({length: 10}, (_, i) => (i * Math.PI * 2) / 10);
        faces = angles.map((ang, i) => {
            const y = i % 2 === 0 ? 0.5 : -0.5;
            const horizontal = 0.866;
            return {
                n: new THREE.Vector3(Math.cos(ang) * horizontal, y, Math.sin(ang) * horizontal).normalize(),
                v: i + 1,
                idx: i
            };
        });
    } else {
        // Fallback or dF
        faces = [
            { n: new THREE.Vector3( 0, 1, 0), v: 1, idx: 2 }
        ];
    }

    let best = -Infinity;
    let result = { value: 0, matIndex: 0 };
    for (const { n, v, idx } of faces) {
        const dot = n.clone().applyMatrix4(mat).dot(worldUp);
        if (dot > best) { best = dot; result = { value: v, matIndex: idx }; }
    }
    return result;
}

/**
 * Busca números aleatórios do random.org.
 */
export async function fetchRandomOrg(n: number): Promise<number[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch(
            `https://www.random.org/decimal-fractions/?num=${n}&dec=8&col=1&format=plain&rnd=new`,
            { signal: controller.signal },
        );
        clearTimeout(timer);
        if (!res.ok) throw new Error('random.org request failed');
        const text = await res.text();
        const nums = text.trim().split('\n').map(Number).filter(x => !isNaN(x) && x >= 0 && x <= 1);
        if (nums.length < Math.floor(n / 2)) throw new Error('insuficiente');
        return nums;
    } catch {
        clearTimeout(timer);
        return Array.from({ length: n }, () => Math.random());
    }
}

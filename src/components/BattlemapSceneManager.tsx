import { BattlemapScene } from "@/types/domain";

interface BattlemapSceneManagerProps {
    scenes: BattlemapScene[];
    activeSceneId?: string;
    onSelectScene: (sceneId: string) => void;
    onCreateScene: () => void;
}

export function BattlemapSceneManager({
    scenes,
    activeSceneId,
    onSelectScene,
    onCreateScene,
}: BattlemapSceneManagerProps) {
    const isMax = scenes.length >= 5;
    return (
        <div className="battlemap-scene-manager">
            <label htmlFor="battlemap-scenes">Cenas</label>
            <select
                id="battlemap-scenes"
                value={activeSceneId || ""}
                onChange={(e) => onSelectScene(e.target.value)}
            >
                {scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>{scene.name}</option>
                ))}
            </select>
            <button type="button" onClick={onCreateScene} disabled={isMax} title={isMax ? "Limite de 5 cenas" : "Adicionar cena"}>
                +
            </button>
        </div>
    );
}

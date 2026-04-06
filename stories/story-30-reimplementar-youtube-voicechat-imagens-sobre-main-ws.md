---
story: story-30
title: "Reimplementar YouTube no MusicPlayer + Imagem/Dispositivos no VoiceChatPanel (sobre main WebSocket)"
status: pronto-para-implementar
priority: alta
tags: [ui, voicechat, music, webrtc, feature]
created: 2026-04-06
---

# Story-30: Reimplementar YouTube + VoiceChat Melhorado (sobre main com WebSocket)

## Contexto

A branch `4.0_freature_youtubesound` foi descartada. O amigo fez um PR (#11) que migrou
a sinalização WebRTC de Supabase para WebSocket (socket.io). A main está atualizada com
essa arquitetura nova.

Esta story reimplementa **duas features** que existiam na branch descartada, aplicando-as
diretamente na main sem conflitos. Nenhum arquivo de sinalização (screen-share-manager,
VoiceChatManager, eventStore) é tocado.

---

## Arquivos modificados

| Arquivo | Feature | O que muda |
|---|---|---|
| `package.json` | YouTube | Adicionar `react-player` |
| `src/components/MusicPlayer.tsx` | YouTube | Suporte a URL do YouTube via ReactPlayer |
| `src/components/VoiceChatPanel.tsx` | VoiceChat | Avatar de personagem + seleção de dispositivo de áudio |

**Nenhum outro arquivo é alterado.**

---

## Feature 1 — YouTube no MusicPlayer

### Visão Geral

O Mestre (GM) pode colar uma URL do YouTube no MusicPlayer e ela toca para todos os
jogadores sincronizados, exatamente como uma faixa de áudio normal do Supabase Storage.
A URL é transmitida via Event Sourcing (mesmo mecanismo de qualquer outra faixa).

### Passo 1 — Instalar dependência

No `package.json`, dentro de `"dependencies"`, adicionar:

```json
"react-player": "^3.4.0"
```

Depois rodar `npm install`.

### Passo 2 — Imports no MusicPlayer

**Arquivo**: `src/components/MusicPlayer.tsx`

Localizar o bloco de imports atual (topo do arquivo):
```ts
import { useEffect, useRef, useState, useCallback } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
```

Substituir por:
```ts
import { useEffect, useRef, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw, Link } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
```

Dois acréscimos: `import ReactPlayer from "react-player"` e o ícone `Link` no lucide.

### Passo 3 — Helper de detecção de URL YouTube

Logo após os imports e antes da interface `MusicPlayerProps`, adicionar:

```ts
const isYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
```

### Passo 4 — Novos refs e estado dentro do componente

Dentro de `export function MusicPlayer(...)`, logo após a declaração do `audioRef`:

```ts
const audioRef = useRef<HTMLAudioElement | null>(null);
// Adicionar abaixo:
const reactPlayerRef = useRef<any>(null);
const pendingSeekRef = useRef<number | null>(null);  // seek pendente até ReactPlayer estar pronto
const isTemporaryRef = useRef(false);
const restoreUrlRef = useRef("");
const restoreLoopRef = useRef(true);
```

E junto aos outros `useState`, adicionar:
```ts
const [youtubeInputUrl, setYoutubeInputUrl] = useState("");
```

### Passo 5 — Ref espelho de `isPlaying` (evita stale closure em callbacks)

Após os `useState` existentes, adicionar:

```ts
const isPlayingRef = useRef(isPlaying);
useEffect(() => {
    isPlayingRef.current = isPlaying;
}, [isPlaying]);
```

### Passo 6 — Modificar o subscriber de eventos para tratar YouTube

Dentro do `useEffect` que processa eventos do `globalEventStore`, localizar o bloco onde
`setCurrentTrack(url)`, `setIsPlaying(playing)` e a lógica do `audioRef` são usados.

O bloco atual trata apenas `audioRef`. Ele precisa ser expandido para bifurcar entre
YouTube e áudio normal. A lógica é:

**Se `isYouTubeUrl(url)` → controlar via ReactPlayer (apenas sincronizar seek)**:
```ts
if (isYouTubeUrl(url)) {
    setCurrentTrack(url);
    setIsPlaying(playing);
    setIsLooping(loop);
    // Sincronizar seek se player estiver montado
    if (playing && event.payload.startedAt) {
        const elapsed = (Date.now() - new Date(event.payload.startedAt).getTime()) / 1000;
        if (reactPlayerRef.current) {
            const internalPlayer = reactPlayerRef.current.getInternalPlayer();
            if (internalPlayer?.seekTo) {
                internalPlayer.seekTo(elapsed, 'seconds');
            }
        } else {
            pendingSeekRef.current = elapsed;
        }
    }
    isTemporaryRef.current = !!event.payload.isTemporary;
    restoreUrlRef.current = event.payload.restoreUrl || "";
    restoreLoopRef.current = event.payload.restoreLoop ?? true;
    return;
}
```

**Se URL normal → manter lógica existente do `audioRef`** (não alterar).

Também armazenar os flags de "isTemporary" nos refs ao final do bloco de áudio normal:
```ts
isTemporaryRef.current = !!event.payload.isTemporary;
restoreUrlRef.current = event.payload.restoreUrl || "";
restoreLoopRef.current = event.payload.restoreLoop ?? true;
```

### Passo 7 — Modificar `handleTrackEnded` para unificar YouTube e áudio

Localizar a função `handleTrackEnded` (ou equivalente que trata o fim da faixa).
Ela deve usar os `refs` em vez de estado direto:

```ts
const handleTrackEnded = () => {
    if (isLooping) {
        // YouTube: loop prop cuida disso nativamente
        // Áudio normal: reset manual de segurança
        if (!isYouTubeUrl(currentTrack) && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.warn);
        }
        return;
    }
    if (isTemporaryRef.current && restoreUrlRef.current && userRole === "GM") {
        broadcastUpdate(restoreUrlRef.current, true, restoreLoopRef.current);
        isTemporaryRef.current = false;
        return;
    }
    if (userRole === "GM") {
        playNext();
    }
};
```

### Passo 8 — Callback `handleYouTubeReady`

Adicionar função que aplica seek pendente quando o ReactPlayer termina de carregar:

```ts
const handleYouTubeReady = () => {
    if (pendingSeekRef.current !== null && reactPlayerRef.current) {
        reactPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
        pendingSeekRef.current = null;
    }
};
```

### Passo 9 — Input de URL YouTube na UI

No JSX do MusicPlayer, existe uma linha de controles com `<select>` de faixa e botões.
Adicionar um bloco de input **abaixo** do select de faixa existente:

```tsx
const youtubeInputRow = (
    <div className="control-row">
        <input
            type="text"
            placeholder="URL do YouTube..."
            value={youtubeInputUrl}
            onChange={(e) => setYoutubeInputUrl(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && isYouTubeUrl(youtubeInputUrl.trim())) {
                    handleTrackChange(youtubeInputUrl.trim());
                    setYoutubeInputUrl("");
                }
            }}
            className="track-select youtube-url-input"
        />
        <button
            className="control-btn"
            onClick={() => {
                if (isYouTubeUrl(youtubeInputUrl.trim())) {
                    handleTrackChange(youtubeInputUrl.trim());
                    setYoutubeInputUrl("");
                }
            }}
            disabled={!isYouTubeUrl(youtubeInputUrl.trim())}
            title="Tocar Link do YouTube"
        >
            <Link size={12} />
        </button>
    </div>
);
```

Renderizar `{youtubeInputRow}` logo abaixo do `<select>` de faixa existente.
No modo `unifiedMode` também renderizar `{youtubeInputRow}` no mesmo ponto correspondente.

### Passo 10 — ReactPlayer no JSX (oculto — apenas áudio)

No final do JSX, após o `<audio ref={audioRef} />`, adicionar:

```tsx
{/* ReactPlayer: apenas para URLs YouTube — display:none suprime vídeo/thumbnail */}
{isYouTubeUrl(currentTrack) && (
    <div style={{ display: "none" }}>
        <ReactPlayer
            ref={reactPlayerRef}
            url={currentTrack}
            playing={isPlaying}
            loop={isLooping}
            volume={isMuted ? 0 : volume}
            muted={isMuted}
            onEnded={handleTrackEnded}
            onReady={handleYouTubeReady}
        />
    </div>
)}
```

### Passo 11 — Exibir "YouTube ▶" no indicador de faixa

Localizar onde o nome da faixa atual é exibido (geralmente um `<span>` com `currentTrack`).
Modificar para mostrar texto especial quando for YouTube:

```tsx
{isPlaying
    ? (isYouTubeUrl(currentTrack)
        ? "YouTube ▶"
        : (currentTrack.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '') || "Reproduzindo..."))
    : "Pausado"}
```

### Passo 12 — CSS do input YouTube

Nos estilos inline ou `<style jsx>` existentes no componente, adicionar:

```css
.youtube-url-input {
    background-image: none;
    padding: 6px 8px;
    flex: 1;
    min-width: 0;
}

.youtube-url-input::placeholder {
    color: rgba(197, 160, 89, 0.4);
    font-style: italic;
}
```

---

## Feature 2 — Avatar de Personagem + Seleção de Dispositivo no VoiceChatPanel

### Visão Geral

Dois grupos de melhorias no painel de voz:
1. **Avatar**: o ícone circular de cada participante exibe a foto do personagem (se houver) em vez de emoji
2. **Dispositivos de áudio**: seletores de microfone (entrada) e fone (saída) persistidos em localStorage

Ambas as funcionalidades já existem no `VoiceChatManager` — são apenas adições de UI no painel.

### O que o amigo JÁ tem na main (não reimplementar)

O `VoiceChatPanel.tsx` na main **já tem**:
- `characterId` como prop
- `state.characters` computado via `computeState`
- `getDisplayName` e `getCharacterImage` helpers (verificar se estão presentes; se não, implementar conforme Passo A)
- A estrutura base do painel com lista de peers

Leia o arquivo completo antes de começar para confirmar o que já existe.

### Passo A — Verificar/adicionar helpers `getDisplayName` e `getCharacterImage`

**Estes helpers lêem `state.characters` (do Event Sourcing) e resolvem nome e foto do personagem.**

Se já existirem, pular. Se não existirem, adicionar após a computação de `state`:

```ts
const getDisplayName = useCallback((uid: string, charId?: string) => {
    const uidLower = uid.trim().toLowerCase();
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

    // Mestre não tem personagem
    if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador') return uid;
    if (storedRole === 'GM' && uid === userId) return uid;

    const allChars = Object.values(state.characters);

    if (charId) {
        const byId = allChars.find(c => c.id === charId);
        if (byId) return byId.name;
    }

    const matchedChar = allChars.find(c => {
        const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
        const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
        const idMatch = c.id.toLowerCase() === uidLower;
        return (ownerMatch || nameMatch || idMatch);
    });

    return matchedChar ? matchedChar.name : uid;
}, [state.characters, userId]);

const getCharacterImage = useCallback((uid: string, charId?: string): string | null => {
    const uidLower = uid.trim().toLowerCase();
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

    // Mestre não tem avatar de personagem
    if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador') return null;
    if (storedRole === 'GM' && uid === userId) return null;

    const allChars = Object.values(state.characters);

    if (charId) {
        const byId = allChars.find(c => c.id === charId && c.imageUrl);
        if (byId) return byId.imageUrl;
    }

    const matchedChar = allChars.find(c => {
        const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
        const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
        const idMatch = c.id.toLowerCase() === uidLower;
        return (ownerMatch || nameMatch || idMatch) && c.imageUrl;
    });

    return matchedChar?.imageUrl || null;
}, [state.characters, userId]);
```

> `state.characters` vem do `computeState` já presente na main.
> `imageUrl` é o campo da entidade `Character` no Event Sourcing.

### Passo B — Adicionar estados de dispositivos de áudio

Junto aos outros `useState` do componente, adicionar:

```ts
const [audioInputDeviceId, setAudioInputDeviceId] = useState<string>('');
const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>('');
const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
const [devicesLoaded, setDevicesLoaded] = useState(false);
const supportsSinkId = typeof (new Audio() as any).setSinkId === 'function';
```

### Passo C — Restaurar dispositivos salvos no mount

```ts
useEffect(() => {
    const savedInput = localStorage.getItem('voice_input_device');
    const savedOutput = localStorage.getItem('voice_output_device');
    if (savedInput) setAudioInputDeviceId(savedInput);
    if (savedOutput) setAudioOutputDeviceId(savedOutput);
}, []);
```

### Passo D — Carregar lista de dispositivos quando conectado

```ts
const loadDevices = useCallback(async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputDevices(devices.filter(d => d.kind === 'audioinput' && d.deviceId));
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput' && d.deviceId));
        setDevicesLoaded(true);
    } catch (e) {
        console.warn('[VoiceChatPanel] Error enumerating devices', e);
    }
}, []);

useEffect(() => {
    if (isConnected) {
        loadDevices();
        navigator.mediaDevices.addEventListener('devicechange', loadDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    }
}, [isConnected, loadDevices]);
```

### Passo E — Handlers de troca de dispositivo

```ts
const handleInputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setAudioInputDeviceId(deviceId);
    localStorage.setItem('voice_input_device', deviceId);
    if (managerRef.current && isConnected) {
        await managerRef.current.setMicDevice(deviceId);
    }
}, [isConnected]);

const handleOutputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setAudioOutputDeviceId(deviceId);
    localStorage.setItem('voice_output_device', deviceId);
    if (managerRef.current) {
        await managerRef.current.setOutputDevice(deviceId);
    }
}, []);
```

### Passo F — Passar dispositivo salvo ao entrar no voice

Localizar onde `mgr.joinVoice(...)` é chamado (no useEffect de inicialização do manager).
Garantir que passa o dispositivo salvo:

```ts
const savedInput = localStorage.getItem('voice_input_device') || undefined;
const ok = await mgr.joinVoice(savedInput);

// Após joinVoice, restaurar output device também:
const savedOutput = localStorage.getItem('voice_output_device');
if (savedOutput) {
    mgr.setOutputDevice(savedOutput).catch(console.warn);
}
```

### Passo G — Avatar circular com foto do personagem na lista expandida

Na lista de participantes do painel expandido (`allUsers.map(user => {...})`),
localizar o bloco do ícone/avatar de cada usuário.

**Antes** (provavelmente só emoji):
```tsx
<div style={{ width: '42px', height: '42px', borderRadius: '50%', ... }}>
    {user.inVoice ? (user.muted ? '🔇' : (user.speaking ? '🔊' : '🎤')) : '👤'}
</div>
```

**Depois** (com imagem de personagem):
```tsx
const charImg = getCharacterImage(user.id, user.characterId);
const displayName = getDisplayName(user.id, user.characterId);

<div style={{
    position: 'relative',
    flexShrink: 0
}}>
    <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        border: `2px solid ${user.inVoice
            ? (user.speaking ? '#50c878' : 'rgba(80,200,120,0.3)')
            : 'rgba(255,255,255,0.08)'}`,
        boxShadow: user.speaking
            ? '0 0 10px rgba(80,200,120,0.6), 0 0 20px rgba(80,200,120,0.3)'
            : 'none',
        background: charImg
            ? 'transparent'
            : (user.inVoice
                ? (user.speaking ? 'rgba(80,200,120,0.35)' : 'rgba(80,200,120,0.08)')
                : 'rgba(255,255,255,0.04)'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
    }}>
        {charImg
            ? <img src={charImg} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (!user.inVoice ? '👤' : (user.muted ? '🔇' : (user.speaking ? '🔊' : '🎤')))
        }
    </div>
    {/* Badge de mudo sobre avatar quando há imagem */}
    {charImg && user.inVoice && user.muted && (
        <div style={{
            position: 'absolute', bottom: '-2px', right: '-2px',
            width: '16px', height: '16px',
            background: '#ff4d4d', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.55rem', border: '1px solid #111', zIndex: 2,
        }}>🔇</div>
    )}
</div>
```

Usar `displayName` no lugar de `user.id` para exibir nome do personagem:
```tsx
<span>{displayName}{user.isMe && <span style={{ color: 'var(--accent-color)', fontSize: '0.55rem', marginLeft: '4px' }}>EU</span>}</span>
```

### Passo H — Avatar com foto na visualização compacta (mini-avatares)

Na visualização compacta/collapsed do painel (onde aparecem os mini-avatares dos peers),
localizar o bloco que renderiza cada participante com inicial de letra.

**Antes**:
```tsx
<div style={{ ... }}>
    {initial}
</div>
```

**Depois**:
```tsx
const charImg = getCharacterImage(user.id, user.characterId);
const initial = getDisplayName(user.id, user.characterId).charAt(0).toUpperCase();

<div style={{
    overflow: 'hidden',
    background: charImg ? 'transparent' : /* cor existente */,
    // manter demais estilos existentes
}}>
    {charImg
        ? <img src={charImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial
    }
</div>
```

### Passo I — Seletores de dispositivo na UI do painel expandido

No painel expandido (`isOpen === true`), após o botão de conectar/desconectar,
adicionar os seletores de dispositivo quando `isConnected && devicesLoaded`:

```tsx
{isConnected && devicesLoaded && (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                MIC (ENTRADA)
            </label>
            <select
                value={audioInputDeviceId}
                onChange={handleInputDeviceChange}
                style={{
                    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                    borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                }}
            >
                <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                {inputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                        {d.label || 'Microfone'}
                    </option>
                ))}
            </select>
        </div>

        {supportsSinkId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                    FONE (SAÍDA)
                </label>
                <select
                    value={audioOutputDeviceId}
                    onChange={handleOutputDeviceChange}
                    style={{
                        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                        borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                    }}
                >
                    <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                    {outputDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                            {d.label || 'Alto-falante'}
                        </option>
                    ))}
                </select>
            </div>
        ) : (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                SAÍDA: não suportado neste browser
            </div>
        )}
    </div>
)}
```

---

## Critérios de Aceitação

### YouTube
- [ ] GM cola URL `youtube.com` ou `youtu.be` no input e pressiona Enter ou clica no botão Link
- [ ] A URL toca para todos os players sincronizados (via Event Sourcing)
- [ ] Jogadores que entram depois sincronizam o seek automaticamente
- [ ] Faixas normais do Supabase continuam funcionando sem regressão
- [ ] O indicador de faixa exibe "YouTube ▶" quando uma URL YouTube está ativa
- [ ] Não aparece thumbnail/vídeo visível na tela (ReactPlayer em `display:none`)

### VoiceChat — Avatar
- [ ] Participante com personagem cadastrado exibe foto no ícone circular
- [ ] Badge 🔇 aparece sobre a foto quando o peer está mutado
- [ ] Participante sem personagem (ex: Mestre) continua exibindo emoji
- [ ] Mini-avatares na view compacta também exibem foto quando disponível

### VoiceChat — Dispositivos
- [ ] Dropdown de mic lista todos os dispositivos de entrada disponíveis
- [ ] Dropdown de fone lista todos os dispositivos de saída (quando browser suporta setSinkId)
- [ ] Seleção persiste após reload (via localStorage)
- [ ] Trocar mic enquanto conectado muda o stream ao vivo sem desconectar
- [ ] Em browsers que não suportam setSinkId (Firefox), exibe mensagem "não suportado"

---

## O que NÃO alterar

- `src/lib/VoiceChatManager.ts` — não tocar
- `src/lib/screen-share-manager.ts` — não tocar
- `src/lib/eventStore.ts` — não tocar
- `src/lib/socketClient.ts` — não tocar
- Qualquer outro arquivo fora dos 3 listados em "Arquivos modificados"

---

## Bugs Detectados Pós-Implementação (2026-04-06)

> Esta seção documenta três bugs encontrados na sessão de teste com a jogadora (Margot Laveau)
> e o Mestre. Inclui diagnóstico preciso e instruções de correção para qualquer IA aplicar.

---

### Bug 1 — Sem imagem no avatar do VoiceChat (letras no lugar da foto)

#### Diagnóstico

**Arquivo afetado**: `src/components/VoiceChatPanel.tsx`

A função `getCharacterImage` existe e está corretamente implementada. O problema está na
**cadeia de lookup**: ela só retorna uma imagem se `c.imageUrl` for truthy. O fallback de
nome (`c.name.toLowerCase() === uidLower`) funciona apenas para o usuário local — para
peers remotos, o campo `user.characterId` vem do servidor via `voice-presence-update`.

**Causa raiz confirmada pelo log**:
```
[VoiceChatPanel] Mount Props Sync Check: Object
```
O log mostra o objeto mas não seus valores. O `characterId` passado como prop pode ser
`undefined` se a página da sessão não está passando a prop corretamente, ou pode ser o
nome do personagem (string) em vez do UUID do personagem.

**Duas causas possíveis — verificar qual se aplica**:

**Causa A** — `characterId` não está chegando corretamente para peers remotos:
```
allUsers = participants.map(p => ({
    characterId: isMe ? characterId : p.characterId,  // p.characterId pode ser undefined
}))
```
O `p.characterId` vem do `voice-presence-update` que o servidor emite. Se o **backend NestJS**
não está re-transmitindo o campo `characterId` no evento `voice-presence-update`, todos os
peers remotos terão `characterId = undefined`. Com `charId = undefined`, o `getCharacterImage`
cai no fallback por `ownerUserId`/`name`, que exige `c.ownerUserId === uid` — mas `uid` aqui
é o display name ("Margot Laveau") enquanto `ownerUserId` é um UUID do Supabase. Match falha.

**Causa B** — `characterId` chega corretamente, mas o personagem não tem `imageUrl`:
O personagem existe em `state.characters` com `imageUrl: ""` (valor padrão de projections.ts
linha 1069). A condição `c.id === charId && c.imageUrl` falha porque `"" === false`.

#### Como confirmar qual causa

Adicionar temporariamente no início de `getCharacterImage`:
```ts
console.log('[VoiceChat] getCharacterImage called', { uid, charId, chars: Object.values(state.characters).map(c => ({ id: c.id, name: c.name, owner: c.ownerUserId, img: !!c.imageUrl })) });
```
- Se `charId` for `undefined` para peers remotos → Causa A (backend)
- Se `charId` é um UUID mas `imageUrl` está vazio → Causa B (personagem sem imagem)

#### Correção para Causa A (backend não transmite characterId)

**Arquivo**: `back_sistema_rpg` (backend NestJS) — verificar o gateway que processa
`voice-presence` e emite `voice-presence-update`. O servidor deve incluir o campo
`characterId` ao construir a lista de participantes para broadcast.

Localizar no backend o handler do evento `voice-presence` (provavelmente em um arquivo
`session.gateway.ts` ou `voice.gateway.ts`). Garantir que o `characterId` recebido é
armazenado no objeto de participante e incluído no broadcast de `voice-presence-update`.

#### Correção para Causa A (alternativa no frontend, sem tocar backend)

Modificar o fallback em `getCharacterImage` para também cruzar pelo `c.name`:

```ts
// Em VoiceChatPanel.tsx, dentro de getCharacterImage, logo após a busca por charId
// Adicionar uma segunda tentativa: busca pelo NOME do usuário como nome do personagem
// (funciona quando uid === nome do personagem, ex: "Margot Laveau")
const matchedByName = allChars.find(c => {
    const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
    return nameMatch; // sem exigir imageUrl aqui, para saber se o personagem existe
});

if (matchedByName?.imageUrl) return matchedByName.imageUrl;
```

Essa modificação vai além do fallback atual — no fallback atual, a condição `&& c.imageUrl`
impede encontrar o personagem sem imagem. Separar em dois passos: primeiro achar o personagem,
depois checar a imagem.

#### Correção para Causa B (personagem sem imagem)

Não há bug de código — o personagem simplesmente não tem imagem cadastrada. O comportamento
correto (mostrar inicial/emoji) já ocorre. Solução: o usuário ou GM deve fazer upload da imagem
do personagem via o painel de personagem. Após o upload, o evento `CHARACTER_IMAGE_UPDATED`
será emitido e `imageUrl` será preenchido.

---

### Bug 2 — YouTube sem som (nem para o Mestre, nem para a Jogadora)

#### Diagnóstico

**Arquivo afetado**: `src/components/MusicPlayer.tsx`, linhas 169–173

**Erro exato no log do Mestre**:
```
Uncaught (in promise) TypeError: c.current.getInternalPlayer is not a function
    at layout-72f037ad6bbbbdf4.js:1:62424
```

O código implementado na linha 170 chama:
```ts
const internalPlayer = reactPlayerRef.current.getInternalPlayer();
```

Este método **não existe** neste contexto. Há duas causas:

**Causa 1 — API errada do react-player via Next.js `dynamic()`**:
O `ReactPlayer` foi carregado com:
```ts
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });
```
Quando o `dynamic()` do Next.js envolve o componente, o `ref` resultante aponta para o
componente wrapper gerado pelo `dynamic`, **não** para a instância real do ReactPlayer.
Portanto `reactPlayerRef.current.getInternalPlayer` é `undefined`.

**Causa 2 — Momento de execução (antes do `onReady`)**:
O evento `MUSIC_PLAYBACK_CHANGED` pode ser recebido **antes** do ReactPlayer terminar de
montar (antes de `onReady` disparar). Mesmo que `reactPlayerRef.current` não seja `null`,
a API interna do YouTube pode não estar disponível ainda.

**Causa 3 — API incorreta**:
`getInternalPlayer()` retorna o player nativo do YouTube (objeto do YouTube API), e o
seek via YouTube API usa `seekTo(seconds, true)` (segundo argumento booleano), não
`seekTo(seconds, 'seconds')` como no react-player. O seek via YouTube API é diferente
do seek via react-player.

#### Correção

**Arquivo**: `src/components/MusicPlayer.tsx`, bloco do subscriber de eventos
(aproximadamente linha 169–173).

**Antes (incorreto)**:
```ts
if (reactPlayerRef.current) {
    const internalPlayer = reactPlayerRef.current.getInternalPlayer();
    if (internalPlayer?.seekTo) {
        internalPlayer.seekTo(elapsed, 'seconds');
    }
} else {
    pendingSeekRef.current = elapsed;
}
```

**Depois (correto)**:
```ts
if (reactPlayerRef.current) {
    try {
        reactPlayerRef.current.seekTo(elapsed, 'seconds');
    } catch {
        pendingSeekRef.current = elapsed;
    }
} else {
    pendingSeekRef.current = elapsed;
}
```

**Explicação**: `reactPlayerRef.current.seekTo(seconds, 'seconds')` é a **API pública
e documentada** do react-player para seek. Funciona tanto com a instância real quanto
com o wrapper do `dynamic()` do Next.js, pois o react-player expõe `seekTo` no ref
diretamente (via `forwardRef`). O `try/catch` cobre o caso em que o player ainda não
está pronto — neste caso o seek é armazenado em `pendingSeekRef` e aplicado no `onReady`.

#### Problema secundário: autoplay bloqueado pelo browser

Mesmo com o seek corrigido, o YouTube pode não tocar audio para clientes que chegam na
sala sem ter interagido com a página (política de autoplay do browser). O ReactPlayer
em `display: none` não recebe interação do usuário e o browser pode bloquear o play.

**Sintoma**: O Mestre inicia a música mas o jogador não ouve nada (sem erro visível).

**Correção adicional**:
No JSX do ReactPlayer (Passo 10), substituir `display: none` por posicionamento fora
da tela — isso mantém o elemento "vivo" no DOM sem interromper o autoplay:

```tsx
{/* ReactPlayer: fora da tela para não bloquear autoplay */}
{isYouTubeUrl(currentTrack) && (
    <div style={{
        position: 'fixed',
        top: '-1px',
        left: '-1px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
    }}>
        <ReactPlayer
            ref={reactPlayerRef}
            url={currentTrack}
            playing={isPlaying}
            loop={isLooping}
            volume={isMuted ? 0 : volume}
            muted={isMuted}
            onEnded={handleTrackEnded}
            onReady={handleYouTubeReady}
            width="1px"
            height="1px"
        />
    </div>
)}
```

> `display: none` suprime visualmente mas em alguns browsers também suspende a reprodução
> de áudio. Com `position: fixed` e dimensões mínimas, o elemento fica ativo no DOM.

---

### Bug 3 — Jogadora não ouve a transmissão de tela / música parece distante

#### Diagnóstico

**Arquivos envolvidos**: `src/lib/screen-share-manager.ts` (fora do escopo original
da story-30, mas documentado aqui para a IA que for corrigir).

**Análise do log** — dois problemas distintos:

**Problema 3A — Loop de reconexão WebRTC (tela compartilhada)**

No log do Mestre:
```
[WebRTC - mestre] Sending signal: stream-started   ← 3 vezes
[WebRTC] Safety timeout: closing stuck connection for margot laveau
Error handling answer: InvalidStateError: Failed to set remote answer sdp:
    Called in wrong state: stable
```

No log da Jogadora:
```
[WebRTC - margot laveau] Signal received: stream-started from: mestre  ← 3 vezes
[WebRTC - margot laveau] Stream active, sending peer-join              ← cada vez
```

**Root cause**: O `screen-share-manager` tem um heartbeat que envia `stream-started`
periodicamente enquanto a transmissão está ativa. Cada vez que a jogadora recebe
`stream-started`, ela acredita que é uma nova transmissão, descarta a conexão existente
e envia `peer-join`. O Mestre, ao receber `peer-join`, cria uma nova conexão e manda nova
`offer`. A conexão anterior pode estar em state `stable` (já conectada), então aplicar
um `answer` nela resulta em `InvalidStateError`.

O ciclo:
```
heartbeat → stream-started → peer-join → nova offer → novo answer
    ↑                                                      |
    └──────────────── loop a cada N segundos ──────────────┘
```

**Problema 3B — Música "distante" (faixa local vs. transmissão)**

A música do MusicPlayer toca **localmente** em cada cliente via `<audio>` ou ReactPlayer.
Mas se o ReactPlayer do YouTube estiver silenciado ou bloqueado por autoplay (Bug 2), a
jogadora não ouve a música localmente. O que ela ouve é o **vazamento acústico**: o áudio
do YouTube tocando nos alto-falantes do Mestre sendo captado pelo microfone do Mestre e
transmitido via WebRTC de voz. Por isso soa "distante" — é o áudio degradado pelo mic.

A solução principal é corrigir o Bug 2 (YouTube sem som), que fará a música tocar
localmente na máquina da jogadora.

#### Correção para Problema 3A — Loop de reconexão na transmissão de tela

**Arquivo**: `src/lib/screen-share-manager.ts` — **este arquivo está fora do escopo
original da story-30 mas deve ser corrigido em nova story separada ou hotfix**.

**O que corrigir**: No receptor (viewer side), ao receber `stream-started`, verificar
se já existe uma conexão ativa com o broadcaster antes de enviar `peer-join`:

Localizar no `screen-share-manager.ts` o handler do evento `stream-started`. O código
provavelmente faz algo como:

```ts
// COMPORTAMENTO ATUAL (problemático)
socket.on('webrtc-signal', (data) => {
    if (signal.type === 'stream-started') {
        sendSignal('peer-join');  // envia sempre, sem verificar se já conectado
    }
});
```

**Correção**:
```ts
if (signal.type === 'stream-started') {
    const existingPc = peerConnections.get('broadcaster');
    // Só enviar peer-join se não há conexão ativa
    if (!existingPc || existingPc.connectionState === 'failed' || existingPc.connectionState === 'closed' || existingPc.connectionState === 'disconnected') {
        sendSignal('peer-join');
    }
    // Se já está 'connected' ou 'connecting', ignorar o stream-started
}
```

Além disso, no emissor (broadcaster side), ao receber `peer-join`, verificar se já existe
uma conexão estável com aquele peer antes de criar uma nova:

```ts
if (signal.type === 'peer-join') {
    const existingPc = peerConnections.get(signal.from);
    if (existingPc && (existingPc.connectionState === 'connected' || existingPc.connectionState === 'connecting')) {
        return; // Já conectado, ignorar
    }
    // Só criar nova conexão se não há uma ativa
    createPeerConnection(signal.from);
}
```

#### Correção para Problema 3B — Música distante

Corriger o Bug 2 (seção acima). Quando o ReactPlayer do YouTube estiver funcionando
corretamente na máquina da jogadora, a música tocará localmente e não será mais ouvida
"distante" via mic do Mestre.

---

### Sumário de Arquivos a Modificar nas Correções

| Bug | Arquivo | Linha aproximada | Mudança |
|-----|---------|-----------------|---------|
| Bug 2 — seek errado | `src/components/MusicPlayer.tsx` | ~170 | `getInternalPlayer().seekTo()` → `reactPlayerRef.current.seekTo()` |
| Bug 2 — autoplay | `src/components/MusicPlayer.tsx` | ~482–495 | `display: none` → `position: fixed; top: -1px; left: -1px` |
| Bug 3A — loop reconexão | `src/lib/screen-share-manager.ts` | handler `stream-started` | Verificar `connectionState` antes de enviar `peer-join` |
| Bug 1 — imagem | `src/components/VoiceChatPanel.tsx` | ~181 | Separar busca do personagem da verificação de imageUrl |

**Prioridade de execução**: Bug 2 primeiro (impacto maior — ninguém ouve YouTube),
depois Bug 3A (transmissão de tela instável), depois Bug 1 (avatar).

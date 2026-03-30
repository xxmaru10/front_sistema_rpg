# Plano de Implementação - Sistema de Música Sincronizada (SALVO)

Este documento contém o plano para adicionar um player de música de fundo que permite ao Mestre controlar o que todos os jogadores ouvem simultaneamente.

## Mudanças Propostas

### Núcleo de Eventos
- Adicionar o evento `MUSIC_PLAYBACK_CHANGED` ao tipo `ActionEvent` em `domain.ts`.
- O payload conterá: `url` (caminho do arquivo), `playing` (bool), `loop` (bool).

### Componentes UI
- **[NOVO] MusicPlayer.tsx**: Componente responsável pela tag `<audio>` e pelos controles (Play/Pause, Seleção de Música, Volume).
  - Jogadores: Verão apenas o ícone de volume/mudo.
  - Mestre: Terá controles completos para trocar de música e iniciar/parar a reprodução global.

### Localização
- Integrar o `MusicPlayer` no `HeaderWrapper.tsx` para persistência durante a sessão.

### Infraestrutura de Áudio
- Criar a pasta `public/audio` para armazenar os arquivos `.mp3`.

---
*Plano guardado em 07/02/2026 para implementação posterior.*

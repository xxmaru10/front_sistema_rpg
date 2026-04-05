---
story: story-07
title: Corrigir Passagem Automática de Playlist (Auto-Play)
Status: concluído
priority: média
---

# Story-07: Corrigir Passagem Automática de Playlist (Auto-Play)

## Problema
O sistema de música atual fica em silêncio após o término de uma faixa. Isso ocorre porque:
1. O elemento `<audio>` utiliza o atributo `loop` de forma global, o que faz com que a mesma música se repita infinitamente ou pare completamente, sem avançar na lista.
2. Não há um handler `onEnded` implementado para disparar logicamente a próxima música da playlist ativa.
3. A sincronização de "quem comanda o avanço" precisa ser clara (geralmente o Mestre/GM) para evitar múltiplos eventos de troca simultâneos.

## Objetivos
- [x] Implementar o evento `onEnded` no elemento `<audio>` do `MusicPlayer.tsx`.
- [x] Criar lógica de transição: se `isLooping` for falso, chamar `playNext()` automaticamente.
- [x] Garantir que apenas o usuário com `userRole === 'GM'` dispache o evento de sincronização `MUSIC_PLAYBACK_CHANGED` ao trocar de faixa automaticamente.
- [x] Validar a sincronização entre Mestre e Jogadores (o player do jogador deve seguir o avanço ditado pelo evento do mestre).
- [x] (Opcional) Diferenciar visualmente entre "Loop de Faixa" e "Auto-avançar Playlist" na UI.

## Arquivos Afetados
- `src/components/MusicPlayer.tsx`: Lógica de reprodução e eventos do elemento de áudio.

## Critérios de Aceitação
- [x] Ao terminar uma música, se o modo loop estiver desligado, a próxima música da playlist deve começar em até 2 segundos.
- [x] Todos os jogadores na sala devem ouvir a mesma música nova de forma sincronizada.
- [x] Se a música for a última da playlist, ela deve voltar para a primeira (comportamento de loop de playlist) ou parar, conforme definido na lógica de `playNext`.
- [x] O botão de Loop atual deve continuar funcionando para repetir a mesma faixa se estiver ativado.

## Histórico de Decisões
- **Avanço Gerenciado pelo GM**: Para manter a integridade da timeline de Event Sourcing, apenas o cliente do GM disparará o evento de "Próxima Música". Os players dos jogadores apenas reagem ao evento `MUSIC_PLAYBACK_CHANGED` recebido.
- **Implementação do onEnded**: Removido o atributo `loop` nativo para permitir o disparo do evento `ended`. O loop agora é controlado logicamente no handler `onEnded`.

---
story: story-05
title: Corrigir Sincronização de Voz (WebRTC) e Reinicialização Nuclear
status: em-andamento
priority: alta
---

# Story-05: Corrigir Sincronização de Voz (WebRTC) e Reinicialização Nuclear

## Problema
O sistema de voz P2P apresentava inconsistências críticas:
1.  **Sincronização de Presença:** Jogadores entravam e não apareciam para os outros, ou saíam e continuavam "fantasmas" na lista.
2.  **Qualidade e Performance:** Engasgos ("travadas") no áudio, especialmente em dispositivos móveis, devido à alta frequência de processamento de níveis de áudio.
3.  **Glare de Conexão:** Tentativas simultâneas de conexão causando estados de erro.
4.  **Necessidade de Reset:** Ausência de uma forma de reiniciar apenas o chat de voz sem recarregar toda a aplicação (F5).

## Objetivos
- [x] Implementar lógica de *Deterministic Offerer* para evitar glare.
- [x] Otimizar processamento de áudio (aumentar intervalo de polling para 300ms).
- [x] Reduzir re-renders no React através de atualizações condicionais e memoização.
- [x] Integrar Supabase Presence para limpeza automática de "zombie peers".
- [x] Implementar "Nuclear Refresh" (recriação total da instância do VoiceChatManager).
- [x] Adicionar overlay de carregamento visual durante o refresh.

## Arquivos Afetados
- `src/lib/VoiceChatManager.ts`: Lógica central de WebRTC e sinalização.
- `src/components/VoiceChatPanel.tsx`: UI, estados e botão de refresh.
- `src/app/globals.css`: Animações de spin para feedback visual.

## Critérios de Aceitação
- [x] Jogadores que saem do site desaparecem da lista de voz em até 5 segundos.
- [x] Botão de refresh re-instancia o sistema silenciosamente sem erro de "duplicate channels".
- [x] Interface exibe overlay de carregamento durante reinicialização.
- [x] Performance em dispositivos móveis deve ser estável (baixo consumo de CPU por amostragem de áudio).

## Histórico de Decisões
- **Re-instanciação Total:** Decidido usar uma `refreshKey` para forçar o React a desmontar e montar um novo `VoiceChatManager`, garantindo limpeza absoluta de memória e estado.
- **Atraso de 2s no Auto-reconnect:** Definido um delay de 2 segundos após o refresh para dar tempo ao Supabase de processar a desconexão e permitir uma nova subscrição limpa.

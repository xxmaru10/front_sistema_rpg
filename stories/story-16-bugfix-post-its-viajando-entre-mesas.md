---
title: "Story 16 - bugfix: post its estão viajando para todas as mesas"
description: "Migrar Post-its do localStorage para o EventStore para permitir acesso multi-dispositivo e isolamento total por usuário/mesa."
Status: concluído
last_updated: 2026-04-02
---

# Story 16 - Multi-Device Post-its (Sincronização de Mesa)

## Contexto
O sistema de Post-its atual é puramente local. O usuário deseja que suas notas \"viajem\" com ele para outros computadores, mas permaneçam restritas à mesa onde foram criadas e invisíveis para outros usuários (ex: Post-its do Mestre não aparecem para Jogadores). 

## Escopo
- **Migração de Persistência**: Sair do `localStorage` e usar o `globalEventStore` (Event Sourcing).
- **Visibilidade Privada**: Utilizar o padrão `{ kind: \"PLAYER_ONLY\", userId }` nos eventos para que o servidor filtre e entregue as notas apenas ao respectivo dono.
- **Identidade Própria**: Diferenciar claramente \"Post-its\" de \"Notas de Sessão\" (as últimas são um log de texto compartilhado, enquanto Post-its são lembretes flutuantes e individuais).

## Arquivos Afetados
- `src/types/domain.ts`:
    - Adicionar tipo `StickyNote`.
    - Adicionar eventos: `STICKY_NOTE_CREATED`, `STICKY_NOTE_UPDATED`, `STICKY_NOTE_DELETED`.
- `src/lib/projections.ts`: 
    - Adicionar `stickyNotes` ao `SessionState`.
    - Implementar a lógica de redução (agregação) para atualizar o estado das notas conforme os eventos chegam.
- `src/lib/floatingNotesStore.ts`: 
    - Refatorar para despachar eventos (`eventStore.append()`) em vez de salvar no disco local.
- `src/components/FloatingNotes.tsx`: 
    - Adaptar para ler do estado projetado da sessão e fornecer contexto de `userId`.

## Critérios de Aceitação
1. **Acesso Multi-dispositivo**: Um Post-it criado no PC-01 deve carregar instantaneamente no PC-02 para o mesmo usuário na mesma mesa.
2. **Isolamento de Mesa**: Post-its da \"Mesa A\" não aparecem na \"Mesa B\".
3. **Privacidade Absoluta**: Jogadores não têm acesso aos Post-its do Mestre (e vice-versa), mesmo na mesma mesa, pois a transmissão via WebSocket será filtrada pelo `userId`.
4. **Diferenciação Visual**: Post-its continuam sendo acessíveis pelo topo do site e distintos do painel de Notas do sistema.

## Plano de Ação
1. Definir os novos tipos de evento em `domain.ts`.
2. Atualizar a `initialState` e o `reduce` em `projections.ts` para gerenciar o array de `stickyNotes`.
3. Refatorar o `floatingNotesStore` para remover a dependência de `localStorage` e conectar-se ao `globalEventStore`.
4. Testar a sincronia entre dois \"logins\" simulados.

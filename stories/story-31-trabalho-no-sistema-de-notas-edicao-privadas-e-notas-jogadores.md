---
title: "Story 31 - Trabalho no Sistema de Notas: edição/apagamento de privadas e notas individuais do mestre"
description: "Corrigir o fluxo de autoria/visibilidade no sistema de notas para permitir editar/apagar notas privadas próprias e estabilizar notas individuais do mestre na aba Jogadores."
priority: "alta"
status: "concluído"
last_updated: "2026-04-08"
tags: [notas, bugfix, privacidade, gm, eventsourcing]
---

# Story 31 - Trabalho no Sistema de Notas

## Contexto
Foram reportados dois problemas no módulo de Notas:
1. Usuários não conseguem editar ou apagar corretamente as próprias notas na aba de notas privadas.
2. Na aba de notas por Jogadores, o mestre envia notas individuais e elas desaparecem, deixando o card do jogador sem conteúdo.

Leitura de contexto no código atual (sem implementação ainda) indica inconsistência entre comparações de autoria na UI e a normalização de `userId` usada nos hooks/eventos, além de necessidade de consolidar o fluxo de atualização de nota no replay de projeções.

## Escopo

### Fase 1 - Consistência de Identidade (autoria)
- Padronizar comparação de autoria (`authorId`) com `userId` normalizado (`trim().toLowerCase()`) em todas as telas de notas.
- Garantir que regras de permissão de edição/apagamento usem a mesma normalização em abas Geral, Privado e Jogadores.

### Fase 2 - Notas Privadas (editar/apagar)
- Garantir que o autor consiga editar e apagar suas próprias notas privadas.
- Preservar regra de privacidade: cada usuário só visualiza suas próprias notas privadas.
- Validar que o fluxo de atualização (`NOTE_UPDATED`) reflita no estado projetado após envio, refresh e reload.

### Fase 3 - Notas Individuais do Mestre em Jogadores
- Garantir que notas enviadas pelo mestre para um jogador permaneçam visíveis no card do jogador para o próprio mestre.
- Garantir persistência após sincronização em tempo real e após recarregar a sessão.
- Manter o comportamento privado dessas notas individuais (não expor para outros usuários).

### Fase 4 - Robustez de Sincronia e UX
- Revisar feedback de falha/pêndencia para eventos de notas afetados pelo bug (edição, exclusão, notas de jogador).
- Garantir que o estado local não “apague” visualmente a nota do autor por filtro incorreto de autoria.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/features/session-notes/components/NotesTab.tsx` | Filtros/permissões de autoria na UI (incluindo aba `Jogadores` e ações de editar/apagar). |
| `src/features/session-notes/components/LinkedNotes.tsx` | Renderização e ações de notas vinculadas por jogador (privadas e gerais). |
| `src/features/session-notes/SessionNotes.tsx` | Propagação de `userId` para subcomponentes de notas. |
| `src/features/session-notes/hooks/useSessionNotesDiary.ts` | Fluxo de envio, edição e exclusão de notas de diário (Geral/Privado). |
| `src/features/session-notes/hooks/useWorldEntities.ts` | Fluxo de criação/exclusão de notas vinculadas a personagem (`CHARACTER_NOTE_*`). |
| `src/lib/projections.ts` | Aplicação dos eventos de nota no estado projetado (incluindo atualização de conteúdo). |
| `src/lib/eventStore.ts` | Retry/estado de falha para eventos de notas no fluxo de persistência. |

## Critérios de Aceitação
1. Na aba **Notas Privadas**, cada usuário vê botões de editar/apagar apenas nas próprias notas privadas.
2. Edição de nota privada altera o conteúdo visível imediatamente e permanece correta após refresh/reentrada da sessão.
3. Exclusão de nota privada remove apenas a nota do autor correto e não afeta notas privadas de outros usuários.
4. Na aba **Jogadores** (visão do mestre), enviar nota individual para um jogador mantém a nota visível no card imediatamente após o envio.
5. As notas individuais do mestre em Jogadores continuam visíveis para o mestre após refresh/reload.
6. As notas individuais privadas por jogador não são exibidas para usuários não autorizados.
7. Em falha de persistência, a UI exibe estado de erro/retry coerente para os eventos de nota cobertos por esta Story.

## Fora de Escopo
- Mudança de layout visual ampla do sistema de notas.
- Criação de novos tipos de visibilidade além dos já existentes no contrato atual.
- Refatoração estrutural de módulos não relacionados ao domínio de Notas.

## Dependências e Riscos
- Dependência do contrato de eventos do Event Sourcing já utilizado em frontend/backend.
- Risco de regressão em permissões se a normalização de identidade não for aplicada de forma consistente em todas as comparações de autoria.

## Status de Execução
- Story implementada e validada por build (`next build`) em 2026-04-08.

---
title: "Story 36 - Permitir submenus em Notas > Jogadores e Notas Privadas com edição, formatação e correção de duplicação rara"
description: "Adicionar organização por submenus (incluindo Todas), edição/exclusão no fluxo de Jogadores, ferramentas de formatação textual e robustez contra notas duplicadas, preservando regras de privacidade."
priority: "alta"
status: "concluído"
last_updated: "2026-04-09 (implementacao-validada)"
tags: [notas, submenu, privacidade, bugfix, ui, eventsourcing]
---

# Story 36 - Permitir submenus em Notas > Jogadores e Notas Privadas com edição, formatação e correção de duplicação rara

## Contexto
Foi solicitada uma evolução no sistema de Notas para organizar melhor o conteúdo sem alterar a natureza privada já existente:
1. Em **Notas > Jogadores**, o mestre precisa navegar por submenus nomeados por jogador, com um submenu agregado **Todas** (comportamento atual consolidado).
2. Em **Notas Privadas**, mestre e jogadores precisam criar submenus por tópico (máximo de 10), com botão `+`, nome customizado, cor e reorganização por arrastar/soltar.
3. No fluxo de **Jogadores**, deve ser possível editar e excluir notas.
4. Esse fluxo deve incluir ferramentas de formatação textual (negrito, itálico e marcadores).
5. Existe um bug raro de duplicação de notas no submenu de Jogadores que precisa ser eliminado.

A implementação deve respeitar a arquitetura de Event Sourcing e manter privacidade conforme contrato atual (`visibility` com `PLAYER_ONLY` quando aplicável).

## Escopo

### Fase 1 - Navegação por submenus em Notas > Jogadores
- Introduzir submenus no contexto **Jogadores** com estrutura:
1. **Todas** (agregador padrão)
2. Um submenu por jogador (nomeado com o nome exibido do jogador/personagem)
- Garantir que o mestre possa alternar entre visão agregada e visão filtrada por jogador sem perder estado da aba pai.
- Preservar regras atuais de visibilidade/permissão já praticadas em notas por jogador.

### Fase 2 - Submenus em Notas Privadas (GM e Player)
- Implementar submenus privados nomeados com:
1. Primeiro submenu fixo: **Todas**.
2. Criação via botão `+` de até **10** submenus adicionais por usuário.
- Permitir renomear submenu e associar cor.
- Permitir arrastar notas entre submenus e reorganizar a ordem dos submenus.
- Persistir ordem, nome e cor após sincronização, refresh e reentrada.

### Fase 3 - Edição e exclusão no fluxo Jogadores
- Habilitar editar/excluir notas dentro de **Notas > Jogadores**.
- Reaplicar guardas de autoria/permissão com normalização de identidade (`trim().toLowerCase()`), conforme convenções do projeto.
- Garantir consistência visual e funcional ao editar/apagar tanto em **Todas** quanto em submenu individual de jogador.

### Fase 4 - Ferramentas de formatação textual
- Incluir no editor utilizado nesse fluxo os atalhos/ferramentas:
1. **Negrito**
2. **Itálico**
3. **Marcadores (lista)**
- Garantir persistência da formatação no conteúdo salvo e renderizado.
- Evitar regressões de sanitização/colagem já tratadas no editor.

### Fase 5 - Correção de duplicação rara de notas
- Eliminar duplicação visual/lógica de notas no contexto de Jogadores (inclusive cenários com evento otimista `seq=0`, retry e confirmação posterior).
- Tornar a projeção/listagem idempotente por identificador de nota para evitar reaplicação duplicada.
- Validar estabilidade em alternância de submenus, refresh e reconexão realtime.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/features/session-notes/components/NotesTab.tsx` | Submenus de Jogadores e Privadas, filtro por submenu, ações de editar/excluir e integração do editor com formatação. |
| `src/features/session-notes/components/LinkedNotes.tsx` | Renderização das notas por jogador/submenu e ações contextuais de edição/exclusão. |
| `src/features/session-notes/SessionNotes.tsx` | Orquestração de estado ativo dos novos submenus e passagem de handlers/props. |
| `src/features/session-notes/hooks/useSessionNotesDiary.ts` | CRUD de notas com metadados de submenu/tópico e guardas de privacidade/autoria. |
| `src/features/session-notes/hooks/useSessionNotes.ts` | Integração dos novos estados de submenu com o hook orquestrador. |
| `src/features/session-notes/SessionNotes.css` | Estilos de navegação de submenu, drag-and-drop e indicadores de cor. |
| `src/components/MentionEditor.tsx` | Ferramentas de negrito/itálico/marcadores no fluxo de notas afetado. |
| `src/lib/projections.ts` | Aplicação idempotente de eventos de nota e suporte ao agrupamento por submenu. |
| `src/lib/eventStore.ts` | Robustez de retry/confirmação para não produzir entradas duplicadas em notas. |
| `src/types/domain.ts` | Ajustes de tipagem de nota/evento para metadados de submenu (quando necessário para o novo fluxo). |
| `knowledge/shared/api-contract.md` | Atualização do contrato compartilhado caso payload de notas receba novos campos de submenu/cor/ordem. |
| `../back_sistema_rpg/src/events/events.service.ts` | (Se necessário) validação/normalização de payloads de notas com metadados de submenu para manter consistência no gateway. |

## Critérios de Aceitação
1. Em **Notas > Jogadores**, existe um submenu **Todas** e um submenu individual para cada jogador.
2. **Todas** mantém visão agregada das notas de jogadores (equivalente ao comportamento atual).
3. Ao selecionar um jogador, somente notas daquele contexto são exibidas.
4. No contexto **Jogadores**, o mestre consegue editar e excluir notas sem regressão de permissão.
5. O editor nesse fluxo oferece negrito, itálico e marcadores, e a formatação persiste após salvar e recarregar.
6. Em **Notas Privadas**, cada usuário (mestre e jogador) possui submenu fixo **Todas** e pode criar até 10 submenus adicionais via `+`.
7. Submenus privados adicionais permitem nome customizado e cor.
8. É possível reorganizar submenus e mover notas entre submenus por arrastar/soltar.
9. Ordem, nome, cor e associação de notas aos submenus permanecem corretos após refresh/reentrada.
10. A privacidade permanece intacta: notas privadas continuam visíveis apenas ao dono; notas de jogador mantêm as mesmas regras privadas já vigentes.
11. O bug raro de duplicação de notas no fluxo de Jogadores não se reproduz em cenários de retry, reconexão e troca de submenus.
12. Não há regressão das abas de notas existentes (Geral, Privado, Jogadores, Sessão).

## Fora de Escopo
- Criar novos níveis de permissão além do contrato de visibilidade atual.
- Compartilhar notas privadas entre usuários.
- Redesenho global do módulo de Notas fora dos pontos necessários para os submenus solicitados.

## Dependências e Riscos
- Risco de regressão de privacidade se filtros de autoria/visibilidade não forem normalizados de ponta a ponta.
- Risco de incompatibilidade com eventos antigos sem metadados de submenu; necessário fallback para **Todas**.
- Risco de duplicação residual se idempotência não cobrir fluxo otimista + confirmação.

## Status
- Implementação concluída.
- Build de produção validado com sucesso via `npm run build` em 2026-04-09.

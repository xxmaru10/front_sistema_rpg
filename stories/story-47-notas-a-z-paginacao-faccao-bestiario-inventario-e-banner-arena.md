---
title: "Story 47 - Notas A-Z, Paginação 10/20/50, Facção em Personagem, Bestiário com Inventário e Banner Fullscreen na Arena"
description: "Adicionar ordenação alfabética e paginação nas notas, incluir vínculo de facção em personagens no módulo de mundo, ajustar posição do botão Local/Geral e liberar inventário no bestiário, além de exibir imagem completa do banner na Arena sem corte."
priority: "alta"
status: "concluída"
last_updated: "2026-04-22"
tags: [notas, mundo, bestiario, arena, ui, ux, eventsourcing]
epic: epic-01-refatoracao-modular
---

# Story 47 - Notas A-Z, Paginação 10/20/50, Facção em Personagem, Bestiário com Inventário e Banner Fullscreen na Arena

## Contexto
Com base no estado atual do código e no `/knowledge`:
1. O módulo de Notas renderiza listas sem paginação de quantidade (`10/20/50`) e sem um controle dedicado de ordenação A-Z para o feed.
2. Há droplists no fluxo de Notas/Mundo com preenchimento em ordem de inserção (não determinística/alfa em todos os casos).
3. Entidades `PERSONAGEM` em `WorldEntity` já suportam família/raça/religião/origem/local, mas ainda sem vínculo de facção.
4. No modal de bestiário (`BestiaryTab`), o botão `LOCAL ↔ GERAL` está fora da área principal da ficha e pode conflitar visualmente com o conteúdo.
5. O bestiário abre `CharacterCard` com `hideInventory={true}`, impedindo uso de inventário para monstros.
6. Na Arena, o fundo usa imagem no `body` com `background-size: cover` e upload de banner com crop 16:5, o que favorece recorte em vez de preservar a imagem inteira.

## Escopo

### 1) Notas - Ordenação A-Z
- Incluir opção de ordenação alfabética no módulo de Notas.
- Como `Note` não possui campo de título no contrato atual, a ordenação alfabética de notas será feita por texto da nota (`content` sanitizado/normalizado).
- Manter a ordenação existente como fallback opcional (não quebrar o fluxo atual).

### 2) Notas - Paginação visual (10/20/50 + navegação)
- Incluir seletor de quantidade por página: `10`, `20`, `50`.
- Incluir botões para navegar entre conjuntos (anterior/próximo).
- Aplicar paginação no feed de notas do diário (abas de notas do módulo).
- Implementação no cliente (sem mudança de endpoint), consistente com o modelo de projeções/event sourcing atual.

### 3) Droplists em A-Z (Notas/Mundo)
- Padronizar ordem alfabética nos droplists de Notas/Mundo gerados a partir de entidades/autores/listas.
- Garantir consistência A-Z em opções textuais e por nome exibido.

### 4) Personagem com Facção no módulo de Mundo
- Adicionar campo de facção para `WorldEntity` do tipo `PERSONAGEM`.
- Expor seleção de facção no modal de criação/edição de entidade de mundo.
- Exibir facção na ficha/modal de visualização do personagem no módulo de Notas/Mundo.
- Incluir facção nos filtros de `Personagens` (quando aplicável).
- Preservar compatibilidade com entidades legadas sem facção (campo opcional).

### 5) Bestiário - posição do botão Local/Geral + inventário
- Reposicionar o botão `LOCAL ↔ TORNAR GERAL` para ponto fixo no topo da ficha/modal do monstro.
- Evitar sobreposição com conteúdo interativo da ficha.
- Remover bloqueio de inventário no card de criatura aberto pelo bestiário.

### 6) Arena - Banner/fundo sem corte
- Ajustar renderização da imagem de fundo da Arena para priorizar exibição completa (sem recorte).
- Ajustar fluxo de seleção/crop do banner da Arena para não impor recorte de cabeçalho (16:5) no contexto da Arena.
- Manter comportamento de banner das demais abas sem regressão.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/features/session-notes/components/NotesTab.tsx` | Controles de ordenação A-Z, paginação `10/20/50` e navegação entre conjuntos no feed de notas. |
| `src/features/session-notes/hooks/useSessionNotesDiary.ts` | Base de dados derivada para ordenação/paginação de notas e consistência de filtros. |
| `src/features/session-notes/hooks/useSessionNotes.ts` | Ordenação A-Z de opções/droplists e inclusão de filtro por facção em `Personagens`. |
| `src/features/session-notes/hooks/useWorldEntityForm.ts` | Estado de formulário para novo vínculo de facção em `PERSONAGEM`. |
| `src/features/session-notes/hooks/useWorldEntities.ts` | Persistência de `factionId` em create/update de `WorldEntity` e campos de visibilidade relacionados. |
| `src/features/session-notes/components/CreateWorldEntityModal.tsx` | Novo droplist de facção para personagem e ordenação A-Z de opções de seleção. |
| `src/features/session-notes/components/ViewWorldEntityModal.tsx` | Exibição de facção na ficha de `PERSONAGEM` e controle de visibilidade do campo. |
| `src/features/session-notes/components/WorldTab.tsx` | Exibição contextual de metadados de personagem incluindo facção (quando aplicável). |
| `src/types/domain.ts` | Extensão do contrato de `WorldEntity` com campo opcional de facção. |
| `src/components/session/BestiaryTab.tsx` | Reposicionamento do botão de escopo local/geral e habilitação de inventário no modal de criatura. |
| `src/app/session/[id]/session.css` | Estilo de posicionamento fixo do botão local/geral no topo da ficha/modal do bestiário. |
| `src/components/SessionHeader.tsx` | Diferenciar comportamento de seleção/crop de banner em ARENA vs demais abas. |
| `src/app/session/[id]/page.tsx` | Ajuste do background da Arena para exibição de imagem inteira sem corte. |

## Critérios de Aceitação
1. O módulo de Notas exibe controle de ordenação com opção A-Z e aplica a ordenação no feed conforme seleção.
2. O módulo de Notas exibe seletor `10/20/50` e botões de navegação de página (anterior/próxima), com estado desabilitado nas extremidades.
3. Trocar a quantidade por página recalcula corretamente o conjunto exibido sem duplicar/perder notas.
4. Droplists de Notas/Mundo (autores, personagens e entidades vinculadas) ficam em ordem alfabética A-Z por nome exibido.
5. Em `Mundo > Personagens`, criação e edição permitem selecionar facção, e o valor persiste após salvar/reabrir.
6. Em visualização de personagem no módulo de Mundo, facção aparece junto aos demais vínculos (família, raça, origem, local, religião), com fallback quando vazio.
7. Filtro de `Personagens` passa a aceitar facção (quando existirem dados), sem quebrar filtros já existentes.
8. No modal do bestiário, o botão `LOCAL ↔ TORNAR GERAL` fica fixo no topo da ficha e não sobrepõe controles/conteúdo.
9. Criaturas abertas pelo bestiário exibem e permitem uso da aba de inventário conforme permissões atuais.
10. Na ARENA, o banner/fundo passa a exibir a imagem inteira (sem recorte por `cover`), preservando leitura visual.
11. Trocar banner na ARENA não força recorte de cabeçalho (16:5) e não causa regressão visual nas abas não-Arena.
12. Fluxos de event sourcing/replay continuam íntegros (sem erro de projeção para entidades legadas sem `factionId`).

## Fora de Escopo
- Alteração de contrato REST/WebSocket no backend (além do tráfego de eventos já existente).
- Refatoração ampla da UI de tabs do Session Notes fora dos pontos descritos.
- Mudança de mecânicas de combate além do fundo visual da Arena.

## Dependências e Riscos
- Risco de regressão visual no modal do bestiário ao reposicionar o botão de escopo; mitigar com ajuste CSS isolado.
- Risco de comportamento inesperado na paginação ao combinar filtros + ordenação; mitigar com estado derivado único e reset de página ao mudar filtro.
- Risco de inconsistência documental do contrato de `WorldEntity`; ao concluir implementação, atualizar knowledge correspondente.

## Validação Planejada
1. Teste manual em `Notas` com volumes altos (>= 60 notas), alternando `10/20/50`, filtros e ordenação A-Z.
2. Teste manual em `Mundo > Personagens` para criar/editar facção e validar persistência após reload.
3. Teste manual no `Bestiário` para abrir criatura, verificar posição fixa do botão local/geral e inventário funcional.
4. Teste manual na `Arena` com imagens verticais e horizontais para garantir exibição inteira sem corte.
5. Build de produção (`npm run build`) sem novos erros.

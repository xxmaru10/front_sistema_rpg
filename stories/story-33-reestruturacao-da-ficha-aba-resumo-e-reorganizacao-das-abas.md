---
title: "Story 33 - Reestruturação da Ficha: aba Resumo e reorganização de Lore, Façanhas/Magia, Inventário e Notas Privadas"
description: "Reorganizar a ficha de personagem para jogador e mestre com uma nova aba Resumo no topo, seguida por quatro abas focadas em Lore, Façanhas/Magia, Inventário e Notas Privadas."
priority: "alta"
status: "concluida"
last_updated: "2026-04-08 (implementacao-validada)"
tags: [ui, ficha, character-card, tabs, resumo, lore, inventario, notas]
---

# Story 33 - Reestruturação da Ficha: aba Resumo e reorganização de Lore, Façanhas/Magia, Inventário e Notas Privadas

## Contexto
A ficha atual já passou por ajustes de responsividade e consolidação de abas, mas a distribuição de conteúdo ainda não corresponde ao fluxo desejado para jogador e mestre. A solicitação agora é reorganizar a experiência da ficha para destacar um resumo objetivo do personagem no topo e separar melhor o conteúdo em abas com responsabilidades claras.

O objetivo principal é tornar a leitura mais rápida, dar prioridade ao retrato/nome/estado mecânico essencial e oferecer atalhos mais diretos para lore, poderes, inventário e notas privadas.

Esta Story é estritamente uma **reestruturação de organização e visualização**. A premissa obrigatória é que **todas as funcionalidades já existentes da ficha permaneçam exatamente como são hoje**, apenas redistribuídas no novo modelo de layout e navegação.

## Escopo

### Fase 1 - Novo bloco superior de Resumo
- Criar uma aba ou seção fixa de **Resumo** no topo da ficha.
- Exibir dentro de uma caixa com bordas arredondadas:
1. miniatura circular do rosto do personagem.
2. nome do personagem ao lado, mantendo capacidade de edição conforme comportamento atual.
3. trilhas de estresse.
4. consequências.
5. pontos de fate/destino.
6. perícias com pontuação, exibindo apenas perícias com valor acima de `0`.
- Organizar as perícias com diferenciação visual por cor, sem listar perícias zeradas no Resumo.

### Fase 2 - Reorganização das abas principais
- Abaixo do bloco/aba Resumo, reorganizar a ficha em quatro abas:
1. **Lore**: reunir lore e aspectos no mesmo lugar, mantendo também o retrato quadrado grande.
2. **Façanhas e Magia**: preservar a lógica atual de alternância interna entre Façanhas e Magia, seguida logo abaixo pela área de perícias como já existe hoje.
3. **Inventário**: exibir somente o inventário.
4. **Notas Privadas**: exibir somente as notas privadas do jogador, funcionando como atalho direto para leitura e escrita dessas notas.

### Fase 3 - Paridade entre GM e Player
- Garantir que a reorganização funcione tanto para jogador quanto para mestre.
- Preservar permissões já existentes de edição, sem ampliar acesso indevido a notas privadas de terceiros.
- Garantir que a aba de Notas Privadas respeite o escopo do personagem/jogador atual.

### Fase 4 - Continuidade visual e de usabilidade
- Manter a identidade visual premium já adotada pela ficha.
- Evitar regressões na responsividade e no comportamento das abas já existentes.
- Preservar o fluxo de edição já consolidado para nome, lore, aspectos, façanhas, magias, inventário e notas privadas, adaptando apenas a organização da interface.
- Garantir paridade funcional completa com a ficha atual: tudo o que já existe hoje continua existindo no novo modelo, sem perda de ações, atalhos, estados, permissões ou capacidades de edição.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/CharacterCard/CharacterCard.tsx` | Reorganizar a composição principal da ficha, introduzindo o Resumo e a nova hierarquia de abas. |
| `src/components/CharacterCard/CharacterCard.styles.tsx` | Ajustar layout, espaçamentos, caixa arredondada do Resumo e responsividade geral. |
| `src/components/CharacterCard/CharacterPortrait.tsx` | Suportar a miniatura circular no Resumo e manter o retrato quadrado grande na aba Lore. |
| `src/components/CharacterCard/CharacterLore.tsx` | Consolidar lore e aspectos dentro da aba Lore. |
| `src/components/CharacterCard/CharacterVitality.tsx` | Reposicionar e adaptar a exibição de estresse e pontos de fate/destino dentro do Resumo. |
| `src/components/CharacterCard/CharacterConsequences.tsx` | Integrar consequências ao bloco superior de Resumo. |
| `src/components/CharacterCard/SkillsSection.tsx` | Separar a renderização de perícias do Resumo (somente `> 0`, com cores) e da aba Façanhas/Magia (como já existe). |
| `src/components/CharacterCard/PowerTabsSection.tsx` | Ajustar a aba Façanhas e Magia para manter o submenu atual e encaixar o bloco de perícias logo abaixo. |
| `src/components/CharacterCard/InventorySection.tsx` | Garantir que a aba Inventário mostre somente o inventário. |
| `src/components/CharacterCard/use-power-tabs.ts` | Revisar o estado das abas para suportar a nova navegação principal e o submenu interno de Façanhas/Magia. |
| `src/components/CharacterCard/useCharacterCard.ts` | Preservar handlers e permissões da ficha após a reorganização de containers e seções. |
| `src/features/session-notes/components/NotesTab.tsx` | Validar reaproveitamento ou extração do conteúdo de notas privadas para uso direto na ficha. |
| `src/features/session-notes/hooks/useSessionNotes.ts` | Validar integração da aba de Notas Privadas com o fluxo já existente de leitura/escrita das notas do jogador. |

## Critérios de Aceitação
1. A ficha passa a ter um bloco ou aba superior de **Resumo** visível no topo.
2. O Resumo mostra miniatura circular do rosto do personagem, nome editável, trilhas de estresse, consequências, pontos de fate/destino e perícias com valor acima de `0`.
3. Nenhuma perícia com valor `0` aparece no Resumo.
4. As perícias do Resumo possuem diferenciação visual por cor, sem prejudicar legibilidade.
5. Todo o conteúdo do Resumo fica contido em uma caixa com bordas arredondadas e visual coerente com a ficha atual.
6. A aba **Lore** reúne lore, aspectos e o retrato quadrado grande do personagem.
7. A aba **Façanhas e Magia** mantém o submenu atual entre Façanhas e Magia e exibe a área de perícias logo abaixo.
8. A aba **Inventário** exibe somente o inventário, sem conteúdos paralelos.
9. A aba **Notas Privadas** exibe somente as notas privadas do jogador daquele personagem e permite continuar escrevendo/atualizando esse conteúdo.
10. Jogador não ganha acesso a notas privadas de outros personagens; mestre também não deve quebrar a regra de privacidade já adotada pelo sistema.
11. O nome do personagem continua editável no novo layout conforme as permissões atuais.
12. A reorganização funciona sem regressão visual relevante em desktop e em resoluções menores já suportadas pela ficha.
13. O fluxo atual de Façanhas, Magias, Inventário e edição textual continua funcional após a mudança estrutural.
14. Nenhuma funcionalidade já existente da ficha é removida, simplificada ou alterada em comportamento; a mudança é somente de organização e apresentação.
15. Qualquer controle, ação ou informação atualmente disponível na ficha antiga continua acessível no novo layout, ainda que em outra aba ou seção.
16. Permissões atuais de GM e Player permanecem inalteradas em todas as áreas reaproveitadas pela nova estrutura.

## Fora de Escopo
- Alterar o modelo de dados de personagem.
- Criar novas regras de jogo para estresse, consequências, perícias, fate/destino ou inventário.
- Redesenhar globalmente a identidade visual do sistema fora da ficha.
- Modificar regras de persistência de notas além do necessário para reaproveitar o fluxo existente na nova aba.
- Remover, reduzir ou reinterpretar qualquer funcionalidade já disponível na ficha atual.

## Dependências e Riscos
- Há risco de acoplamento entre a ficha e o módulo de notas caso a aba de Notas Privadas reutilize componentes atualmente pensados para `SessionNotes`.
- Há risco de regressão visual na ficha por envolver redistribuição de quase todas as seções principais do `CharacterCard`.
- Há risco de regressão de permissões se a aba de Notas Privadas reutilizar UI sem manter o filtro correto por autor/personagem.

## Status de Execução
- Implementação concluída.
- Reorganização aplicada sem remover funcionalidades já existentes da ficha.
- Build de produção validado com sucesso via `npm run build` em 2026-04-08.

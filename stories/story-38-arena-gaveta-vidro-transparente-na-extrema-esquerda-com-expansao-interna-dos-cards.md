---
title: "Story 38 - Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards"
description: "Reestruturar as gavetas laterais da Arena para visual glass, seta externa e fluxo de abrir todos os cards dentro da gaveta, iniciando com apenas um personagem visivel por lado no estado fechado."
priority: "alta"
status: "planejada"
last_updated: "2026-04-10 (draft-inicial)"
tags: [ui, arena, combat, cards, drawer, glass, rework]
epic: epic-02-rework-cards-arena-gavetas-e-interacoes
---

# Story 38 - Arena: gaveta vidro transparente na extrema esquerda com expansao interna dos cards

## Contexto
Atualmente a Arena usa gavetas laterais (`.combat-avatar-drawer`) com rail de retratos compactos e, quando um personagem e aberto, o card completo aparece fora da gaveta na pilha externa (`.combat-expanded-stack`).

A solicitacao desta Story e mudar esse fluxo para o inicio de um rework maior:
1. a gaveta lateral passa a ter visual transparente estilo vidro (alinhado ao menu lateral);
2. a gaveta esquerda fica ancorada na extrema esquerda;
3. a seta de abrir/fechar deve ser um handle externo (separado do corpo da gaveta);
4. no estado fechado, a gaveta mostra somente 1 personagem;
5. ao clicar na seta, a gaveta expande e passa a mostrar todos os personagens do lado com cards abertos dentro da propria gaveta (nao fora);
6. o mesmo comportamento deve existir para o lado de inimigos.

Pelo `knowledge/architecture.md`, a entrega e de UI/composicao. Nao ha necessidade de alterar Event Sourcing, projecoes ou contratos de dominio.

## Escopo

### Fase 1 - Visual glass + ancoragem lateral
- Aplicar estilo vidro/transparencia na gaveta lateral de personagens e inimigos, mantendo contraste e legibilidade.
- Fixar a gaveta do lado dos personagens na extrema esquerda da Arena.
- Manter o padrao visual coerente com o menu lateral global em d20.

### Fase 2 - Handle de seta externo e estado fechado com 1 personagem
- Separar visualmente o handle de seta do conteudo da gaveta (seta externa, sem "misturar" com o painel interno).
- Estado fechado deve renderizar apenas 1 personagem por lado.
- Regra de selecao no estado fechado:
1. jogador: mostrar o personagem vinculado/logado;
2. mestre: mostrar apenas 1 personagem (regra exata a validar na aprovacao desta Story);
3. inimigos: mostrar apenas 1 personagem (regra exata a validar na aprovacao desta Story).

### Fase 3 - Expansao com cards internos
- Clique na seta deve "puxar" a gaveta e renderizar todos os personagens daquele lado dentro da gaveta.
- Os cards devem abrir dentro da gaveta (substitui fluxo atual de cards abertos fora da gaveta).
- Aplicar o mesmo fluxo para:
1. lado de herois/aliados;
2. lado de inimigos/ameacas.

### Fase 4 - Comportamento e responsividade
- Preservar funcionamento em desktop e mobile sem perda de clique/scroll.
- Evitar conflito de sobreposicao entre a gaveta esquerda e o menu lateral global.
- Garantir que o estado visual da Arena continue claro com/dessem expansao.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/session/CombatTab.tsx` | Reorquestrar estado de gaveta fechada/aberta por lado, lista de personagens exibidos por estado e renderizacao dos cards dentro da gaveta. |
| `src/components/CombatCard/CombatCard.tsx` | Ajustar modo de exibicao para suportar renderizacao de card dentro da gaveta expandida, mantendo paridade funcional do card atual. |
| `src/components/CombatCard/CombatHeader.tsx` | Ajustar acao de recolher/retorno conforme novo fluxo de cards internos na gaveta. |
| `src/components/CombatCard/CombatCard.styles.tsx` | Aplicar refinos visuais glass nos cards/handles relacionados ao novo comportamento da gaveta. |
| `src/app/session/[id]/session.css` | Redesenhar estrutura visual da gaveta (vidro, extrema esquerda, handle externo) e layout de cards internos para ambos os lados. |
| `src/app/session/[id]/page.tsx` | Ajustes de integracao de layout, caso necessarios, para convivio entre menu lateral global e nova gaveta da Arena. |

## Criterios de Aceitacao
1. A gaveta lateral da Arena passa a usar visual transparente estilo vidro, com leitura clara de conteudo.
2. A gaveta do lado dos personagens fica posicionada na extrema esquerda.
3. A seta de abrir/fechar fica separada do corpo da gaveta, como handle externo.
4. No estado fechado, o lado dos personagens exibe apenas 1 personagem.
5. No estado fechado, o lado dos inimigos exibe apenas 1 personagem.
6. Ao clicar na seta de um lado, a gaveta daquele lado expande e passa a exibir todos os personagens daquele lado.
7. Com a gaveta expandida, os cards aparecem abertos dentro da gaveta (nao em pilha externa fora dela).
8. O fluxo acima funciona igualmente para herois/aliados e para inimigos/ameacas.
9. Abertura/recolhimento da gaveta nao quebra scroll, clique ou legibilidade da Arena em desktop.
10. Em mobile, a interacao da gaveta continua utilizavel sem sobreposicao bloqueante.
11. Nenhum evento novo de dominio e introduzido; mudanca restrita a UI.

## Fora de Escopo
- Alterar regras de combate, turnos, estresse, consequencias, destino ou impulso.
- Alterar contratos de `domain.ts`, `api-contract.md`, projecoes ou Event Store.
- Reestruturar `HazardCard` para outro fluxo fora do padrao desta Story.
- Persistir estado aberto/fechado das gavetas entre refreshes (se nao houver validacao explicita para isso).

## Dependencias e Riscos
- Regra de "qual personagem unico aparece no estado fechado" para GM e para inimigos precisa de validacao na aprovacao.
- Existe risco de conflito de layout/z-index com o menu global em d20 ao prender a gaveta na extrema esquerda.
- Existe risco de regressao de densidade visual ao mover cards abertos para dentro da gaveta; requer validacao de largura minima e scroll interno.

## Status de Execucao
- Story criada e pronta para aprovacao.
- Implementacao nao iniciada por solicitacao do usuario.

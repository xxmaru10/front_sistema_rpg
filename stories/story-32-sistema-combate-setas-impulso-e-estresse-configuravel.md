---
title: "Story 32 - Sistema de Combate: setas de impulso nos cards e estresse configurável por caixa"
description: "Adicionar controle de setas de impulso (GM-only) em qualquer card da Arena, reorganizar header do card de jogador e permitir que o GM defina/edite valor de cada caixa de estresse (1-1000)."
priority: "alta"
status: "concluida"
last_updated: "2026-04-08 (implementacao-finalizada)"
tags: [combat, cards, impulso, stress, gm, eventsourcing, ui]
---

# Story 32 - Sistema de Combate: setas de impulso nos cards e estresse configurável por caixa

## Contexto
Foram solicitadas duas evoluções no sistema de cards de combate:
1. O mestre deve poder adicionar/remover múltiplas setas de impulso (brancas com glow) em qualquer card da Arena. Jogador não pode adicionar nem remover.
2. O mestre deve poder definir e editar o valor de cada caixa de estresse (de `1` a `1000`), em vez de depender de valor fixo implícito.

Também foi solicitado ajuste visual no card de jogador: nome no topo, abaixo a seção de Destino com pontos, e ao lado as setas de impulso (quando existirem).

## Escopo

### Fase 1 - Modelo de dados e eventos (Event Sourcing)
- Introduzir no estado de personagem os dados necessários para:
1. contagem de setas de impulso por card.
2. valor configurável por caixa de estresse físico e mental.
- Definir eventos de domínio para:
1. incrementar/decrementar setas de impulso (GM-only).
2. adicionar caixa de estresse com valor informado.
3. editar valor de caixa de estresse existente.
- Preservar compatibilidade com estado/eventos já existentes.

### Fase 2 - Permissões (GM vs Player)
- Garantir que apenas GM possa:
1. colocar/remover setas de impulso.
2. criar/editar valores de caixas de estresse.
- Jogador permanece com permissão apenas para marcar/limpar estresse e alterar destino quando já permitido no fluxo atual.

### Fase 3 - UI dos cards de combate (Arena)
- Reorganizar header do `CombatCard`:
1. linha principal com nome do jogador no topo.
2. linha secundária com bloco de Destino.
3. setas de impulso ao lado do bloco de Destino.
- Renderizar setas brancas com glow conforme quantidade atual.
- Exibir controles de `+`/`-` de setas somente para GM.

### Fase 4 - UI de estresse configurável
- No fluxo de gerenciamento de estresse (card completo/ficha), permitir:
1. criação de caixa informando valor (`1` a `1000`).
2. edição do valor de caixas já existentes.
- No card de combate, cada caixa deve exibir seu valor configurado.

### Fase 5 - Regras de cálculo e compatibilidade retroativa
- Ajustar cálculo de absorção de dano para considerar capacidade real de cada caixa.
- Definir fallback para personagens legados (arrays booleanos antigos), convertendo sem perda de funcionalidade visual ou de combate.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/components/CombatCard/CombatHeader.tsx` | Reorganização visual do header (nome, destino e setas de impulso) e ações GM-only de setas. |
| `src/components/CombatCard/CombatCard.styles.tsx` | Estilo das setas brancas com glow e novo layout do topo do card. |
| `src/components/hooks/useCombatCard.ts` | Dispatch dos eventos de setas de impulso e regras de permissão GM-only no card de combate. |
| `src/components/CombatStressTracks.tsx` | Render de caixas de estresse mostrando valor configurado por caixa no card de combate. |
| `src/components/CharacterCard/CharacterVitality.tsx` | UI de criação/edição de valor de caixa de estresse (1-1000), restrita ao GM. |
| `src/components/CharacterCard/useCharacterCard.ts` | Emissão dos novos eventos de adicionar/editar caixa com valor e manutenção de marcação/desmarcação. |
| `src/lib/gameLogic.ts` | Atualização do algoritmo de absorção para usar capacidade por caixa ao invés de 1 fixo. |
| `src/lib/projections.ts` | Aplicação dos novos eventos no estado (setas de impulso e valores de caixas), com fallback de compatibilidade. |
| `src/types/domain.ts` | Evolução dos tipos de `Character`, `stress` e `ActionEvent` para suportar novo modelo. |
| `src/components/CharacterCreator.tsx` | Ajuste de criação inicial de personagens para estrutura de estresse compatível com valor por caixa. |
| `src/app/session/[id]/hooks/useSessionActions.ts` | Ajuste de clonagem/summon para preservar/gerar estrutura de estresse com valores por caixa. |

## Critérios de Aceitação
1. GM consegue adicionar e remover setas de impulso em cards de jogador, NPC e ameaça na Arena.
2. Jogador não vê controles para adicionar/remover setas e não consegue disparar os eventos correspondentes.
3. Quantidade de setas de impulso persiste após sincronização, refresh e reentrada na sessão.
4. No card de combate, o nome aparece no topo; abaixo fica o bloco de Destino; e ao lado ficam as setas de impulso.
5. Setas exibidas são brancas com glow perceptível e não degradam legibilidade do header.
6. GM consegue criar nova caixa de estresse físico/mental informando valor entre `1` e `1000`.
7. GM consegue editar o valor de qualquer caixa existente para outro valor entre `1` e `1000`.
8. Valores inválidos (vazio, `<1`, `>1000`, não numérico) são bloqueados com validação de UI.
9. Jogadores continuam podendo marcar/limpar estresse conforme permissões atuais, sem alterar valor da caixa.
10. Algoritmo de absorção de dano passa a considerar os valores reais das caixas.
11. Personagens legados (modelo antigo) continuam funcionais e são exibidos sem quebra na UI.
12. Fluxo compila e mantém comportamento consistente no replay de eventos (projections + Event Sourcing).

## Fora de Escopo
- Rebalanceamento das regras gerais de dano/consequências além da troca para capacidade por caixa.
- Mudança estética global da Arena fora do header do card solicitado.
- Alteração de regras de turn order, rolagem de dados ou mecânicas de áudio/vídeo.

## Dependências e Riscos
- Risco de regressão por mudança de tipo de `stress` (impacta criação, clonagem, combate e projeções).
- Risco de incompatibilidade com sessões antigas se não houver fallback/migração de estrutura legada.
- Risco de autorização parcial se controles de UI forem ocultados sem validação no dispatch dos eventos.

## Status de Execução
- Implementação concluída conforme escopo.
- Build de produção validado com sucesso (`npm run build`) em 2026-04-08.
- Documentação de arquitetura/contrato atualizada para refletir os novos campos e eventos.

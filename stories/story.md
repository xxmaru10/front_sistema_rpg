---
title: "Story 40 - Reorganização e Finalização da Arena de Combate"
story_ref: "story-40-finalizacao-arena-e-gestao-de-fichas.md"
epic: "epic-02-rework-cards-arena-gavetas-e-interacoes"
status: "em_andamento"
last_updated: "2026-04-12"
---

## Situação Atual (Pós-Rollback para fix2)
Após instabilidades estruturais e erros de build na branch `4.9_arena_fix_and_rework`, o repositório foi resetado para o commit `fix2` (**b3f72f9**). 

### Estado dos Arquivos:
- **`src/components/HeaderWrapper.tsx`**: Estado original (Sem alterações).
- **`src/components/SessionHeader.tsx`**: Contém os controles de FX/BG originais (Manter aqui).
- **`src/components/DiceRoller/RollerInputs.tsx`**: Apresenta bug de seleção de bônus.
- **`src/components/DamageResolutionModal.tsx`**: Consequências não aparecem e alerta de dano letal precisa ser removido.
- **`src/app/session/[id]/session.css`**: Estilos da nova sidebar pendentes.

## Requisitos Detalhados (Story 40 - Arena & Fichas)

### 1. Dados e Bônus (Dice Roller)
- **Correção de Camadas e Interação**: O botão de bônus está "preso" atrás de outros elementos de controle superiores ou não permite a seleção. Ao clicar em um valor (+1 a +20 ou -1 a -20), nada acontece ou o menu fecha sem registrar a escolha. 
- **Objetivo**: Garantir que o menu de bônus seja clicável, visível sobre os outros componentes e que a seleção de valores funcione perfeitamente.

### 2. Gestão de Consequências na Ficha de Personagem
- **Não confundir com o Combat Card**: A mudança deve ser na **Ficha Completa** do personagem.
- **Funcionalidade**: O Mestre/Jogador deve conseguir:
    - Acrescentar novas caixas de consequência.
    - Remover caixas de consequência existentes.
    - Editar o texto das consequências diretamente na ficha.
- **Estado atual**: Não está sendo possível remover ou editar de forma funcional na área da ficha.

### 3. Janela de Distribuição de Dano (Damage Resolution)
- **Remover Aviso Letal**: O aviso de "Dano Letal" deve ser removido da janela.
- **Restaurar Slots de Consequência**: Atualmente, os slots de consequência não estão aparecendo na janela de distribuição de dano. Eles precisam voltar a ser exibidos para que o dano possa ser alocado corretamente.

## Objetivos da Próxima Iteração (Pendente)
1. **Combat Sidebar**: Criar barra lateral vertical na extrema esquerda (Convocar, Desafio, Turnos, Dados).
2. **Roller Fix**: Resolver o problema de seleção e camadas do botão de bônus.
3. **Fichas (Consequências)**: Implementar CRUD (Create, Read, Update, Delete) de consequências na ficha principal.
4. **Damage Resolution**: Limpar o alerta de fatalidade e restaurar a exibição dos slots de consequência no modal de dano.

## Handoff Prompt
```text
Dando continuidade ao rework da Arena e Fichas (Story 40).
Base: 'fix2' (b3f72f9). 

- Corrigir bug do botão de bônus (camadas e seleção).
- Implementar gestão total de consequências (add/remove/edit) na FICHA do personagem.
- Ajustar DamageResolutionModal: remover alerta de dano letal e restaurar visibilidade de slots.
- Implementar Combat Sidebar vertical na lateral esquerda.
```

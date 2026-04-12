---
title: "Story 40 - Reorganização e Finalização da Arena de Combate"
description: "Finalizar a interface da arena com nova sidebar e corrigir problemas críticos de gestão de consequências nas fichas e no modal de distribuição de dano."
priority: "alta"
status: "em_andamento"
last_updated: "2026-04-12"
tags: [ui, arena, combat, consequences, character-sheet, bugfix]
epic: epic-02-rework-cards-arena-gavetas-e-interacoes
---

# Story 40 - Reorganização e Finalização da Arena de Combate

## Contexto
Esta story foca na consolidação da UI da Arena após o rework das gavetas (Story 38). O objetivo é garantir que o Mestre tenha controles rápidos e estáveis, e que a gestão de danos e consequências seja funcional tanto na arena quanto nas fichas completas.

## Requisitos

### 1. Sidebar Vertical do GM (Arena)
- Implementar uma gaveta lateral vertical fixa à esquerda na `CombatTab`.
- Deve conter:
    - Botão **Convocar** (Aliado/Inimigo).
    - Botão **Modo Desafio** (Toggle).
    - Botão **Ordem de Turno** (Abre modal).
    - Botão **Dados** (Alterna exibição do DiceRoller).
- Estilo: Glassmorphism, acompanhando a identidade visual da Story 38.

### 2. Correção de Bônus nos Dados
- O menu de bônus (+/- 1 a 20) apresenta problemas de z-index e fechamento precoce.
- **Correção**: Garantir que o portal do menu fique acima de outros botões e que o clique nos botões internos do portal não feche o menu (ajuste de `outsideClick`).

### 3. Gestão de Consequências (Fichas)
- Habilitar CRUD de consequências na **Ficha do Personagem** (não apenas no card).
- Permitir adicionar novos slots, remover slots vazios e editar textos de slots ocupados.

### 4. Modal de Dano (Damage Resolution)
- **Remover alerta de Dano Letal**.
- **Restaurar visibilidade de slots**: Garantir que as consequências do defensor apareçam no modal para alocação de dano.

## Arquivos Afetados
- `src/components/session/CombatTab.tsx`
- `src/components/DiceRoller/RollerInputs.tsx`
- `src/components/DamageResolutionModal.tsx`
- `src/components/CharacterCard/CharacterConsequences.tsx`
- `src/app/session/[id]/session.css`

## Critérios de Aceitação
1. GM consegue realizar todas as ações de combate via sidebar lateral esquerda.
2. É possível selecionar bônus nos dados sem fechamento inesperado ou bloqueio visual.
3. Consequências podem ser editadas, removidas ou adicionadas livremente na ficha do personagem.
4. O modal de dano exibe corretamente os slots de consequência e não mostra mais alertas de fatalidade.

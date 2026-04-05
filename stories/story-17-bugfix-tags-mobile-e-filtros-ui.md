---
title: "Story 17 - Bugfix: Tags Mobile, Filtros UI e Sugestões de Tags"
description: "Corrigir input de tags em dispositivos móveis, expandir filtros contextuais para todas as abas e implementar sugestões de tags."
Status: concluído
last_updated: 2026-04-03
---

# Story 17 - Bugfix: Tags Mobile e Filtros UI

## Contexto
Atualmente, o sistema de tags apresenta dificuldades críticas em dispositivos móveis: ao digitar uma tag e apertar 'Enter', o navegador mobile pula o foco para o próximo campo (Descrição) sem adicionar a tag à lista. Além disso, a navegação de filtros está restrita à aba de Mundo, impedindo a filtragem de notas por autor ou itens por categoria através do botão global. Por fim, a falta de sugestões ao digitar tags leva a duplicidade e falta de padronização.

## Escopo
- **Bug Tag Mobile (Salto de Foco)**: Impedir que o 'Enter' mude o foco sem antes processar a tag. Implementar salvamento automático de tags pendentes na perda de foco (`onBlur`).
- **Filtros Contextuais**: Habilitar o botão de filtros para as abas de Notas, Tempo e Jogo, exibindo opções relevantes (Autores, Tipos de Missão, Categorias de Itens).
- **Sugestões de Tags**: Implementar um dropdown de sugestões no modal de criação de entidade que mostre tags já existentes no sistema conforme o usuário digita.

## Arquivos Afetados
- `src/types/domain.ts`: Adicionar tipos auxiliares se necessário (ex: `FilterOption`).
- `src/hooks/useSessionNotes.ts`:
    - Adicionar lógica para coletar tags únicas da sessão.
    - Expandir `worldFilterAvailableOptions` para ser contextual a `activeTab` (incluindo Autores, Categorias, etc.).
- `src/components/SessionNotes.tsx`:
    - Alterar condicional de exibição do botão de filtros (deve aparecer em todas as abas pai).
    - Adaptar o dropdown de filtros para renderizar o conteúdo dinâmico baseado na aba ativa.
- `src/components/SessionNotesTabs/CreateWorldEntityModal.tsx`:
    - Implementar a visualização de sugestões de tags (dropdown style).
    - Melhorar o `handleAddTag` com `preventDefault` agressivo e suporte a `onBlur`.
- `src/components/SessionNotes.css`:
    - Adicionar estilos vitorianos para o dropdown de sugestões de tags.

## Critérios de Aceitação
1. **Fim do Salto de Foco**: Ao apertar Enter no mobile, a tag deve ser inserida e o foco deve permanecer no input de tags (ou ser controlado para não pular para a descrição indesejadamente).
2. **Salvamento em onBlur**: Se o usuário alternar entre janelas ou clicar fora do input, o texto pendente no campo de tag deve ser convertido em tag automaticamente.
3. **Filtros Dinâmicos**: Ao clicar em 'FILTROS' na aba de Notas, deve-se ver a lista de autores; na aba de Jogo, deve-se ver os tipos de habilidades/itens.
4. **Smart Tags**: O sistema deve sugerir tags existentes (ex: se digitar 'Im', deve sugerir 'Importante' se esta tag já for usada em outra entidade).

## Plano de Ação
1. Refatorar `handleAddTag` em `useSessionNotes.ts` para ser mais robusto e incluir o `onBlur`.
2. Criar seletor de `uniqueTags` no hook (coletando de todas as entidades de mundo).
3. Atualizar condicional do botão de filtros em `SessionNotes.tsx` para cobrir Notas, Mundo, Tempo e Jogo.
4. Implementar UI de sugestões (Portal) em `CreateWorldEntityModal.tsx`.
5. Validar a renderização dos filtros contextuais em cada aba pai.

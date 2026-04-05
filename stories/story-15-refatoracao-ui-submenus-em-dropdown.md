---
title: "Story 15 - Refatoração UI: Submenus com Navegação em Dropdown"
description: "Migrar sub-abas horizontais para seletores do tipo droplist para reduzir ruído visual."
Status: concluído
last_updated: 2026-04-02
---

# Story 15 - Refatoração UI: Submenus em Dropdown

## Contexto
Atualmente, as abas de Notas, Mundo, Tempo e Jogo exibem todos os seus submenus como botões horizontais. Isso gera um excesso de informação visual ("quantidade massiva de botões"). O objetivo é consolidar esses sub-acessos em um dropdown (select) estilizado.

## Escopo
- **Notas**: Consolidação de [Geral, Privado, Jogadores, Sessão] em Droplist.
- **Mundo**: Consolidação de [Personagens, Localizações, Mapas, Facções, Religiões, Famílias, Criaturas, Raças, Outros] em Droplist.
- **Tempo**: Consolidação de [Missões, Linha do Tempo] em Droplist.
- **Jogo**: Consolidação de [Habilidades, Itens, Jogadores] em Droplist.
- Alterar a interface de navegação interna de cada módulo.
- Substituir linhas de botões por um componente de seleção único por aba pai.
- Preservar toda a lógica de roteamento e permissões (GM/Player).

## Arquivos Afetados
- `src/components/SessionNotes.tsx`
- `src/components/SessionNotesTabs/WorldTab.tsx`
- `src/components/SessionNotes.css`
- `src/hooks/useSessionNotes.ts` (verificar triggers de estado)

## Critérios de Aceitação
1. **Navegação Funcional**: Mudar a opção no dropdown deve triggar a troca imediata do conteúdo da aba.
2. **Respeito a Permissões**: Opções restritas ao Mestre não devem aparecer na lista para Jogadores.
3. **Consistência Estética**: O seletor deve ser estilizado com o tema vitoriano (bordas douradas, fundo escuro, fontes serifadas).
4. **Estado Persistente**: A aba selecionada deve permanecer ativa mesmo após o componente re-renderizar ou trocar de aba pai.

## Plano de Ação
1. Criar um componente de seletor vitoriano reutilizável em CSS.
2. Atualizar a `WorldTab` para agrupar as 9+ categorias em um dropdown.
3. Atualizar a `SessionNotes` para converter as sub-abas de Notas, Tempo e Jogo.
4. Testar a responsividade e as permissões de acesso.

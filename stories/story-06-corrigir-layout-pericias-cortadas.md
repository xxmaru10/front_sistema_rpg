---
story: story-06
title: Corrigir Layout de Perícias Cortadas na Ficha
Status: concluído
priority: alta
---

# Story-06: Corrigir Layout de Perícias Cortadas na Ficha

## Problema
Jogadores em resoluções desktop específicas ou com janelas redimensionadas relataram que as perícias na ficha de personagem aparecem cortadas lateralmente. A segunda coluna da grade de perícias fica muito próxima da borda da ficha, impedindo a visualização e interação com os controles de nível e recursos.

## Diagnóstico Técnico Prévio
1.  **Erro de Sintaxe:** `CharacterCard.css:2268` contém `gap: x 16px;`, o que invalida a propriedade de espaçamento.
2.  **Rigidez da Grade:** O uso de `1fr 1fr` sem um `min-width` para as colunas força o esmagamento do conteúdo quando a ficha está em seu `min-width` de 340px.
3.  **Gestão de Overflow:** Ausência de regras de `min-width` para os nomes das perícias versus controles.

## Objetivos
- [ ] Corrigir erro de sintaxe no `gap` da grade de perícias.
- [ ] Implementar comportamento responsivo para a grade (colapsar para 1 coluna em espaços reduzidos).
- [ ] Otimizar o preenchimento lateral da ficha para evitar recortes em resoluções menores.
- [ ] Garantir que nomes longos de perícias não "empurrem" os controles para fora do card.

## Arquivos Afetados
- `src/components/CharacterCard.css`: Ajuste de grid, gap e media queries.
- `src/components/CharacterCard/SkillsSection.tsx`: Otimização de classes se necessário.

## Critérios de Aceitação
- [ ] As perícias devem estar 100% visíveis, sem cortes nos botões de controle (+/-), independente do tamanho do nome da perícia.
- [ ] Remoção completa do erro de sintaxe `gap: x 16px`.
- [ ] A grade deve alternar para 1 coluna automaticamente se o espaço horizontal for menor que 300px líquidos.
- [ ] Testar visualmente a ficha no modo "Compact" para garantir que as perícias continuem legíveis.

## Histórico de Decisões
- **Grid Responsiva Dinâmica:** Decidido usar `grid-template-columns: repeat(auto-fit, minmax(130px, 1fr))` para permitir que o navegador decida o número de colunas com base no espaço disponível, em vez de forçar 2 colunas.

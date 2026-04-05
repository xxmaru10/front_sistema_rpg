---
title: "Story 20 - Ajustes e Correções no Sistema de Notas e Entidades"
description: "Resolver falhas de salvamento (imagens/mapas), corrigir esquemas de campos por tipo (Religião/Origem), implementar limpeza de fonte no editor e melhorar UI de listagem e filtros."
priority: "alta"
Status: concluído
last_updated: 2026-04-04 (correção de padrões)
tags: [notas, mundo, bugfix, ui, editor]
---

# Story 20 - Ajustes e Correções no Sistema de Notas

## Contexto
Usuários reportaram que certas entidades (Mapas, Imagens de Criaturas e Facções) não estão persistindo corretamente após a criação. Além disso, a UI de filtros está travada sem rolagem, o esquema de campos está inconsistente (ex: religião em locais) e o editor de notas está "sujando" o estilo ao copiar textos externos.

## Problemas e Hipóteses

### 1. Falha na Persistência de Imagens e Entidades
- **Hipótese**: O `handleCreateWorldEntity` no hook `useSessionNotes.ts` pode ter listas de inclusão de tipos incompletas ou excessivamente restritivas para campos como `imageUrl`, `religionId` e `originId`. Também é necessário verificar se o `handleCancelWorldEntityEdit` está limpando os estados prematuramente.
- **Foco**: Mapas, Criaturas (Orcs) e Facções.

### 2. UI de Filtros sem Rolagem
- **Causa**: O container `.filters-list-content` pode estar com `overflow` mal configurado ou o pai no Portal impede a expansão correta.
- **Correção**: Garantir `overflow-y: auto` e `max-height` dinâmico.

### 3. Inconsistência no Esquema por Tipo (Novas Regras)
- **Localização**: Deve ter apenas `local vinculado` e `tipo`. **Remover religião**.
- **Facção**: Deve ter apenas `local`.
- **Criaturas**: Deve ter `local de origem` e `local vinculado`.
- **Família, Raça, Religião e Outros**: Não devem exibir campos de localização/vínculo desnecessários.

### 4. Formatação Suja no Editor
- **Problema**: `MentionEditor.tsx` aceita HTML rico no `paste`, trazendo fontes e cores externas.
- **Correção**: Adicionar listener de `onPaste` para interceptar e limpar a formatação, mantendo apenas texto puro ou estrutura básica compatível.

### 5. Metadados na Listagem de Personagens
- **Melhoria**: Na aba Mundo > Personagens, exibir em tamanho reduzido abaixo do nome: `local atual | raça | profissão`.

## Escopo

### Fase 1 — Lógica de Dados (`useSessionNotes.ts`)
- [ ] Atualizar `handleCreateWorldEntity` para seguir o novo mapa de campos por tipo:
    - `originId`: Adicionar suporte para `BESTIARIO`.
    - `religionId`: Remover `LOCALIZACAO` e `FACAO`.
    - `currentLocationId`: Ajustar conforme a regra de cada tipo.
- [ ] Validar se `imageUrl` está sendo incluído em todos os tipos que suportam imagem.

### Fase 2 — UI de Listagem e Filtros (`WorldTab.tsx`)
- [ ] Atualizar a renderização de `PERSONAGEM` para incluir a linha de metadados (Local, Raça, Profissão).
- [ ] Ajustar labels de localização para tipos como `LOCALIZACAO`, `FACAO` e `BESTIARIO`.
- [ ] Corrigir o CSS/Inline Style do dropdown de filtros para suportar rolagem interna.

### Fase 3 — Modal de Criação (`CreateWorldEntityModal.tsx`)
- [ ] Condicionalizar a exibição dos inputs de acordo com o `newEntityType` selecionado, seguindo as novas restrições de esquema.
- [ ] Garantir que o campo de Pesquisa de Tipo (`locSearch`) funcione fluidamente com scroll.

### Fase 4 — Limpeza do Editor (`MentionEditor.tsx`)
- [ ] Implementar `handlePaste` que limpa estilos CSS inline e fontes customizadas.

## Arquivos Afetados
| Arquivo | Responsabilidade |
|---|---|
| `src/hooks/useSessionNotes.ts` | Lógica de criação, atualização e visibilidade de campos. |
| `src/components/SessionNotesTabs/WorldTab.tsx` | UI de listagem de entidades e menu de filtros. |
| `src/components/SessionNotesTabs/CreateWorldEntityModal.tsx` | Interface de entrada de dados e condicionais de campos. |
| `src/components/MentionEditor.tsx` | Comportamento de colagem e higienização de texto. |
| `src/components/SessionNotes.css` | Estilização global do scroll de filtros e badges. |

## Critérios de Aceitação
1.  **Persistência**: Mapas, Imagens e Facções salvam e persistem após refresh da página.
2.  **Esquema**: Localizações não exibem campo de religião; Criaturas possuem local de origem.
3.  **Filtros**: É possível rolar a lista de filtros quando ela excede o tamanho da tela.
4.  **Editor**: Texto colado de fontes externas assume a fonte padrão do sistema automaticamente.
5.  **Visual**: Na lista de personagens, os metadados (local, raça e profissão) aparecem de forma discreta em baixo do nome.

---
title: "Story 21: Ajustes de Scroll em Menus e Persistência de Imagens de Mundo"
description: "Correção de menus suspensos (Portals) que não seguiam o scroll e bug de persistência em imagens de entidades de mundo."
status: "concluído"
last_updated: 2026-04-04
---

# Story 21: Ajustes de Scroll e Persistência de Imagens

## Contexto
O usuário identificou que menus suspensos e filtros "ficavam parados" na tela quando a página era rolada, em vez de fechar ou seguir o fluxo (devido ao uso de React Portals com posição fixa). Além disso, imagens de mapas, criaturas (bestiário) e facções não eram salvas corretamente.

## Objetivos
1. **Fechar menus ao rolar**: Implementar listeners de scroll que forçam o fechamento de Portals (como o menu de filtros) quando o usuário move a tela.
2. **Garantir persistência de imagens**: Corrigir a lógica de salvamento de `imageUrl` para todas as entidades de mundo.
3. **Feedback visual de carga**: Adicionar estado de processamento para evitar submissão de formulários antes da compressão da imagem terminar.

## Alterações Realizadas

### 1. UI (Closing Portals on Scroll)
- Adicionado listener global de scroll em `SessionNotes.tsx` (fase de captura) para fechar o menu de filtros e sugestões automaticamente, evitando o efeito de "menu flutuando fora de lugar".

### 2. Persistência de Imagens (World Entities)
- **useWorldEntities.ts**: Simplificada a lógica de mapeamento de `imageUrl` no payload de criação e atualização, removendo restrições de tipos que impediam o salvamento em algumas categorias.
- **fieldVisibility**: Alterado o padrão para `false` (visível) em novas entidades, garantindo que o mestre e jogadores vejam a imagem imediatamente após o upload.

### 3. Confiabilidade no Upload
- **useWorldEntityForm.ts**: Adicionado estado `isImageProcessing`.
- **CreateWorldEntityModal.tsx**: Implementado bloqueio do botão de submissão e label "PROCESSANDO..." enquanto a imagem (especialmente mapas grandes) está sendo comprimida no Canvas. Isso evita que o evento seja disparado com uma string vazia antes do processamento terminar.

## Critérios de Aceitação
- [x] O menu de filtros fecha automaticamente ao rolar a página para cima ou para baixo.
- [x] Mapas criados via `MapasTab` agora persistem a imagem corretamente.
- [x] Criaturas importadas do bestiário e Facções agora mantêm suas fotos após o salvamento.
- [x] O botão de salvar fica desabilitado com feedback visual enquanto a imagem está sendo processada.

## Arquivos Afetados
- `src/features/session-notes/SessionNotes.tsx`
- `src/features/session-notes/hooks/useWorldEntities.ts`
- `src/features/session-notes/hooks/useWorldEntityForm.ts`
- `src/features/session-notes/components/CreateWorldEntityModal.tsx`
- `src/features/session-notes/components/WorldTab.tsx`
- `knowledge/architecture.md`
- `knowledge/conventions.md`

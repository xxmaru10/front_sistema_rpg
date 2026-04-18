---
title: "Story 42 - Botão Lápis: Reabrir Cropper de Retrato do Personagem"
description: "Adicionar um botão com ícone de lápis no retrato do personagem, visível apenas para o Mestre, que reabre o modal de corte (ImageCropper → ArenaFocusCropper) usando a imagem já existente, permitindo reajustar enquadramento e foco sem precisar fazer um novo upload."
priority: "média"
status: "concluído"
last_updated: "2026-04-18"
tags: [ui, componente, image, ux]
epic: epic-01-refatoracao-modular
---

# Story 42 - Botão Lápis: Reabrir Cropper de Retrato do Personagem

## Contexto

Ao fazer upload de uma imagem para o retrato de um personagem, o sistema abre automaticamente dois modais em sequência:
1. **`ImageCropper`** — corte e zoom da imagem (saída 600×600 JPEG).
2. **`ArenaFocusCropper`** — ajuste do ponto focal para exibição na Arena.

Após confirmar ambos, a imagem processada é enviada ao storage e o personagem é atualizado via eventos. O problema é que, uma vez concluído o processo, não existe forma de **reabrir esses modais sem fazer um novo upload de arquivo**. O Mestre pode querer reajustar o enquadramento de uma imagem já existente sem ter que localizar novamente o arquivo no sistema de arquivos.

---

## Objetivo

Adicionar um **botão com ícone de lápis (✏ / Pencil da Lucide)** que aparece sobreposto ao retrato do personagem quando:
- O usuário é o **Mestre** (`isGM === true`)
- O personagem **já possui uma imagem** (`imageUrl` não está vazio)
- A imagem **não está sendo processada** (`isImageProcessing === false`)

Clicar nesse botão reabre o fluxo completo de corte (`ImageCropper` → `ArenaFocusCropper`) usando a `imageUrl` atual como fonte, sem exigir que o Mestre localize o arquivo novamente.

---

## Escopo

### Incluído
- Renderização do botão lápis sobre o retrato (visível ao hover ou fixo, conforme a UI decider).
- Ao clicar no botão, `tempCropSrc` é definido como a `imageUrl` atual e o modal `ImageCropper` é aberto.
- O fluxo após a confirmação do crop é **idêntico** ao fluxo de upload normal: `ImageCropper` → `ArenaFocusCropper` → upload → eventos.
- O botão é exclusivo para o Mestre; jogadores não o veem.

### Excluído
- **Não** altera o comportamento de clique sobre o retrato (continua abrindo o file picker para novo upload).
- **Não** implementa rotação ou filtros de imagem.
- **Não** modifica a lógica de upload, compressão ou eventos existentes.
- **Não** afeta entidades do mundo (`CreateWorldEntityModal`), apenas o `CharacterCard`.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `src/components/CharacterCard/CharacterPortrait.tsx` | Adicionar prop `onReCrop?: () => void`; renderizar botão lápis quando `isGM && imageUrl && !isImageProcessing`. |
| `src/components/CharacterCard/useCharacterCard.ts` | Adicionar `handleReCrop()`: define `tempCropSrc = character.imageUrl`, `setIsCropping(true)`, `setIsImageProcessing(true)`; exportar a função no retorno do hook. |
| `src/components/CharacterCard/CharacterCard.tsx` | Passar `onReCrop={hook.handleReCrop}` para `<CharacterPortrait>`. |

> Nenhuma alteração no backend ou no contrato de API.

---

## Risco Técnico

**CORS ao desenhar imagem remota no Canvas**: O `ImageCropper` usa a Canvas API para processar a imagem. Se a `imageUrl` for uma URL do Supabase Storage (ou outro CDN), o navegador pode bloquear o desenho no canvas por política de CORS. O `<img>` precisa carregar com `crossOrigin="anonymous"` e o servidor precisa retornar os headers `Access-Control-Allow-Origin` corretos.

→ **Ação**: Verificar se o bucket do Supabase já serve esses headers (provável que sim, pois o sistema já carrega imagens externamente). Garantir que o `ImageCropper` passa `crossOrigin="anonymous"` ao criar o `Image()` quando a src não for um blob.

---

## Critérios de Aceitação

- [x] O botão lápis **aparece** sobre o retrato quando `isGM === true` e `imageUrl` está definido.
- [x] O botão lápis **não aparece** para jogadores não-Mestre, independentemente de `imageUrl`.
- [x] O botão lápis **não aparece** durante `isImageProcessing === true`.
- [x] Clicar no botão lápis **abre o `ImageCropper`** carregado com a imagem atual do personagem.
- [x] Confirmar o `ImageCropper` **abre o `ArenaFocusCropper`** na sequência, exatamente como no fluxo de upload normal.
- [x] Confirmar o `ArenaFocusCropper` faz o upload da imagem recortada e despacha `CHARACTER_IMAGE_UPDATED` + `CHARACTER_UPDATED` com o novo `arenaPortraitFocus`.
- [x] Cancelar em qualquer etapa fecha os modais sem alterar `imageUrl` ou `arenaPortraitFocus` do personagem.
- [x] Clicar diretamente sobre o retrato (fora do botão lápis) **continua abrindo o file picker** para upload de um novo arquivo.
- [x] O botão segue o estilo visual existente do projeto (Lucide `Pencil`, cores `var(--accent-color)`, opacidade baixa em repouso e plena no hover).

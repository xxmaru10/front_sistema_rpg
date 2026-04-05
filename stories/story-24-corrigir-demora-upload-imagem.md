---
title: "Story 24 - Corrigir Demora de Upload de Imagem (Regressão da Story 23)"
description: "Investigar e corrigir por que o upload de imagem ainda está lento após a Story 23. A substituição FileReader→createObjectURL já foi implementada; o problema residual aponta para isImageProcessing travado sem timeout de segurança."
Status: concluído
priority: "crítica"
last_updated: 2026-04-05
tags: [ui, image, upload, performance, canvas, regressão]
related: [story-23]
---

# Story 24 - Corrigir Demora de Upload de Imagem

## Contexto e Causa da Regressão

Antes da **Story 23**, todos os uploads de imagem seguiam um fluxo simples e rápido:

```
Usuário seleciona arquivo
  → FileReader.readAsDataURL (1 passo)
  → img.onload (1 passo)
  → canvas.drawImage + toDataURL (compressão direta)
  → imagem salva ✅
```

Qualquer imagem, de qualquer tamanho, seguia esse caminho único. O bottleneck do FileReader era aceitável porque havia apenas **uma** decodificação.

Após a **Story 23**, o fluxo foi bifurcado:

```
Usuário seleciona arquivo
  → FileReader.readAsDataURL (lento para imagens grandes — gera base64)
  → img.onload verifica dimensões
    ├── [imagem ≤ limiar] → compressão direta (rápido)
    └── [imagem > limiar] → openCropper(reader.result)
                              → setTempCropSrc(base64 de 13MB) ← React state
                              → ImageCropper recebe 13MB
                                → novo img.onload com 13MB de base64 (segunda decodificação lenta)
                                → canvas vazio até carregar (parece não aparecer)
```

A percepção do usuário é que o upload "parou de funcionar" após a Story 23.

---

## ✅ Correção Já Implementada (durante desenvolvimento da Story 23)

**Verificado em 2026-04-04 pela leitura direta dos arquivos.**

A substituição de `FileReader` por `URL.createObjectURL` foi aplicada em **todos os pontos afetados** durante a implementação da Story 23:

| Arquivo | Status |
|---|---|
| `src/components/CharacterCard/useCharacterCard.ts` | ✅ Usa `URL.createObjectURL` + `revokeObjectURL` correto |
| `src/features/session-notes/components/CreateWorldEntityModal.tsx` | ✅ Usa `URL.createObjectURL` via `processFileUpload` + `revokeObjectURL` correto |
| `src/components/ImageCropper/ImageCropper.tsx` | ✅ `crossOrigin` já condicional: só aplica para URLs externas (não `blob:`) |
| `src/features/session-notes/components/TimeGameTabs.tsx` | ✅ Não possui upload local de imagem — sem impacto |

O único `FileReader` remanescente no codebase está em `SessionTools.tsx`, que **está fora do escopo** desta story (upload direto ao Supabase, sem Canvas local).

---

## ⚠️ Problema Residual Reportado pelo Usuário

Apesar da correção técnica já estar no código, o usuário relata que **qualquer upload de imagem continua lento** após a Story 23. Possíveis causas residuais a investigar:

### Hipótese 1 — `isImageProcessing` travado (mais provável)
O `setIsImageProcessing(true)` é chamado no início de `processFileUpload`. Se o `img.onload` não disparar por qualquer motivo (exs.: browser throttling, imagem corrompida, `img.src = blobUrl` em timing ruim), o modal trava em `PROCESSANDO...` **sem chance de reset**.

```ts
// processFileUpload (CreateWorldEntityModal.tsx:159)
setIsImageProcessing(true);     // ← set
const blobUrl = URL.createObjectURL(file);
const img = new Image();
img.onload = () => { ... };     // ← reset aqui
img.onerror = () => { ... };    // ← reset aqui
img.src = blobUrl;              // ← se isso falhar silenciosamente, trava
```

**Não há timeout de segurança**: se o evento `onload`/`onerror` não disparar, `isImageProcessing` fica `true` para sempre.

### Hipótese 2 — Canvas `toDataURL` bloqueante na thread principal
Para imagens grandes (> 5MB), mesmo com `createObjectURL` o `canvas.toDataURL("image/jpeg", 0.7)` é **síncrono e bloqueia a UI** por 1–5 segundos. Isso é perceptível no caminho direto (imagem abaixo do limiar) e no `handleConfirm` do cropper.

### Hipótese 3 — Decodificação do `ImageCropper` no caminho lento
Imagens muito grandes (> 10MP) ainda levam 1–3s para decodar no `img.onload` dentro do `ImageCropper`, mesmo com blob URL — o blob URL elimina a conversão base64, não a decodificação JPEG pelo browser.

---

## Causa Técnica Detalhada (histórico)

| Etapa | Antes da Story 23 | Depois da Story 23 (imagem > limiar) |
|---|---|---|
| Leitura do arquivo | `FileReader` (1×) | `FileReader` (1×) → base64 em RAM |
| Verificação de dimensões | Direto no `img.onload` | Direto no `img.onload` |
| Abertura do cropper | Não existia | `setTempCropSrc(base64)` — 13 MB no React state |
| Carregamento no `ImageCropper` | N/A | `new Image().src = base64` (decodificação 2×) |
| Canvas do cropper aparece | N/A | Após 2ª decodificação (10–60s) |
| `isImageProcessing` reseta | Após compressão | **Nunca** — se o cropper não abre, trava eternamente |

---

## Solução Restante

A substituição de `FileReader` já foi feita. O que **ainda precisa ser implementado**:

### 1. Timeout de Segurança para `isImageProcessing`
Adicionar fallback para garantir que o estado nunca trave:

```ts
const processFileUpload = (...) => {
    setIsImageProcessing(true);
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    
    // Timeout de segurança — garante reset mesmo se onload/onerror não disparar
    const safetyTimeout = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        setIsImageProcessing(false);
    }, 15_000); // 15s timeout
    
    img.onload = () => {
        clearTimeout(safetyTimeout);
        // ... lógica existente
    };
    img.onerror = () => {
        clearTimeout(safetyTimeout);
        URL.revokeObjectURL(blobUrl);
        setIsImageProcessing(false);
    };
    img.src = blobUrl;
};
```

O mesmo padrão deve ser aplicado em `useCharacterCard.ts`.

### 2. (Opcional) Offload de `toDataURL` via `requestIdleCallback`
Para eliminar o jank de UI durante compressão de imagens grandes no caminho direto (abaixo do limiar):

```ts
const compressAndSave = (img: HTMLImageElement) => {
    requestIdleCallback(() => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            setNewEntityImageUrl(canvas.toDataURL("image/jpeg", 0.7));
        }
        URL.revokeObjectURL(blobUrl);
        setIsImageProcessing(false);
    });
};
```

---

## Arquivos Afetados (Correção Residual)

| Arquivo | Alteração |
|---|---|
| `src/features/session-notes/components/CreateWorldEntityModal.tsx` | Adicionar `setTimeout` de segurança em `processFileUpload`. |
| `src/components/CharacterCard/useCharacterCard.ts` | Adicionar `setTimeout` de segurança em `handleImageUpload`. |

## Fora do Escopo

- `ImageLibraryModal.tsx` — trabalha com URLs públicas do Supabase, sem FileReader local.
- Battlemap / VIControlPanel — upload direto ao Supabase sem Canvas local.
- `SessionTools.tsx` — usa FileReader para upload direto ao Supabase (fora do Canvas local).
- Qualquer alteração no contrato de eventos ou no backend.
- Alteração na lógica de qual imagem abre o cropper (limiares permanecem os mesmos).

---

## Critérios de Aceitação

- [x] Selecionar uma imagem de **qualquer tamanho** (500KB, 10MB, 50MB) em Elementos de Mundo abre o modal de crop em **menos de 1 segundo**.
- [x] O mesmo vale para Imagem de Personagem e Imagem de Item.
- [x] O comportamento para imagens **abaixo do limiar** (≤ 600×600) continua rápido: comprime diretamente, sem abrir o cropper.
- [x] A mensagem `PROCESSANDO...` **nunca** fica travada: sempre desaparece ao confirmar, cancelar, ocorrer erro ou após 15s de timeout.
- [x] A imagem final salva é idêntica em qualidade e formato (JPEG 0.7 ou 0.85 para itens) ao esperado.
- [x] Após confirmar ou cancelar o crop, o blob URL é revogado (sem memory leak em DevTools > Memory).
- [x] O console **não** exibe erros CORS ao usar o `ImageCropper` com blob URLs.
- [x] A experiência de upload volta a ser percebida como "rápida" — equivalente ao comportamento antes da Story 23.

---

## Plano de Ação

1. **`processFileUpload` (`CreateWorldEntityModal`)**: adicionar `setTimeout` de 15s como fallback de reset de `isImageProcessing`. Limpar timeout nos callbacks `onload` e `onerror`.

2. **`handleImageUpload` (`useCharacterCard`)**: mesma adição de timeout de segurança.

3. **Testar**: selecionar imagens de câmera (> 4K), PNG de arte digital (> 10MB), e imagens pequenas (< 300×300) para validar todos os caminhos.

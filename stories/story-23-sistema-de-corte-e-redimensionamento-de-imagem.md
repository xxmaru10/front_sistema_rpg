---
title: "Story 23 - Sistema de Corte e Redimensionamento de Imagem (Image Cropper)"
description: "Implementar uma interface obrigatória de crop e resize para uploads de imagem, garantindo que as artes caibam no escopo pretendido do sistema com ferramentas de ajuste manual e automação para imagens pequenas."
status: "concluído"
priority: "alta"
last_updated: 2026-04-04 (implementado)
tags: [ui, image, upload, ux, canvas]
---

# Story 23 - Sistema de Corte e Redimensionamento de Imagem

## Contexto
Atualmente, as imagens enviadas (uploads) passam por um redimensionamento automático via Canvas que pode cortar partes essenciais ou gerar distorções não controladas pelo usuário. Para elevar o nível premium da interface e garantir integridade visual, o usuário deve ter controle sobre o enquadramento final de suas artes.

## Objetivos
1.  **Componente ImageCropper**: Criar um componente modal especializado que permite ao usuário visualizar a imagem antes do upload final.
2.  **Ferramentas de Ajuste**:
    *   **Crop**: Área de seleção com aspect ratio fixo dependendo do contexto.
    *   **Redimensionamento**: Ferramenta para puxar/escalonar a imagem (Zoom/Scale) e posicioná-la dentro da moldura.
3.  **Lógica Inteligente de Entrada**:
    *   Se a imagem original for **menor** que a região pretendida (ex: < 600x600 para retratos), ela entra automaticamente sem exigir intervenção.
    *   Se for **maior**, a interface de corte é exibida obrigatoriamente.
4.  **Consistência de Saída**: Garantir que o resultado final seja uma imagem JPEG comprimida (0.7 quality) na resolução sugerida pelo contexto.

## Arquivos Afetados
| Arquivo | Alteração |
|---|---|
| `src/components/ImageCropper/ImageCropper.tsx` | **Novo** - Lógica e UI do modal de corte (Canvas API). |
| `src/components/ImageCropper/ImageCropper.styles.tsx` | **Novo** - Estilização Premium (Glassmorphism, Lucide Icons). |
| `src/components/CharacterCard/useCharacterCard.ts` | Integrar cropper no `handleImageUpload`. |
| `src/features/session-notes/hooks/useWorldEntityForm.ts` | Adicionar estado do cropper (`isCropping`, `tempImage`). |
| `src/features/session-notes/components/CreateWorldEntityModal.tsx` | Substituir lógica de upload direto pela abertura do cropper. |

## Critérios de Aceitação
- [x] Ao selecionar uma imagem maior que o sugerido (Portraits 600x600, Mapas 1200x720), o modal de corte abre automaticamente.
- [x] Usuário consegue mover o "frame" ou a imagem e utilizar ferramentas de zoom/redimensionamento.
- [x] Botão de confirmação processa o Canvas e fecha o modal, atualizando o `imageUrl` da entidade.
- [x] Imagens menores que o limite de resolução são processadas automaticamente (sem abrir o modal).
- [x] O visual do modal segue o tema **Cronos Vtt**: fundos obsidiana (#0a0a0a), bordas douradas e animações de fade-in.
- [x] Estado `isImageProcessing` desabilita interações durante o processamento final do Canvas.

## Plano de Ação
1.  **Componente**: Criar `src/components/ImageCropper` com suporte a `aspectRatio` e `suggestedSize`.
2.  **Lógica**: Implementar detecção de tamanho antes de abrir o modal no `CharacterCard` e `CreateWorldEntityModal`.
3.  **UI**: Adicionar botões de Zoom (Lucide `Plus`, `Minus`) e Reset no cropper.
4.  **Saída**: Padronizar o retorno como Base64 JPEG comprimido.

## Não-Escopo
- Filtros de cor (Preto e Branco, Sépia, etc).
- Rotação de imagem.
- Upload de arquivos que não sejam imagem (PDF, TXT).

---
title: Stack Tecnológico
description: Tecnologias, versões e dependências principais deste repositório.
tags: [stack, tecnologia, versões]
repo: frontend
related:
  - /knowledge/architecture.md
last_updated: 2026-04-06 (voice-layout-fix-story-28)
status: estável
---

# Stack

## Tecnologias Kernels
- **Core**: Next.js 15.1.x (App Router)
- **Linguagem**: TypeScript ^5
- **UI Framework**: React 19.0.x
- **Interação 3D**: Three.js ^0.183
- **Supabase**: `@supabase/supabase-js` ^2.90
- **Iconografia**: `lucide-react` ^0.562

## Dependências Principais
| Lib | Propósito |
|---|---|
| `react-player` | Execução de áudio e música atmosférica |
| `uuid` | Geração de IDs únicos para a timeline de eventos |
| `@vercel/analytics` | Monitoramento e performance |

## Convenções de Estilização
- **Vanilla CSS**: CSS-in-JS lite ou modules.
- **Geist Font**: Fonte padrão da Vercel para UI técnica e imersiva.
- **Glassmorphism**: Estilo visual de vidro jateado para painéis do Mestre (VI).

## Configuração do Linter
Configurações localizadas no `tsconfig.json` e no `next.config.ts`.
A maioria das restrições é gerida por regras rígidas de TypeScript e linter nativo do Next.js.

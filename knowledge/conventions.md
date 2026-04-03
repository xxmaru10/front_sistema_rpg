---
title: Convenções de código
description: Padrões de nomenclatura, formatação e estilo adotados neste repositório.
tags: [convenções, código, nomenclatura, estilo]
repo: frontend
related:
  - /knowledge/architecture.md
last_updated: 2026-04-03
status: ativo
---

# Convenções

## Nomenclatura
- **Arquivos**: `kebab-case.ts` (ex: `event-store.ts`) ou `PascalCase.tsx` se for componente.
- **Componentes / Classes**: `PascalCase` (ex: `CombatCard`).
- **Funções e variáveis**: `camelCase` (ex: `handleStressToggle`).
- **Constantes**: `UPPER_SNAKE_CASE` (ex: `DEFAULT_SKILLS`).

## Estrutura de Pastas
- `src/components/ComponentName`: Subpasta contendo o componente principal, seus estilos (`*.styles.tsx`) e sub-componentes.
- `src/lib`: Lógica de domínio, store de eventos e utilities.
- `src/types`: Definições de contratos TS (especialmente `domain.ts`).

## Estilo (CSS)
- Utilizamos **Vanilla CSS** via arquivos `.styles.tsx` com template literals ou in-line JSX style para temas dinâmicos.
- Evitamos TailwindCSS a menos que explicitamente configurado.
- Priorizamos **Aesthetics Premium**: glassmorphism, gradientes suaves e micro-animações.

## Commits
Siga o padrão Conventional Commits:
- `feat:` Para novas funcionalidades.
- `fix:` Correção de bugs.
- `docs:` Alterações em documentação.
- `refactor:` Mudanças que não mudam funcionalidade nem corrigem bug.

## O Que Nunca Fazer
- Não realizar chamadas de API diretamente em componentes. Use `apiClient.ts`.
- Nunca modificar o arquivo `domain.ts` sem atualizar o `api-contract.md` correspondente.
- Jamais commitar arquivos `.env` ou segredos sensíveis.
- **Proibido usar `alert()`** em fluxos de rede ou lógica core; substitua por `console.error` ou toasts não-bloqueantes.
- **Requisições `fetch` sem timeout**: Sempre use `AbortSignal.timeout()` ou AbortController para evitar requisições pendentes infinitas.
- **Estado de UI stuck**: Toda ação de carregamento/estado bloqueado (ex: `isRolling`) deve ter um safety timeout para auto-destravamento.

## UI Patterns
- **Luxury Portal Selection**: Para menus suspensos complexos (dropdowns), utilizar Portais (React Portal) fugindo do contexto de empilhamento local para garantir que menus flutuem acima de chats/logs sem recortes. O estilo deve seguir o padrão vitoriano: fundo sólido (obsidiana #0a0a0a para legibilidade), bordas douradas e animações de fade/slide.


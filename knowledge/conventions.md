---
title: Convenções de código
description: Padrões de nomenclatura, formatação e estilo adotados neste repositório.
tags: [convenções, código, nomenclatura, estilo]
repo: frontend
related:
  - /knowledge/architecture.md
last_updated: 2026-04-18 (story-44 compliance audit and knowledge sync)
status: ativo
---

# Convenções

## Nomenclatura
- **Arquivos**: `kebab-case.ts` (ex: `event-store.ts`) ou `PascalCase.tsx` se for componente.
- **Componentes / Classes**: `PascalCase` (ex: `CombatCard`).
- **Funções e variáveis**: `camelCase` (ex: `handleStressToggle`).
- **Constantes**: `UPPER_SNAKE_CASE` (ex: `DEFAULT_SKILLS`).

## Estrutura de Pastas
- `src/components/ComponentName`: Subpasta contendo o componente principal, seus estilos (`*.styles.tsx`) e sub-componentes especializados.
- `src/features/FeatureName`: Domínios completos que agregam componentes, hooks, estilos e tipos locais em um único diretório para redução de acoplamento global.
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
- **Proibido usar `alert()` ou `confirm()`** em fluxos de rede ou lógica core; substitua por `console.error` ou UI states/Portals não-bloqueantes.
- **Normalização de Identidade**: Todo `userId` deve ser normalizado com `.trim().toLowerCase()` antes de ser incluído em eventos ou comparado localmente para evitar dessincronia de permissão.
- **Autoria de Chat (GM)**: Em mensagens de chat, a identidade técnica (`userId`) deve permanecer normalizada para transporte/comparação; o rótulo exibido do mestre deve usar metadados explícitos de autoria (ex: `authorRole: "GM"`, `authorLabel: "Mestre"`), nunca depender de seleção de personagem.
- **Comparação de autoria em notas**: nunca compare `authorId` bruto com `userId`; normalize ambos (`trim().toLowerCase()`) antes de decidir visibilidade/permissão de editar/apagar.
- **Valores configuráveis de estresse**: toda entrada de valor de caixa de estresse deve ser clampada em `1..1000` tanto na UI quanto no reducer/projeção (nunca confiar somente no input HTML).
- **Requisições `fetch` sem timeout**: Sempre use `AbortSignal.timeout()` ou AbortController para evitar requisições pendentes infinitas.
- **Estado de UI stuck**: Toda ação de carregamento/estado bloqueado (ex: `isRolling`) deve ter um safety timeout para auto-destravamento.

## UI Patterns
- **Luxury Portal Selection**: Para menus suspensos complexos (dropdowns), utilizar Portais (React Portal) fugindo do contexto de empilhamento local para garantir que menus flutuem acima de chats/logs sem recortes. O estilo deve seguir o padr�o vitoriano: fundo s�lido (obsidiana #0a0a0a para legibilidade), bordas douradas e anima��es de fade/slide.
- **Dropdown Viewport-aware**: Em telas de entrada/selecao, dropdowns devem calcular espaco do viewport e abrir para cima quando necessario, com `max-height` adaptativo e scroll touch habilitado para evitar listas inalcan��veis no mobile.
- **Background Image Processing (isImageProcessing)**: Todo upload de imagem que envolva compress�o no cliente (Canvas API) deve implementar um estado de processamento (`isImageProcessing`). Esse estado deve desabilitar o bot�o de submiss�o e exibir feedback visual (ex: "PROCESSANDO...") para evitar que o usu�rio salve o formul�rio antes que a string Base64 final esteja pronta.
- **Drawer Handle Externo**: Em trilhos laterais com avatares compactos, o controle de abrir/fechar deve ficar fora do bloco principal de conte�do sempre que poss�vel. O interior da gaveta deve priorizar apenas os elementos naveg�veis (ex: retratos), evitando deslocamento lateral e polui��o visual do rail.

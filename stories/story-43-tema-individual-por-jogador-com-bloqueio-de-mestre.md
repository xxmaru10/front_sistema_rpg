---
title: "Story 43 - Tema Individual por Jogador com Bloqueio de Mestre"
description: "Permitir que cada jogador escolha seu próprio tema/cor localmente, sem afetar os outros; e adicionar ao Mestre um botão 'SOMENTE MESTRE' que, quando ativado, bloqueia a seleção para todos os jogadores e força o tema global (comportamento atual)."
priority: "média"
status: "concluído"
last_updated: "2026-04-18"
tags: [ui, componente, config, eventsourcing]
epic: epic-01-refatoracao-modular
---

# Story 43 - Tema Individual por Jogador com Bloqueio de Mestre

## Contexto

Hoje, o botão **TEMA** no header despacha eventos PUBLIC (`SESSION_THEME_PRESET_UPDATED`, `SESSION_THEME_UPDATED`) que alteram o tema da sessão para **todos os participantes** simultaneamente. Apenas o Mestre tem o botão visível. A ideia desta story é:

1. Expor o botão TEMA também para **jogadores**, permitindo que cada um escolha seu visual preferido **localmente** (sem afetar os outros).
2. Dar ao Mestre um **botão de bloqueio** ("SOMENTE MESTRE") que, quando ativado, comporta-se exatamente como hoje — o Mestre muda e todos acompanham — e os jogadores perdem a capacidade de alterar seu tema enquanto o bloqueio estiver ativo.

---

## Comportamento Esperado

### Quando o bloqueio está **desativado** (padrão)
| Ator | Pode alterar tema? | Escopo da mudança |
|---|---|---|
| Mestre | Sim | Sessão global (evento PUBLIC — afeta todos) |
| Jogador | Sim | Apenas seu próprio cliente (localStorage) |

- Cada jogador armazena sua preferência no `localStorage` com a chave `cronos_local_theme_{sessionId}_{userId}`.
- A preferência local **sobrepõe** o tema de sessão somente para aquele cliente.
- Jogadores sem preferência local herdaam o tema de sessão normalmente.

### Quando o bloqueio está **ativado** (Mestre clicou em "SOMENTE MESTRE")
| Ator | Pode alterar tema? | Escopo da mudança |
|---|---|---|
| Mestre | Sim | Sessão global (evento PUBLIC) |
| Jogador | **Não** | — botão desabilitado/bloqueado na UI |

- O CSS do jogador é revertido para o tema de sessão global; a preferência local armazenada **não é deletada**, apenas ignorada enquanto o bloqueio estiver ativo.
- Ao desbloquear, a preferência local do jogador volta a ser aplicada automaticamente.

---

## Escopo

### Incluído
- Exibir o botão **TEMA** para jogadores (além do Mestre).
- Mudanças de tema por jogadores são salvas no `localStorage` e aplicadas com um `<style>` de override local (`#theme-player-override`), sem disparar eventos.
- Mudanças de tema pelo Mestre continuam despachando eventos PUBLIC (comportamento atual).
- Novo evento `SESSION_THEME_LOCK_UPDATED` com `payload: { locked: boolean }` — despachado pelo Mestre ao clicar em "SOMENTE MESTRE".
- Botão "SOMENTE MESTRE" visível somente para o Mestre dentro do painel do ThemeSelector.
- Quando `themeLocked === true`, o botão TEMA do jogador aparece **desabilitado** com ícone de cadeado e tooltip explicativo.
- A preferência local do jogador sobrevive ao desbloqueio (é reutilizada).

### Excluído
- Sincronização do tema local do jogador para o banco de dados (é efêmera — localStorage apenas).
- Histórico de temas por jogador.
- Qualquer mudança no tema do Mestre (continua funcionando exatamente como hoje).
- Mudanças no backend / contratos de WebSocket além do novo evento.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `src/types/domain.ts` | Adicionar `SESSION_THEME_LOCK_UPDATED` ao union de eventos; adicionar campo `themeLocked?: boolean` ao tipo `SessionState`. |
| `src/lib/projections.ts` | Adicionar `themeLocked: false` ao estado inicial; handle `SESSION_THEME_LOCK_UPDATED` → `state.themeLocked = payload.locked`. |
| `src/hooks/useHeaderLogic.ts` | Adicionar `themeLocked` ao estado; expor `toggleThemeLock()` nas ações; adicionar estado `localThemePreset` / `localThemeColor` lido do `localStorage`; expor ambos no retorno do hook. |
| `src/components/header/ThemeSelector.tsx` | Adicionar props `isGM`, `themeLocked`, `onLockToggle`, `localPreset`, `localColor`; separar lógica de dispatch (GM→evento, Jogador→localStorage); renderizar botão "SOMENTE MESTRE" para GM; mostrar estado bloqueado para jogador. |
| `src/components/HeaderWrapper.tsx` | Passar `isGM: userRole === "GM"`, `themeLocked`, `onLockToggle`, `localPreset`, `localColor` para `<ThemeSelector>`. |
| `src/app/session/[id]/page.tsx` | Escutar `SESSION_THEME_LOCK_UPDATED` no loop de eventos; quando `themeLocked` muda para `true`, remover `#theme-player-override`; quando muda para `false`, reaplicar preferência local do `localStorage`. |

> **Nenhuma alteração no backend**, exceto o novo tipo de evento que o backend já encaminhará via broadcast por ser PUBLIC.

---

## Detalhe Técnico: Override de CSS Local

O sistema já injeta dois elementos `<style>` em `<head>`:
- `#theme-preset-css` — CSS completo do preset (gerenciado por `page.tsx`)
- `#theme-custom-color-override` — override de cor de acento (gerenciado por `page.tsx`)

Para o tema local do jogador, adicionar um **terceiro** elemento:
- `#theme-player-override` — gerado com o mesmo CSS do `generateThemeCSS()` para o preset local do jogador, mais o override de cor local se houver.

Por vir depois dos outros dois no `<head>`, o `#theme-player-override` naturalmente sobrepõe o tema de sessão. Quando `themeLocked === true` ou o jogador não tem preferência local, esse elemento é **removido** (ou deixado vazio), e o tema de sessão volta a dominar.

---

## Risco Técnico

**Conflito de efeitos entre `page.tsx` e `useHeaderLogic.ts`**: Ambos já manipulam `<style>` elements no `<head>`. O `#theme-player-override` deve ser gerenciado exclusivamente por `useHeaderLogic.ts` (que roda no `HeaderWrapper`, em todas as páginas) para evitar racing conditions com os effects de `page.tsx`. `page.tsx` não deve tocar no `#theme-player-override`.

---

## Critérios de Aceitação

### Botão TEMA para Jogadores
- [x] O botão **TEMA** aparece no header para todos os usuários (Mestre e Jogadores).
- [x] Jogadores conseguem abrir o painel e escolher preset ou cor personalizada.
- [x] A mudança do jogador **não afeta** nenhum outro participante da sessão.
- [x] Ao recarregar a página, a preferência local do jogador é restaurada do `localStorage`.

### Tema Global do Mestre
- [x] O Mestre continua podendo alterar o tema de sessão como hoje (evento PUBLIC, afeta todos).
- [x] O comportamento atual do Mestre **não muda** quando o bloqueio está desativado.

### Botão "SOMENTE MESTRE" (Lock)
- [x] O botão "SOMENTE MESTRE" aparece **apenas** dentro do painel do ThemeSelector do Mestre.
- [x] Ao clicar, despacha `SESSION_THEME_LOCK_UPDATED { locked: true }` (ou `false` para desbloquear).
- [x] O botão reflete o estado atual: visual ativo quando bloqueado, inativo quando desbloqueado.

### Estado Bloqueado — Visão do Jogador
- [x] Quando `themeLocked === true`, o botão TEMA do jogador aparece visualmente desabilitado (ícone de cadeado, cursor não-clicável, tooltip: "Tema bloqueado pelo Mestre").
- [x] O painel do ThemeSelector **não abre** para jogadores enquanto bloqueado.
- [x] O tema visual do jogador é revertido para o tema de sessão do Mestre enquanto bloqueado.

### Desbloqueio
- [x] Quando o Mestre desbloqueia, as preferências locais de cada jogador são reaplicadas automaticamente (sem necessidade de recarregar a página).
- [x] A preferência local **não é apagada** do `localStorage` quando o bloqueio é ativado.

### Consistência
- [x] Um jogador sem preferência local vê o tema de sessão normalmente (com ou sem bloqueio).
- [x] Dois jogadores podem ter temas diferentes simultaneamente quando desbloqueado.

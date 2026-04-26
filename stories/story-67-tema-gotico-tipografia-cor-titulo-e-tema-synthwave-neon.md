---
title: "Story 67 - Tipografia do Gótico, Cor de Título Separada por Tema e Novo Tema Synthwave Neon"
description: "Dividir a paleta do tema em DUAS cores customizáveis (geral + título), aplicar Spectral + Grenze Gotisch ao Gótico, ajustar cores de título de todos os 7 presets existentes, e adicionar novo preset 'Synthwave' com Vampiro One + Titillium Web e efeito neon via text-shadow."
priority: "média"
status: "proposta"
last_updated: "2026-04-26"
tags: [ui, componente, config, eventsourcing]
epic: epic-01-refatoracao-modular
---

# Story 67 - Tipografia do Gótico, Cor de Título Separada por Tema e Novo Tema Synthwave Neon

## Contexto

Hoje cada `ThemePreset` define uma única `accentColor` usada tanto em títulos quanto em UI (botões, bordas), e o painel TEMA expõe um único seletor RGB que sobrescreve essa cor única. Para enriquecer a identidade visual e permitir contraste deliberado entre título e UI, esta story:

1. **Divide logicamente a paleta do tema em duas cores customizáveis**: cor geral (UI/acentos) e cor de título. Mestre e jogador podem customizar cada uma independentemente, com dois seletores RGB no painel TEMA.
2. Ajusta o tema **Gótico** para Spectral (corpo) + Grenze Gotisch (títulos), com título em branco-marfim sobre o sangue.
3. Define cores de título distintas para todos os 7 presets existentes (visual atualizado, não bit-idêntico — usuário aprovou retematizar).
4. Adiciona novo preset **Synthwave** com Vampiro One (títulos) + Titillium Web (corpo) e efeito neon estático nos títulos.

Escopo arquitetural: **plataforma**. Apenas tipografia/cor visual e novos eventos PUBLIC de UI — sem regras de RPG, sem toque em `src/systems/*`.

---

## Comportamento Esperado

### Painel TEMA — dois seletores RGB
Hoje o painel TEMA mostra um seletor RGB (sliders R/G/B + swatch) que sobrescreve a cor de acento do preset selecionado. Após a story:

| Bloco | Função | Evento (Mestre) | Persistência (Jogador) |
|---|---|---|---|
| Seletor de cor **GERAL** | Sobrescreve `--accent-color` (botões, bordas, ornamentos) | `SESSION_THEME_UPDATED` (existente) | `cronos_local_theme_color_{sessionId}_{userId}` (existente) |
| Seletor de cor de **TÍTULO** (novo) | Sobrescreve `--title-color` (h1/h2/h3, títulos de painel) | `SESSION_THEME_TITLE_COLOR_UPDATED` (novo) | `cronos_local_theme_title_color_{sessionId}_{userId}` (novo) |

- Cada bloco tem seu próprio swatch + sliders R/G/B + botão "limpar" (reverte para a cor do preset).
- O lock "SOMENTE MESTRE" da story-43 continua valendo para os **dois** seletores simultaneamente — quando bloqueado, jogador não muda nem cor geral nem cor de título.
- Trocar de preset (`SESSION_THEME_PRESET_UPDATED`) reseta as duas customizações para os defaults do preset (mesma semântica que existe hoje para a cor única).

### Tema Gótico
- `fontHeader: 'Grenze Gotisch', cursive`
- `fontUI: 'Spectral', serif` e `fontNarrative: 'Spectral', serif`
- `accentColor`: continua o vermelho-sangue atual (`#9a031d`).
- `titleColor`: **`#f5f0ea`** (branco-marfim — lê melhor sobre o fundo escuro/sangue do que branco puro; mantém o vibe gótico em vez de parecer "moderno chapado"). Se preferir branco puro, trocar para `#ffffff`.

### Novo preset Synthwave
- `id: "synthwave"`, label `"SYNTHWAVE"`, ícone **`▲`** (triângulo geométrico — coerente com os ícones unicode dos demais temas: `◆ ⚜ ◈ ☠ ✟ ⌖ 💥`).
- `accentColor`: magenta neon `#ff2bd6` (RGB `255, 43, 214`).
- `titleColor`: ciano neon `#00f0ff` (RGB `0, 240, 255`).
- Tipografia:
  - `fontHeader: 'Vampiro One', cursive`
  - `fontNarrative: 'Titillium Web', sans-serif`
  - `fontUI: 'Titillium Web', sans-serif`
  - `googleFontsUrl` cobrindo Vampiro+One e Titillium+Web (pesos 300/400/600/700).
- Efeito **neon** estático nos títulos via `text-shadow` em 3 camadas curtas (sem blur largo, sem keyframes contínuos):
  ```
  text-shadow:
    0 0 4px rgba(0, 240, 255, 0.9),
    0 0 10px rgba(0, 240, 255, 0.6),
    0 0 22px rgba(255, 43, 214, 0.35);
  ```
  Aplicado **somente** em `h1, h2, h3, .display-title` para limitar pintura. Justificativa: 3 sombras curtas custam menos GPU que uma `0 0 80px`; stories 56/58/59/60 já documentam que blur largo em text-shadow pesa fora da arena.
- `bgPattern`: gradient escuro com horizonte rosado/violeta + grid sutil (estático, sem animação).
- `glowAnimation: "none"` — nenhum keyframe contínuo, mantendo o "look" sem regredir performance.

### Cores de título distintas em todos os presets (gosto do agente, sujeito a ajuste)

| Preset | accentColor (geral) | titleColor (título) | Justificativa |
|---|---|---|---|
| Default | `#C5A059` (dourado) | `#F9E79F` (dourado claro) | Hierarquia: títulos brilham mais que UI |
| Medieval | `#C9A84C` (ouro envelhecido) | `#E8DCC8` (pergaminho) | Títulos parecem entalhados em pergaminho |
| Cyberpunk | `#E83050` (vermelho) | `#00D4FF` (ciano) | Aproveita a cor secundária — clássico cyberpunk |
| Pirata | `#C8DD2C` (lima desbotado) | `#E8D5B8` (areia) | Títulos como letreiros antigos pintados na vela |
| Gótico | `#9a031d` (sangue) | `#f5f0ea` (marfim) | Conforme pedido — branco quente sobre sangue |
| Espacial | `#FFFFFF` (branco neutro) | `#FF3060` (vermelho-laser) | Inverte: UI fria + títulos em alerta vermelho |
| Comic | `#FFCC00` (amarelo) | `#FFFFFF` (branco com outline preto) | Títulos `#fff` já existem hoje no bloco do Comic — só formaliza |
| Synthwave (novo) | `#ff2bd6` (magenta) | `#00f0ff` (ciano) | Contraste icônico do gênero |

---

## Escopo

### Incluído

**Tipos e estado**
- Adicionar `titleColor: string` e `titleRgb: string` à interface `ThemePreset` (`themePresets.shared.ts`) e preencher em todos os 8 presets (7 existentes + Synthwave) conforme a tabela acima.
- Estender o tipo `ThemePresetId` com `"synthwave"`; incluir em `THEME_PRESETS` e `THEME_LIST`.
- Estender `SessionState` com `themeTitleColor?: string | null` (paralelo ao `themeColor` existente).
- Adicionar tipo de evento `SESSION_THEME_TITLE_COLOR_UPDATED` ao union em `domain.ts`, com `payload: { color: string | null }`.

**Reducer / projeção**
- Em `projections.ts`, adicionar handler para `SESSION_THEME_TITLE_COLOR_UPDATED` → `state.themeTitleColor = payload.color`.
- Estado inicial: `themeTitleColor: null`.

**Hook do header (`useHeaderLogic.ts`)**
- Expor `themeTitleColor` (vindo do estado).
- Expor `localTitleColor` (lido de localStorage `cronos_local_theme_title_color_{sessionId}_{userId}`).
- Expor ação `setTitleColor(rgb)` que: se Mestre → despacha `SESSION_THEME_TITLE_COLOR_UPDATED`; se Jogador → grava em localStorage e reaplica `#theme-player-override`.
- O `<style id="theme-player-override">` passa a injetar **duas** vars (`--accent-color` e `--title-color`) quando o jogador tiver overrides locais.

**Geração de CSS (`themePresets.ts` → `generateThemeCSS`)**
- Emitir as novas vars `--title-color` e `--title-rgb` em `:root`.
- Trocar `color: var(--accent-color)` para `color: var(--title-color)` em **todas** as regras de título: `h1, h2, h3`, `.display-title`, `.display-title::before/::after` quando exibem cor de texto, `.nav-artifact.active .nav-icon`, `.modal-content h2`, etc. — varrer todos os blocos de tema.
- O `headerTextShadow` derivado deve usar `--title-rgb` em vez de `--accent-rgb`.
- Manter `var(--accent-color)` em botões, bordas, scrollbar, `.solid::before`, ornamentos não-textuais.
- Adicionar bloco condicional `theme.id === 'synthwave'` espelhado nos blocos `gotico`/`espacial` (painéis com borda magenta, títulos com text-shadow neon, sem clip-path pesado, sem keyframes contínuos).

**UI (`ThemeSelector.tsx` + `HeaderWrapper.tsx`)**
- `ThemeSelector` recebe novas props: `themeTitleColor`, `localTitleColor`, `customTitleColorR/G/B`, `onTitleColorChange`, `onTitleColorClear`.
- Layout do painel TEMA:
  - Bloco "COR GERAL" (existente, renomeado/etiquetado).
  - Bloco "COR DE TÍTULO" (novo, abaixo do bloco geral) — mesma estrutura visual: swatch + sliders R/G/B + botão limpar.
  - Botão "SOMENTE MESTRE" abaixo de ambos (não duplica).
- Quando `themeLocked === true` para jogador, ambos os blocos ficam desabilitados igualmente.
- `HeaderWrapper` repassa as novas props vindas do hook.

**Página de sessão (`page.tsx`)**
- Adicionar listener para `SESSION_THEME_TITLE_COLOR_UPDATED` no loop de eventos, paralelo ao `SESSION_THEME_UPDATED` existente.
- Quando `state.themeTitleColor` muda, atualizar `#theme-custom-color-override` (ou criar `#theme-custom-title-color-override` separado) com a regra `:root { --title-color: <hex>; --title-rgb: <r,g,b>; }`.
- A precedência continua: preset (`#theme-preset-css`) → override do Mestre (`#theme-custom-*-override`) → override local do jogador (`#theme-player-override`).

### Excluído
- Migração de eventos antigos no event-store (mesas existentes simplesmente terão `themeTitleColor = null` até o Mestre tocar no novo seletor).
- Persistir `themeTitleColor` em snapshot fora do que já é coberto pelo mecanismo de snapshot atual da `SessionState` (entra "de graça" pelo campo novo).
- Mudanças em `src/systems/*`, em backend além do encaminhamento PUBLIC do novo evento (que o broadcaster já faz por contrato), ou no schema de banco.
- Customização de **fontes** pelo usuário (continua sendo prerrogativa do preset).
- Animações pesadas/keyframes contínuos no Synthwave.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| `src/lib/themePresets.shared.ts` | Adicionar `titleColor` + `titleRgb` à interface; preencher em todos os 7 presets existentes (cores conforme tabela); atualizar tipografia + título-branco do `GOTICO`; adicionar novo `SYNTHWAVE`; estender `ThemePresetId`, `THEME_PRESETS`, `THEME_LIST`. |
| `src/lib/themePresets.ts` | Em `generateThemeCSS`: emitir `--title-color` e `--title-rgb`; trocar regras de cor de título para `var(--title-color)`; adicionar bloco condicional do tema `synthwave`. |
| `src/types/domain.ts` | Adicionar `SESSION_THEME_TITLE_COLOR_UPDATED` ao union de eventos; adicionar `themeTitleColor?: string \| null` em `SessionState`. |
| `src/lib/projections.ts` | Estado inicial recebe `themeTitleColor: null`; handler do novo evento atualiza `state.themeTitleColor`. |
| `src/hooks/useHeaderLogic.ts` | Adicionar leitura de `themeTitleColor` do estado; ler `localTitleColor` do localStorage; expor `setTitleColor`/`clearTitleColor`; estender `#theme-player-override` para cobrir as duas vars. |
| `src/components/header/ThemeSelector.tsx` | Receber novas props; renderizar segundo bloco de RGB (cor de título) com swatch + sliders + clear; aplicar lock unificado. |
| `src/components/HeaderWrapper.tsx` | Repassar as novas props do hook ao seletor. |
| `src/app/session/[id]/page.tsx` | Listener para `SESSION_THEME_TITLE_COLOR_UPDATED`; atualizar `<style>` de override de cor de título quando mudar; reaplicar precedência ao trocar preset/lock. |

> **Backend**: nenhuma mudança de código — o broadcaster encaminha o novo evento PUBLIC pelo mesmo canal dos demais `SESSION_*_UPDATED`. Confirmar no PR que o tipo é aceito sem allowlist no backend; se houver allowlist, adicionar.

---

## Detalhes Técnicos

### Variáveis CSS introduzidas
```css
:root {
    --title-color: <theme.titleColor>;
    --title-rgb:   <theme.titleRgb>;
    /* --accent-color e --accent-rgb continuam, agora exclusivos para UI */
}
```

### Precedência dos `<style>` overrides (mantida da story-43)
1. `#theme-preset-css` — gerado por `generateThemeCSS(preset)`
2. `#theme-custom-color-override` — override de cor geral do Mestre (existente)
3. `#theme-custom-title-color-override` — override de cor de título do Mestre (**novo**)
4. `#theme-player-override` — override local do jogador, cobrindo cor geral **e** título numa só regra

### Risco técnico: vazamento `--accent-color` em títulos
Vários blocos de tema usam `color: var(--accent-color)` em regras que cobrem títulos junto com UI (ex.: `.nav-artifact.active .nav-icon`, `.combat-card h3` no Comic). Antes do PR, varrer `themePresets.ts` por `var(--accent-color)` e classificar cada ocorrência: **título** (troca para `--title-color`) ou **UI** (mantém). Validar visualmente cada um dos 8 presets nas telas: arena, ficha, notas, header, modais, status bar.

### Risco técnico: ordem dos `<style>` no `<head>`
A precedência depende da ordem de inserção. A story-43 já fixou que `#theme-player-override` é gerenciado exclusivamente por `useHeaderLogic.ts` e vem por último. O **novo** `#theme-custom-title-color-override` deve ser inserido por `page.tsx` (mesmo lugar que `#theme-custom-color-override`) e **antes** do player-override. Documentar isso no comentário do effect.

### Fontes — `googleFontsUrl` do Gótico e do Synthwave
- Gótico: `https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`
- Synthwave: `https://fonts.googleapis.com/css2?family=Vampiro+One&family=Titillium+Web:wght@300;400;600;700&display=swap`

Validar no Network do DevTools que ambos retornam 200 e as famílias `font-display: swap`.

---

## Critérios de Aceitação

### Estrutura de duas cores
- [ ] `ThemePreset` declara `titleColor` e `titleRgb`.
- [ ] `SessionState` tem campo `themeTitleColor`.
- [ ] Existe evento `SESSION_THEME_TITLE_COLOR_UPDATED` com payload `{ color: string | null }`, projetado em `state.themeTitleColor`.
- [ ] `:root` recebe `--title-color` e `--title-rgb` via `generateThemeCSS()`.
- [ ] Todos os títulos (`h1, h2, h3`, `.display-title`) consomem `var(--title-color)`. Botões, bordas e scrollbar continuam em `var(--accent-color)`.

### Painel TEMA — dois seletores
- [ ] O painel mostra dois blocos rotulados ("COR GERAL" e "COR DE TÍTULO"), cada um com swatch + sliders R/G/B + botão limpar.
- [ ] Mestre alterando "COR GERAL" → afeta todos (evento PUBLIC `SESSION_THEME_UPDATED`).
- [ ] Mestre alterando "COR DE TÍTULO" → afeta todos (evento PUBLIC `SESSION_THEME_TITLE_COLOR_UPDATED`).
- [ ] Jogador alterando qualquer dos dois → afeta apenas seu cliente (localStorage + `#theme-player-override`).
- [ ] Trocar de preset reseta as duas customizações.
- [ ] Quando o lock "SOMENTE MESTRE" está ativo, **ambos** os seletores ficam desabilitados para jogador.
- [ ] Botão "limpar" em cada bloco reverte aquela cor para o default do preset, sem afetar a outra.

### Tema Gótico
- [ ] Títulos em **Grenze Gotisch**.
- [ ] Corpo em **Spectral**.
- [ ] Cor de título default = `#f5f0ea` (branco-marfim) sobre o sangue `#9a031d`.
- [ ] Fontes carregam (Network 200, sem flash de fonte fallback prolongado).

### Tema Synthwave
- [ ] Aparece no `ThemeSelector` (vem de `THEME_LIST`); ícone exibido é `▲`, não emoji.
- [ ] Títulos em **Vampiro One** com efeito neon (3 camadas de text-shadow ciano+magenta).
- [ ] Corpo em **Titillium Web**.
- [ ] Cor de título default = ciano `#00f0ff`; cor geral default = magenta `#ff2bd6`.
- [ ] DevTools → Performance: `Recalculate Style` ocioso ao trocar Default→Synthwave não cresce além de ±5%; nenhum keyframe contínuo exclusivo do tema.

### Cores de título dos demais presets
- [ ] Cada um dos 7 presets existentes recebe a `titleColor` da tabela; visualmente os títulos passam a ter a nova cor proposta. (Mestre pode sobrescrever via seletor, conforme acima.)

### Compatibilidade
- [ ] Sessões legadas com `themeTitleColor` ausente/`null` renderizam com a cor de título do preset (sem erro).
- [ ] Recarregar a página preserva: preset selecionado, cor geral do Mestre, cor de título do Mestre, override local do jogador para ambas, lock.
- [ ] Nenhum erro novo no console em qualquer dos 8 presets.

---

## Escopo final (para o resumo do PR)
`escopo: plataforma` — estende contrato de eventos PUBLIC com `SESSION_THEME_TITLE_COLOR_UPDATED`, divide a paleta do tema em duas cores customizáveis e adiciona um novo preset. Sem toque em sistemas/plugins (`src/systems/*`).

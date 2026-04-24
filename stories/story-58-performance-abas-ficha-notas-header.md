---
title: "Story 58 - Performance Fora da Arena por Aba (fase visual pos-Story 59)"
description: "A Story 59 removeu o churn de JavaScript principal no mobile. O problema restante esta concentrado em Rendering/Painting fora da arena: tema animado, header/banner fora da arena, CharacterCard pesado no modo player e custo visual da aba de notas. Esta story deve atacar apenas a camada visual e de paint/layout do DOM, sem reabrir VoiceChat, MusicPlayer, WebRTC ou arena."
priority: "critica"
status: "aberta"
last_updated: "2026-04-23"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100", "story-56-performance-shell-visual-ficha-notas", "story-59-rerender-cascata-musicplayer-main-thread"]
tags: [performance, ui, css, mobile, rendering, painting]
epic: epic-01-refatoracao-modular
---

# Story 58 - Performance Fora da Arena por Aba (fase visual pos-Story 59)

## Estado Atual

Esta story precisa partir do estado mais recente do projeto, nao do estado original da investigacao.

### O que ja foi resolvido antes desta story

- Story 59 ja removeu o churn principal de JS no shell:
  - `YT_MOUNT` repetido sumiu
  - `voice-join -> broadcast` em loop sumiu
  - polling desnecessario de Screen Share sumiu
  - custo de `youtube.com` no main thread caiu para zero no trace mais recente
- O autoscroll de notas ja foi corrigido:
  - `useSessionNotesDiary.ts` nao tem mais `useEffect` sem dependencias
  - o efeito atual roda com dependencias explicitas em `lastVisibleNoteId`, `notesSubTab`, `filterAuthor` e `selectedPrivateFolderId`
- O `notes-editor-area` principal ja esta sem blur:
  - `SessionNotes.css` ja esta com `backdrop-filter: none` nesse bloco

Conclusao obrigatoria para quem implementar:

> Nao reabrir Story 59. Nao reimplementar o bugfix do autoscroll. Nao perder tempo "removendo blur" da `notes-editor-area`, porque esse ponto ja foi feito.

### Evidencia nova que motivou esta revisao

Arquivos de referencia:

- `front_sistema_rpg/DEBUG_CELULAR/Trace-20260423T180155.json`
- `front_sistema_rpg/DEBUG_CELULAR/logs_travamento_geral_site.txt`
- `front_sistema_rpg/DEBUG_CELULAR/Screenshot_1.png`

Leitura consolidada do estado atual:

- arena segue fluida no celular
- fichas, notas e shell fora da arena ainda apresentam lag perceptivel
- o log de console ficou limpo, sem os sinais de churn de JS anteriores
- o gargalo restante migrou para Rendering/Painting

Indicadores do profile mais recente:

| Metrica | Valor atual |
|---|---:|
| Scripting | ~1015 ms |
| Rendering | ~921 ms |
| Painting | ~376 ms |
| INP | ~2169 ms |

Leitura pratica:

- o gargalo principal deixou de ser logica/loop
- o gargalo restante esta em custo visual do DOM e tamanho/pintura da arvore fora da arena

---

## Diagnostico Canonico Desta Story

Esta story deve atacar somente a camada restante:

1. animacoes continuas de tema e overlays globais
2. header/banner fora da arena
3. peso visual do `CharacterCard` no modo player
4. custo de paint da lista de notas e de alguns dropdowns/strips da aba de notas

Esta story **nao** deve:

- tocar em `VoiceChatManager.ts`
- tocar em `MusicPlayer.tsx`
- tocar em WebRTC
- tocar em `screen-share-manager.ts`
- tocar em `Battlemap`, `CombatTab`, `FateDice3D` ou qualquer render da arena
- trocar `CharacterCard` por `CharacterSummary` para PCs
- virtualizar lista, paginar, lazy-mount estrutural ou redesenhar UX inteira

Se esta story falhar em bater a meta, o desdobramento correto sera uma **Story 60** focada em estrategia estrutural de renderizacao/DOM size. Nao reutilizar o numero 59, porque a Story 59 ja foi consumida pelo problema de churn JS.

---

## Mapa de Causa por Arquivo

### 1. Tema animado ainda esta mal fechado no runtime

Arquivos:

- `src/lib/themePresets.ts`
- `src/app/session/[id]/page.tsx`

Achado importante:

- `themePresets.ts` ja contem o seletor `body:not([data-disable-theme-animation="true"])`
- porem nao existe nenhum lugar no source atual setando `data-disable-theme-animation`

Isso significa:

- existe um kill switch no CSS
- mas ele esta morto no runtime

Animacoes continuas que devem ser consideradas candidatas reais:

- `medieval-ember`
- `medieval-glow`
- `cyber-flicker`
- `cyber-glow-pulse`
- `starry-drift`
- `neon-pulse`
- `pirate-firelight`
- overlay fixo `body::after` no tema cyberpunk

Regra de implementacao:

- adicionar um `useEffect` em `src/app/session/[id]/page.tsx` para setar/remover `document.body.dataset.disableThemeAnimation`
- comportamento exigido:
  - em device touch/coarse pointer ou viewport mobile: sempre `true`
  - em desktop: `true` fora da arena, `false` apenas quando fizer sentido manter a animacao
- cleanup obrigatorio no `return` do effect

Nao deixar a proxima AI adivinhar o gatilho. O objetivo aqui e:

- mobile: desligar animacao de tema sempre
- desktop fora da arena: desligar animacao global do body
- desktop na arena: manter se ainda fizer sentido

### 2. Header fora da arena ainda pinta imagem grande demais

Arquivo:

- `src/components/SessionHeader.tsx`

Estado atual relevante:

- `SessionHeader` fora da arena usa container com borda/sombra leve
- quando ha `imageUrl`, ainda pinta um banner inteiro via `backgroundImage: linear-gradient(...), url(imageUrl)`
- isso continua sendo caro fora da arena em celular

Regra de implementacao:

- manter desktop como esta, salvo micro simplificacoes leves
- em mobile/coarse pointer, fora da arena:
  - nao usar `url(imageUrl)` como background do banner
  - substituir por gradiente estatico simples
  - reduzir `headerHeight`
  - remover ou reduzir fortemente `boxShadow`
  - remover transicao de `box-shadow`/`border-color`

Objetivo:

- manter o header funcional
- parar de pintar uma imagem grande e um shell ornamental inteiro fora da arena no celular

Nao redesenhar o header inteiro. Apenas aplicar um modo mobile/perf mais barato.

### 3. `CharacterCard` ainda e pesado no idle do modo player

Arquivos:

- `src/components/CharacterCard/CharacterCard.css`
- `src/components/session/CharactersTab.tsx`

Estado atual relevante:

- `.char-artifact` continua com sombra base permanente
- `.tarot-inner` continua com `inset` glow permanente
- `.char-artifact:hover` ainda adiciona glow/sombra forte
- `.inventory-floating` aparece definida em dois blocos diferentes no CSS
- o `min-width` da ficha principal ja e `760px`, nao `820px`
- em `@media (max-width: 1024px)` a ficha ja vai para `min-width: 100%`

Leitura correta:

- o problema nao e mais "corrigir um min-width gigante"
- o problema agora e custo visual por instancia
- a proxima AI nao deve perder tempo tentando "consertar largura"; o custo maior esta em sombra, inset, blur, hover glow e paint do card inteiro

Regras de implementacao:

1. Em `.char-artifact`
   - adicionar `content-visibility: auto` sob `@supports (content-visibility: auto)`
   - adicionar `contain-intrinsic-size` razoavel para evitar jump visual
   - reduzir sombra base
   - em mobile/coarse pointer, remover `transition: all`

2. Em `.tarot-inner`
   - reduzir ou remover os `inset` permanentes no mobile/coarse pointer
   - manter desktop com visual aceitavel

3. Em `.char-artifact:hover`
   - neutralizar hover glow/hover lift em mobile/coarse pointer
   - tocar tambem em outros `:hover` que so servem a desktop e adicionam sombra/transform custosos

4. Em `.inventory-floating`
   - este seletor aparece em dois blocos no arquivo
   - a proxima AI precisa tratar isso explicitamente
   - criar um override final, no fim do arquivo, para mobile/coarse pointer:
     - `backdrop-filter: none`
     - sombra simples ou nenhuma
     - sem `inset`
     - sem hover glow
     - garantir layout barato e previsivel

5. Em `CharactersTab.tsx`
   - nao trocar PCs por resumo
   - nao mudar UX
   - nao paginar
   - nao virtualizar
   - so microajustes se forem estritamente necessarios para estabilizar a lista

Observacao importante para a outra AI:

> Se mexer em `CharacterCard.css`, revisar o arquivo inteiro para seletores duplicados do mesmo bloco visual. Nao confiar que o primeiro bloco e o que vence na cascata.

### 4. Notas ainda tem custo visual de lista e de overlays

Arquivos:

- `src/features/session-notes/SessionNotes.css`
- `src/features/session-notes/SessionNotes.tsx`
- `src/features/session-notes/components/NotesTab.tsx`

Estado atual relevante:

- `.notes-editor-area` ja esta sem blur: nao mexer nisso como prioridade
- `.note-entry` ainda tem hover com `transform` e `box-shadow`
- `.notes-tabs-main` e `.main-tab-trigger` ainda tem transicoes/realces
- `.world-filters-dropdown` ainda usa `backdrop-filter: blur(12px)`
- existem menus globais/portal dropdowns que podem somar custo durante interacao

Regra de implementacao em duas etapas:

#### Etapa A - Superficies sempre presentes

Implementar primeiro:

- `.note-entry`
  - adicionar `content-visibility: auto` sob `@supports`
  - adicionar `contain-intrinsic-size`
  - em mobile/coarse pointer:
    - remover `transform: translateX(...)` do hover
    - remover `box-shadow` do hover
    - simplificar transicao

- `.notes-tabs-main`
  - simplificar background se necessario
  - reduzir custo de hover/transition em mobile/coarse pointer

- `.main-tab-trigger`
  - reduzir transicao
  - neutralizar hover intensivo em touch/coarse pointer

#### Etapa B - Overlays de interacao

So fazer se, depois da Etapa A, o profile ainda mostrar custo alto ao abrir menus:

- `.world-filters-dropdown`
  - remover `backdrop-filter` no mobile/coarse pointer
  - simplificar `box-shadow`

- outros dropdowns/portal menus da aba
  - aplicar a mesma regra: sem blur no mobile/coarse pointer

Nao priorizar nesta story:

- `.modal-overlay` de modais raros
- efeitos de tela que nao aparecem no idle padrao

Ou seja:

> Primeiro consertar o que esta sempre montado. So depois mexer no que aparece sob clique.

---

## Ordem Obrigatoria de Implementacao

Seguir nesta ordem. Nao inverter.

### Passo 1 - Ativar de verdade o kill switch de animacao de tema

Arquivos:

- `src/app/session/[id]/page.tsx`
- `src/lib/themePresets.ts`

Checklist:

- setar `data-disable-theme-animation` no `body`
- desligar animacoes continuas em mobile/coarse pointer
- desligar animacao global fora da arena
- manter arena intacta

### Passo 2 - Aplicar modo mobile/perf no `SessionHeader`

Arquivo:

- `src/components/SessionHeader.tsx`

Checklist:

- fora da arena + mobile/coarse pointer:
  - sem `url(imageUrl)` no background
  - gradiente estatico
  - altura menor
  - sombra menor ou zero
  - sem transicao ornamental

### Passo 3 - Aplicar corte de paint na ficha do player

Arquivo:

- `src/components/CharacterCard/CharacterCard.css`

Checklist:

- `content-visibility` em `.char-artifact`
- `contain-intrinsic-size`
- reduzir sombra base
- reduzir/remover `inset` de `.tarot-inner` em mobile
- neutralizar hover pesado em touch/mobile
- resolver override final de `.inventory-floating`

### Passo 4 - Aplicar corte de paint na lista de notas

Arquivo:

- `src/features/session-notes/SessionNotes.css`

Checklist:

- `content-visibility` em `.note-entry`
- `contain-intrinsic-size`
- cortar hover transform/shadow no mobile
- simplificar tabs strip e tab trigger em touch/mobile

### Passo 5 - So se necessario: limpar dropdowns de notas

Arquivo:

- `src/features/session-notes/SessionNotes.css`

Checklist:

- remover blur de `.world-filters-dropdown`
- remover blur de outros portal menus da aba apenas no mobile/coarse pointer

---

## Instrucoes de Implementacao Bem Objetivas

Estas instrucoes existem para uma AI mais literal nao sair mexendo em coisa errada.

### Regra 1

Nao editar `useSessionNotesDiary.ts` para "corrigir autoscroll". Isso ja esta resolvido.

### Regra 2

Nao editar `VoiceChatManager.ts`, `MusicPlayer.tsx` ou qualquer codigo da Story 59.

### Regra 3

Nao editar `screen-share-manager.ts`, `TransmissionPlayer`, `VoiceChatPanel`, `HeaderWrapper` ou WebRTC por causa desta story.

### Regra 4

Se um seletor tiver duas definicoes no mesmo CSS, a implementacao tem que garantir override final explicito. O caso mais importante e `.inventory-floating` em `CharacterCard.css`.

### Regra 5

Toda reducao agressiva de brilho/hover/blur deve ser limitada a:

- `@media (max-width: 1024px)`
- ou `@media (hover: none), (pointer: coarse)`
- ou ambos

Nao matar o visual desktop sem necessidade.

### Regra 6

Usar `@supports (content-visibility: auto)` para os ganhos de viewport culling:

- `.char-artifact`
- `.note-entry`

Nao aplicar `content-visibility` em overlays absolutos, menus portalizados ou modais.

### Regra 7

Nao abrir novo escopo de UX:

- sem trocar ficha completa por resumo
- sem virtualizacao
- sem pagina
- sem lazy mount estrutural
- sem reordenar tabs

Se isso ainda for necessario depois, vira Story 60.

---

## Criterios de Aceitacao

### Funcionais

- [ ] Nada da Story 59 regressou
- [ ] `YT_MOUNT` continua ausente do debug
- [ ] `voice-join -> broadcast` continua ausente em idle
- [ ] arena continua fluida e sem regressao perceptivel
- [ ] header, notas e ficha continuam utilizaveis

### Tecnicos

- [ ] `data-disable-theme-animation` esta efetivamente sendo setado/removido no runtime
- [ ] mobile/coarse pointer nao executa animacao continua de tema
- [ ] `.char-artifact` recebeu `content-visibility` com `contain-intrinsic-size`
- [ ] `.note-entry` recebeu `content-visibility` com `contain-intrinsic-size`
- [ ] `.inventory-floating` mobile nao usa blur nem sombra pesada
- [ ] `.world-filters-dropdown` so entra no escopo se a Etapa A nao bastar

### Perfil de Performance

Comparado com `Trace-20260423T180155.json`:

- [ ] `Scripting` nao pode subir mais de 10%
- [ ] `Rendering` deve cair de forma mensuravel
- [ ] `Painting` deve cair de forma mensuravel
- [ ] INP deve melhorar no mesmo cenario de teste
- [ ] a percepcao subjetiva no celular deve ser de menor lag em ficha/notas/header

Metas praticas sugeridas para o mesmo cenario:

- `Rendering` <= 650 ms
- `Painting` <= 250 ms
- `INP` < 1400 ms

Se bater melhora clara mas nao atingir a meta absoluta, registrar o delta exato no ticket antes de decidir o proximo passo.

### Qualidade

- [ ] `next build` sem warnings novos
- [ ] `tsc --noEmit` limpo
- [ ] sem regressao visual grave em desktop

---

## Validacao Obrigatoria

Testar nesta ordem:

1. celular do Mestre, mesmo cenario do trace `18:01:55`
2. abrir ficha
3. abrir notas
4. alternar entre abas fora da arena
5. coletar novo trace curto
6. comparar com `Trace-20260423T180155.json`

Somente depois:

7. validar no notebook da jogadora

---

## Criterio de Saida

Se depois desta story ainda houver lag claro fora da arena, e o novo trace continuar marcando `Optimize DOM size` ou painting alto, abrir:

**Story 60 - Estrategia Estrutural de Renderizacao Fora da Arena**

Escopo da futura Story 60:

- reduzir DOM total da ficha do player
- possivel modo resumido para PCs nao vinculados
- virtualizacao/lazy mount estrutural
- revisao de viewport culling mais agressivo

Essa parte fica fora da Story 58.

---

## Resumo Executivo

Depois da Story 59, o problema fora da arena deixou de ser JS e passou a ser visual.

Portanto, a Story 58 agora deve ser tratada como:

> "cortar animacao global, cortar banner caro fora da arena, baratear o shell visual da ficha e aplicar viewport culling nas listas visiveis"

Se a proxima AI seguir esta story literalmente, ela nao deve tocar em VoiceChat, MusicPlayer, autoscroll de notas nem arena. O alvo correto agora e Rendering/Painting do DOM.

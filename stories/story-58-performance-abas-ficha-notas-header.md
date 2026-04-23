---
title: "Story 58 - Performance Fora da Arena por Aba (Notas, Ficha, Header e Tema)"
description: "Revisar a investigação de performance fora da arena com base no código atual. A story 56 ficou parcialmente desatualizada: parte do shell genérico já foi simplificada, mas Notas, Ficha (modo player) e Header/banner fora da arena ainda concentram custo de CPU/GPU/RAM. Escopo: SessionNotes, useSessionNotesDiary, CharactersTab/CharacterCard, SessionHeader e temas animados do body. Não tocar em Three.js, battlemap, WebRTC nem lógica de combate."
priority: "alta"
status: "em-revisão"
last_updated: "2026-04-23"
related: ["story-54-performance-transmissao-voz-e-render-cpu-100", "story-56-performance-shell-visual-ficha-notas"]
tags: [performance, ui, react, css, bugfix]
epic: epic-01-refatoracao-modular
---

# Story 58 - Performance Fora da Arena por Aba (Notas, Ficha, Header e Tema)

## Contexto

Medições do Mestre em desktop potente, realizadas em **2026-04-23**, sem ainda validar no notebook fraco da jogadora:

| Cenário | GPU | CPU | RAM |
|---|---:|---:|---:|
| Ficha (idle) | ~13% | ~6% | ~650 MB |
| Notas (idle) | ~10% | ~5% | ~650 MB |
| Arena vazia | ~0% | ~0% | ~650 MB |
| Arena com screen share + voz + YouTube | ~2,1% | ~1,5% | ~431 MB |

Esses números mostram que o problema fora da arena **não é mais explicável apenas pelo shell visual genérico** descrito na story 56. A arena, mesmo com battlemap/render/WebRTC ativos, está custando menos que telas de DOM rico. O custo agora parece **distribuído por aba**:

- **Notas**: editor rico + blur fixo + hook com efeito sem dependências.
- **Ficha**: `CharacterCard` completo renderizado em lote no modo player (apenas para PCs; NPCs usam `CharacterSummary`, que é leve).
- **Header fora da arena**: banner de 300 px com imagem de fundo + gradiente, **apenas quando há `imageUrl` de capa**.
- **Tema**: animações globais de `body` quando presets animados estão ativos.

## Leitura Estática Consolidada (verificada no código em 2026-04-23)

### 1. As abas são montadas condicionalmente

Em [page.tsx:851-959](/src/app/session/[id]/page.tsx:851), `SessionNotes`, `CharactersTab`, `CombatTab`, `LogTab` e `BestiaryTab` são montados por `activeTab === ...`.

Isso confirma que a queda de RAM ao entrar na arena pode vir de **unmount real da árvore React**, não apenas de CSS.

### 2. A story 56 ficou parcialmente desatualizada

O `SessionHeader` atual já está bem mais leve do que o estado descrito na story 56:

- [SessionHeader.tsx:96-98](/src/components/SessionHeader.tsx:96) usa `1px solid rgba(var(--accent-rgb), 0.38)` e `0 0 12px rgba(var(--accent-rgb), 0.24)`.
- O estado antigo citado na story 56 falava em bordas mais grossas e glow mais agressivo (3px + duplo inset).

Além disso, parte dos blurs genéricos do shell principal já foi zerada:

- [session.css:49](/src/app/session/[id]/session.css:49) `backdrop-filter: none` em `.screenshare-refresh-btn`
- [session.css:130-131](/src/app/session/[id]/session.css:130) `backdrop-filter: none` em `.gm-sidebar-vertical`
- [session.css:772-773](/src/app/session/[id]/session.css:772) `backdrop-filter: none` em `.nav-expanded-shell`

Ou seja, a story 56 segue útil como histórico parcial, mas **não representa mais o principal gargalo atual**.

### 3. Notas tem um culpado concreto de CPU, além do custo visual

Em [useSessionNotesDiary.ts:52-68](/src/features/session-notes/hooks/useSessionNotesDiary.ts:52):

```ts
useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
});
```

Esse efeito:

- roda **em todo render**;
- escreve em `scrollTop`;
- pode forçar **reflow/layout** continuamente;
- explica melhor o CPU idle em Notas do que uma hipótese apenas visual.

Na mesma aba, o editor principal ainda mantém blur fixo em [SessionNotes.css:812-817](/src/features/session-notes/SessionNotes.css:812):

```css
.notes-editor-area {
    ...
    backdrop-filter: blur(15px);
}
```

Portanto, em Notas o quadro provável é **CPU por efeito mal condicionado + GPU por blur persistente**.

### 4. Ficha do player continua cara pela quantidade e peso do `CharacterCard`

Em [CharactersTab.tsx:100-139](/src/components/session/CharactersTab.tsx:100), há uma divisão explícita por tipo de personagem:

- **PCs (não-NPCs)** são renderizados como `CharacterCard` completo em [CharactersTab.tsx:106](/src/components/session/CharactersTab.tsx:106).
- **NPCs** usam `CharacterSummary` em [CharactersTab.tsx:90](/src/components/session/CharactersTab.tsx:90), que é um cartão compacto.

Portanto, o custo dominante está **somente na lista de PCs**. O shell base do `CharacterCard` é pesado:

- [CharacterCard.css:1-12](/src/components/CharacterCard/CharacterCard.css:1) `box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8)`
- [CharacterCard.css:31-40](/src/components/CharacterCard/CharacterCard.css:31) `.tarot-inner` com `inset 0 0 50px rgba(0, 0, 0, 1)` + `inset 0 0 20px rgba(var(--accent-rgb), 0.05)`
- [CharacterCard.css:6](/src/components/CharacterCard/CharacterCard.css:6) `min-width: 820px`

Isso sugere custo acumulado por:

- renderização de **vários cards completos de PCs** (número cresce linearmente com o grupo);
- sombras e `inset` permanentes por card;
- layout largo/ornamentado mesmo em idle.

Como NPCs já usam `CharacterSummary`, não há ganho esperado em tocar na lista de NPCs.

### 5. Header fora da arena pinta um banner grande **quando há imagem de capa**

Em [SessionHeader.tsx:94](/src/components/SessionHeader.tsx:94) o componente faz *early return* se não houver `imageUrl`, `isGM`, `videoStream` ou `children`. E em [SessionHeader.tsx:117-131](/src/components/SessionHeader.tsx:117), o banner com `backgroundImage` + overlay de gradiente só é renderizado quando `imageUrl && !isArena`.

Portanto:

- container sempre tem **300 px de altura** fora da arena (com borda/shadow leves);
- `backgroundImage` + gradiente só pesam **quando a mesa define capa**;
- se a sessão atual não tem capa, o item 5 deixa de ser hipótese relevante e o custo cai para a borda/shadow base.

A Prova 3 precisa registrar se a mesa de teste tem capa definida antes de medir.

### 6. Tema animado pode somar custo global fora da arena

Em [themePresets.ts:794-809](/src/lib/themePresets.ts:794), o preset espacial ainda pode animar o `body` com `starry-drift 60s linear infinite` quando `prefers-reduced-motion: no-preference`. O gating por `prefers-reduced-motion` já foi introduzido pela story 56 e **deve ser mantido**.

Isso não explica sozinho Ficha/Notas, mas pode amplificar o problema quando o tema animado estiver ativo. Registrar no ticket qual tema a mesa usa antes de medir.

### 7. Os blurs mais pesados restantes estão concentrados na arena

Os blurs mais fortes hoje visíveis em `session.css` estão em componentes de combate, por exemplo:

- [session.css:1543-1544](/src/app/session/[id]/session.css:1543) `.combat-avatar-drawer-handle`
- [session.css:1732-1733](/src/app/session/[id]/session.css:1732) `.combat-dice-integrated`

Como a arena está mais leve que Ficha/Notas nos testes, esses elementos **não são o foco desta story**.

## Diagnóstico Consolidado

| Área | Causa dominante provável |
|---|---|
| Notas | `useEffect` sem dependências em `useSessionNotesDiary` + `blur(15px)` no editor |
| Ficha (modo player) | `CharacterCard` completo renderizado em lote para PCs + sombras/insets permanentes por card |
| Header fora da arena | Banner de 300 px com imagem + gradiente (**somente se a mesa tem capa**) |
| Tema espacial | `starry-drift` no `body` quando o preset está ativo |

## Provas Rápidas Antes de Implementar

### Prova 1 - Remover blur do editor de Notas no DevTools

Aplicar override temporário:

```css
.notes-editor-area {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
```

Medir **GPU e CPU** por 30s na aba Notas.

**Expectativa**: queda parcial de GPU; CPU pode cair pouco se o efeito sem deps continuar sendo o gargalo principal.

### Prova 2 - Desabilitar temporariamente o autoscroll do diário

Em build local temporária, comentar ou condicionar o efeito de [useSessionNotesDiary.ts:64-68](/src/features/session-notes/hooks/useSessionNotesDiary.ts:64) apenas para medição.

**Expectativa**: queda material de CPU idle em Notas. Se isso ocorrer, o efeito vira prioridade 1 da implementação.

### Prova 3 - Ocultar o `SessionHeader` fora da arena

Antes da medição: **registrar no ticket se a mesa de teste tem `imageUrl` de capa** (verificar em `state.sessionHeader?.imageUrl` ou o equivalente na projeção atual). Se não tiver, o delta esperado desta prova já é pequeno e o item 5 pode ser descartado.

Aproveitar o CSS já existente do modo espectador — toggle manual na classe:

```js
document.documentElement.classList.add('spectator-mode-active');
```

(Cobre `.header-container` em [session.css:93-106](/src/app/session/[id]/session.css:93).)

Ou, se preferir isolar só o header:

```css
.header-container { display: none !important; }
```

Medir Ficha e Notas por 30s.

**Expectativa**: delta mensurável apenas em mesas com capa; em mesas sem capa, o delta deve ser pequeno e confirmar que o item 5 é secundário.

### Prova 4 - Reduzir a ficha para 1 card completo no modo player

Em patch local temporário, limitar a lista de **PCs** em [CharactersTab.tsx:106](/src/components/session/CharactersTab.tsx:106) a **1 `CharacterCard`** (a lista de NPCs com `CharacterSummary` pode ficar intacta, já que é leve).

**Expectativa**: se o uso cair quase linearmente com o número de `CharacterCard`, o gargalo dominante da Ficha está no **peso por instância** do card, não no shell global — e a story 58 pode resolver a metade CSS; a outra metade fica para story 59.

Registrar os resultados das 4 provas antes do primeiro commit de implementação.

## Estratégias Permitidas

1. Corrigir o `useEffect` de autoscroll para rodar apenas quando realmente entra nota nova ou quando a visão atual muda.
2. Remover ou reduzir `backdrop-filter` persistente do editor de Notas.
3. Simplificar o `CharacterCard` em idle: reduzir sombras base, remover `inset` redundante e aliviar o shell padrão.
4. Em `CharactersTab.tsx`, **apenas microajustes** se necessário para aliviar o modo player sem redesenho de UX:
   - **OK**: envolver `CharacterCard` em `React.memo`, garantir `key` estável, evitar criar novos objetos em props a cada render, estabilizar callbacks com `useCallback`.
   - **FORA do escopo**: mudar a estrutura das tabs, introduzir virtualização de lista, lazy mount por card, trocar `CharacterCard` por `CharacterSummary` para PCs, paginação. Tudo isso pertence a uma possível story 59.
5. Simplificar o banner do `SessionHeader` fora da arena se o delta da Prova 3 justificar (e apenas quando houver `imageUrl`).
6. Manter o gating de `starry-drift` por `prefers-reduced-motion` (já aplicado pela story 56). Se necessário, adicionar toggle/flag explícito no preset espacial.
7. Fazer microajustes de CSS nos cards e painéis antes de considerar mudança de UX.

## Estratégias Explicitamente Excluídas

- Não tocar em `CombatTab`, `Battlemap`, `FateDice3D`, `AtmosphericEffects` ou qualquer render da arena.
- Não alterar WebRTC, `screen-share-manager.ts`, voice chat ou qualquer item da story 57.
- Não mexer em Event Sourcing, snapshot, projections ou `globalEventStore` estruturalmente.
- Não redesenhar a experiência inteira da aba de personagens nesta primeira passada (ver item 4 das Estratégias Permitidas para a fronteira).

## Escopo

### Incluído

- `src/features/session-notes/hooks/useSessionNotesDiary.ts`
- `src/features/session-notes/SessionNotes.css`
- `src/components/session/CharactersTab.tsx` — apenas microajustes listados em "Estratégias Permitidas" item 4.
- `src/components/CharacterCard/CharacterCard.css`
- `src/components/SessionHeader.tsx`
- `src/lib/themePresets.ts`

### Excluído

- `src/components/session/CombatTab*`
- `src/components/Battlemap*`
- `src/components/FateDice3D.tsx`
- `src/hooks/useFateDiceSimulation.ts`
- `src/lib/screen-share-manager.ts`
- `src/lib/VoiceChatManager.ts`
- `src/lib/eventStore.ts`

## Critérios de Aceitação

- [ ] Baseline atual registrada no ticket com os números medidos em **2026-04-23**.
- [ ] Resultados das **Provas 1-4** registrados antes do primeiro commit de implementação.
- [ ] Aba **Notas** em idle com **CPU ≤ 2%** e **GPU ≤ 5%** no desktop do Mestre.
- [ ] Aba **Ficha** em modo player com **CPU ≤ 3%** e **GPU ≤ 5%** na sessão de teste atual do Mestre. *(meta mais frouxa que Notas porque o custo da Ficha cresce linearmente com o número de PCs renderizados; esta story alivia o peso por card, mas não altera a quantidade — eventual story 59 endereça a estratégia de renderização.)*
- [ ] `SessionHeader` fora da arena continua visualmente coerente, mesmo com banner/glow simplificados.
- [ ] Arena mantém comportamento atual: ~0% idle e sem regressão perceptível da story 54.
- [ ] Nenhuma regressão visual grave em mobile.
- [ ] `next build` sem warnings novos; `tsc --noEmit` limpo.
- [ ] Validação final no **notebook da jogadora** antes de fechar a story.

## Critérios de Saída / Possível Desdobramento

Se, após corrigir `Notas` e aliviar `CharacterCard`/`Header`, a **Ficha** ainda continuar acima da meta, abrir uma **story 59** focada em estratégia de renderização da aba de personagens, por exemplo:

- renderizar só a ficha completa do personagem vinculado do jogador;
- usar resumo/cartão compacto para os demais PCs;
- lazy mount mais agressivo por personagem expandido;
- virtualização da lista de cards.

Essa decisão fica **fora do escopo da story 58**, porque já entra em trade-off de UX e não só de CSS/hook.

## Riscos e Notas de Implementação

- **Notas** tem um gargalo funcional concreto (`useEffect` sem deps). Aqui o risco é baixo e o ROI é alto.
- **Ficha** pode ter custo estrutural por quantidade de cards, não apenas por CSS. Se isso se confirmar na Prova 4, a story 58 resolve só a primeira metade do problema e a story 59 é aberta.
- **RAM** deve ser acompanhada, mas não vira gate principal sozinha: uso de memória do Chromium pode oscilar por cache e GC. CPU/GPU idle são sinais mais confiáveis para aceitação.
- **Banner do header** só existe se a mesa define capa — registrar no ticket se a mesa de teste tem `imageUrl` antes de concluir que a Prova 3 teve delta baixo.
- **Tema espacial** precisa ser validado na mesa real do Mestre; se o preset não estiver ativo, esse item vira secundário.
- **Não iniciar implementação sem aprovação do Mestre.**

---

**Resumo:** a story 56 não está completamente errada, mas ficou **parcialmente desatualizada**. A story 58 passa a ser a investigação canônica de performance fora da arena, separada por aba e alinhada ao código real de **2026-04-23**.

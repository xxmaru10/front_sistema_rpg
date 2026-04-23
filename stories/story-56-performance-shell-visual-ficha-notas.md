---
title: "Story 56 - Performance do Shell Visual fora da Arena (Ficha, Notas, Logs, Bestiário, VI)"
description: "Reduzir consumo contínuo de GPU/CPU em abas não-combate (ficha, notas, logs, bestiário, VI) causado por cascata de backdrop-filter, box-shadow com glows e animações infinitas no shell visual. Arena já está otimizada (0% GPU idle); as demais abas puxam ~20% GPU e ~6% CPU em idle puro. Escopo exclusivamente visual (CSS + SessionHeader), sem tocar em Three.js, WebRTC, Event Sourcing nem lógica de combate."
priority: "alta"
status: "em-revisão"
last_updated: "2026-04-23"
related: ["story-46-performance-mobile-voz-travando-e-identidade-trocada", "story-54-performance-transmissao-voz-e-render-cpu-100"]
tags: [performance, ui, css, bugfix]
epic: epic-01-refatoracao-modular
---

# Story 56 - Performance do Shell Visual fora da Arena (Ficha, Notas, Logs, Bestiário, VI)

## Contexto

Medição do usuário em desktop (sem streaming, sem voz, sem YouTube, sem rolagem aberta):

| Aba         | GPU idle | CPU idle |
|-------------|----------|----------|
| ARENA       | 0%       | 0%       |
| PERSONAGEM  | ~20%     | ~6%      |
| NOTAS       | ~20%     | ~6%      |
| LOGS        | ~20%     | ~6%      |

Com transmissão + voz + tela + YouTube **ativos na arena**, os números sobem para apenas ~10% GPU, ~5% CPU e ~800 MB RAM. Ou seja, uma cena 3D Three.js (`CombatTab` com battlemap + partículas + FateDice3D opcional) consome **menos** que uma ficha estática. O shell visual fora da arena está mais caro que a renderização 3D.

### Hipóteses descartadas (verificadas em 2026-04-23)

- **`AtmosphericEffects`**: gateado por `activeTab === "combat"` em [page.tsx:728](/src/app/session/[id]/page.tsx). Só monta na arena. **Não explica** ficha/notas.
- **`FateDice3D` / `useFateDiceSimulation`**: só monta quando `diceVisible === true` em [page.tsx:1042](/src/app/session/[id]/page.tsx), e o RAF pausa em `document.hidden` em [useFateDiceSimulation.ts:578](/src/hooks/useFateDiceSimulation.ts:578). Em ficha idle com caixa fechada, **não há loop ativo**.
- **Snapshot 5 MB do EventStore**: afeta CPU na hora do save, não explica GPU contínua ao trocar de aba.

### Hipóteses ativas (verificadas no código, a validar por profiling)

1. **Cascata de `backdrop-filter` em desktop**. A story 46 já removeu blur em `@media (max-width: 768px)` em [session.css:2410-2428](/src/app/session/[id]/session.css), mas o desktop ainda tem blur em ≥ 9 seletores:
   - `.screenshare-refresh-btn` — [session.css:49](/src/app/session/[id]/session.css:49) — `blur(8px)`
   - `.some-overlay` — [session.css:75](/src/app/session/[id]/session.css:75) — `blur(12px)`
   - `.gm-sidebar-vertical` — [session.css:130-131](/src/app/session/[id]/session.css:130) — `blur(14px)`
   - `(glass shell local)` — [session.css:210](/src/app/session/[id]/session.css:210) — `blur(4px)`
   - `.modal-overlay` — [session.css:445](/src/app/session/[id]/session.css:445) — `blur(10px)`
   - `.nav-expanded-shell` — [session.css:773-774](/src/app/session/[id]/session.css:773) — `blur(16px) saturate(1.2)`
   - `(nav drawer)` — [session.css:942-943](/src/app/session/[id]/session.css:942) — `blur(8px)`
   - `(painel)` — [session.css:1544-1545](/src/app/session/[id]/session.css:1544) — `blur(14px) saturate(1.25)`
   - `(painel)` — [session.css:1733-1734](/src/app/session/[id]/session.css:1733) — `blur(12px) saturate(1.2)`
   Blurs forçam o Chromium a isolar stacking contexts, promover layers a GPU e recomputar filtros de imagem a cada repaint. Combinados com `saturate()`, o custo dobra.

2. **`SessionHeader` com bordas e glow pesados fora da arena**. Em [SessionHeader.tsx:106-111](/src/components/SessionHeader.tsx:106):
   ```ts
   borderTop: isArena ? 'none' : '3px solid var(--accent-color)',
   borderBottom/Left/Right: (idem),
   boxShadow: isArena ? 'none' : '0 0 20px rgba(var(--accent-rgb), 0.6), inset 0 0 20px rgba(var(--accent-rgb), 0.2)',
   ```
   A própria arena **desativa** essas bordas e o `boxShadow` duplo (outer + inset). Fora da arena, eles ficam ligados a 300 px de altura no topo da tela. `boxShadow` com glow e `inset` é conhecido por forçar repaint caro em Chromium.

3. **`.session-container.in-combat`** em [session.css:218](/src/app/session/[id]/session.css:218) simplifica o layout em combate (`padding` / `grid-template-columns` / `gap`). Fora do combate o layout default roda. Não é por si só culpado, mas confirma que há uma divergência consciente entre "modo arena" e "modo shell completo".

4. **`starry-drift` no `body`** em [themePresets.ts:794-801](/src/lib/themePresets.ts:794), animando `background-position` em loop infinito de 60s. **Gateado pelo tema `'espacial'`** — só afeta mesas com esse preset selecionado. Se a mesa do usuário não usa tema espacial, este item é descartado.

5. **`box-shadow` com `var(--accent-glow)` em dezenas de seletores** ([session.css](/src/app/session/[id]/session.css) linhas 160, 167, 179, 191, 255, 353, 358, 368, 372, 391, 396, 416, 636, 915, 1025, 1216, 1285, 1291, 1482, 1551, 1731, 1773, 1874, 2020, 2197, 2270, 2350). Cada `box-shadow` com blur > 0 e `inset` pode forçar repaint. O problema não é cada um isolado, mas o acúmulo ao renderizar uma ficha com 30+ perícias/aspectos.

---

## Provas Rápidas (Validação antes de implementar)

**Antes** de mexer em código de produção, o desenvolvedor deve rodar três testes manuais no DevTools do Chrome (com o Performance Monitor aberto mostrando GPU Memory e GPU Usage) para **validar hipóteses**:

### Prova 1 — Desabilitar backdrop-filter e filtros pesados
No DevTools, adicionar um style override temporário:
```css
* {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    filter: none !important;
}
```
Navegar até a aba **PERSONAGEM** e medir GPU por 30s. Comparar com a baseline (~20%).

**Expectativa**: se cair para ≤ 5%, a **cascata de blur é a causa dominante** → escopo final focado em desabilitar/simplificar blurs desktop.

### Prova 2 — Ocultar SessionHeader fora da arena
No DevTools, adicionar:
```css
.session-container:not(.in-combat) > div[style*="marginTop: '70px'"][style*="height: '300px'"] {
    display: none !important;
}
```
(ou ocultar o componente diretamente via React DevTools). Medir GPU na aba **PERSONAGEM**.

**Expectativa**: se cair de forma apreciável (≥ 5 pp), bordas+boxShadow do header contribuem significativamente → incluir otimização do header no escopo.

### Prova 3 — Desabilitar box-shadow
```css
* {
    box-shadow: none !important;
}
```
Medir. Se baixar mais, é evidência adicional de custo acumulado dos glows.

**Registrar os 3 números no ticket antes de implementar**, para que o delta seja mensurável ao final.

---

## Comportamento Esperado

### Meta quantitativa
- **GPU idle em ficha/notas/logs/bestiário/VI ≤ 5%** em desktop (Windows 10/11, Chrome, GPU integrada ou dedicada moderada).
- **CPU idle ≤ 2%** nas mesmas abas.
- **Nenhuma regressão** visual perceptível para o jogador quando em modo claro/neutro. Perda leve de "glass effect" é aceitável (o mobile já vive sem isso desde a story 46).
- **Arena mantém** seus 0% idle e ~10% com transmissão completa.

### Estratégias permitidas (em ordem de preferência)
1. **Remover** `backdrop-filter` de elementos que não são modais/overlays críticos visualmente (ex.: `.screenshare-refresh-btn`, seletores de botão pequenos).
2. **Reduzir intensidade** dos blurs restantes (14px → 8px; 16px → 10px) onde o visual tolera.
3. **Consolidar stacking contexts**: se dois blurs vizinhos podem virar um só pai com blur, consolidar.
4. **Remover `saturate()` de combinações `blur + saturate`** quando o ganho visual for marginal.
5. **Simplificar `SessionHeader` fora da arena**: reduzir glow (0.6 → 0.3), remover `inset` do `boxShadow`, ou eliminar o `boxShadow` em abas pesadas (ficha/notas/logs).
6. **Condicionar `starry-drift` por `prefers-reduced-motion`** (respeitar preferência do SO) E por um toggle opt-in no tema espacial. Default: desligado.
7. **Revisar `box-shadow` com `--accent-glow`** nas regras mais renderizadas (`.character-card`, `.skill-row`, containers de perícia) — se o glow puder ser substituído por borda sólida + opacidade, trocar.

### Estratégias proibidas
- **Não** remover `backdrop-filter` de modais (`.modal-overlay` em [session.css:445](/src/app/session/[id]/session.css:445)): o visual é parte da identidade do app e modais são pontuais.
- **Não** tocar em nada da arena/combat (`.in-combat`, `CombatTab`, `Battlemap`, `FateDice3D`, `useFateDiceSimulation`) — já está otimizada e qualquer mudança cria risco de regressão.
- **Não** alterar `AtmosphericEffects`, `MusicPlayer`, `VoiceChat`, `screen-share-manager.ts`.
- **Não** mexer no EventStore/projections/snapshot.
- **Não** introduzir novo state global, novo hook global nem biblioteca nova. Fix é puramente CSS + pequenos ajustes em `SessionHeader.tsx`.

---

## Escopo

### Incluído
- [session.css](/src/app/session/[id]/session.css): revisar cada `backdrop-filter` e `box-shadow` ativo em desktop; remover ou reduzir conforme Provas 1–3.
- [SessionHeader.tsx](/src/components/SessionHeader.tsx): simplificar `boxShadow`/bordas quando `!isArena`.
- [themePresets.ts](/src/lib/themePresets.ts) linhas 794-801: condicionar `starry-drift` a `@media (prefers-reduced-motion: no-preference)` E adicionar comentário de aviso de custo. Opcional: transformar em opt-in explícito do tema.
- Atualizar `/knowledge/architecture.md` e `/knowledge/ui/styling.md` com a decisão.

### Excluído
- Qualquer arquivo da pasta `src/components/session/CombatTab*` ou `Battlemap*`.
- `src/components/FateDice3D.tsx`, `src/hooks/useFateDiceSimulation.ts`, `src/lib/dicePhysics.ts`, `src/lib/diceVisuals.ts`.
- `src/components/AtmosphericEffects.tsx`.
- `src/components/MusicPlayer.tsx`, `src/lib/VoiceChatManager.ts`, `src/lib/screen-share-manager.ts`.
- `src/lib/eventStore.ts`, `src/lib/projections.ts`, `src/lib/snapshot*`.
- Novas features, refactors amplos, trocas de biblioteca CSS, migração para CSS Modules/Tailwind.
- Mobile: já tratado pela story 46; não reabrir aquele escopo.

---

## Arquivos Afetados (Estimativa Inicial)

### CSS
- `src/app/session/[id]/session.css` — linhas de `backdrop-filter` e `box-shadow` listadas no **Contexto**. Revisão seletiva.

### Componentes
- `src/components/SessionHeader.tsx` — linhas 106-111: simplificar `boxShadow`/bordas quando `!isArena`.

### Tema
- `src/lib/themePresets.ts` — linhas 794-801: gating de `starry-drift` por `prefers-reduced-motion` (e, opcionalmente, por flag do tema).

### Documentação
- `knowledge/architecture.md` — registrar decisão arquitetural (ex.: "Desktop segue padrão mobile da story 46 para elementos não-modais").
- `knowledge/ui/styling.md` — registrar regra: novos componentes devem preferir background sólido/semi-opaco sobre `backdrop-filter`, exceto em modais.

---

## Critérios de Aceitação

- [ ] **Medições da Prova 1 + Prova 2 + Prova 3 registradas no ticket** antes do primeiro commit de implementação.
- [ ] Aba **PERSONAGEM** em idle mostra **GPU ≤ 5%** e **CPU ≤ 2%** em desktop com hardware médio.
- [ ] Mesma meta atendida em **NOTAS**, **LOGS**, **BESTIÁRIO**, **VI**.
- [ ] Aba **ARENA** mantém **0% GPU idle** e ≤ 10% GPU com transmissão+voz+tela+YouTube ativos (sem regressão da story 54).
- [ ] `SessionHeader` fora da arena visualmente coerente com o restante da UI — perda leve de glow é aceitável, mas nada quebrado.
- [ ] `starry-drift` **desligado** quando o usuário tem `prefers-reduced-motion: reduce` ativo no SO.
- [ ] Nenhum modal perde `backdrop-filter` (modais continuam com glass).
- [ ] Nenhuma regressão em mobile (story 46 intacta).
- [ ] Nenhuma regressão em battlemap/combat/FateDice3D.
- [ ] `next build` sem warnings novos; `tsc --noEmit` limpo.
- [ ] `knowledge/architecture.md` atualizado com a decisão.
- [ ] Validação final em **máquina do usuário** (desktop) E **notebook da jogadora** (gate principal — story 54 deixou explícito que notebook fraco é o gate real de performance).

---

## Riscos e Notas de Implementação

- **Risco de regressão visual**: usuários esperam glass effect em certos painéis. Mitigação: manter em modais; substituir por `rgba(0,0,0,0.85-0.92)` em sidebars/nav, como a story 46 já fez para mobile. Comunicar ao Mestre antes de fazer merge.
- **Prova 1 pode não cair para 5%**: se GPU ficar em ~10% mesmo sem blur/filter, a causa é outra (box-shadow acumulado ou algo específico da ficha não identificado). Nesse caso, o escopo desta story cobre o que pode cobrir e **abre-se story 58** para investigação focada em componentes internos da ficha (ex.: `CharacterCard`, `CharacterSummarySkills`, `CharacterVitality`).
- **Tema espacial + starry-drift**: se a mesa do usuário não usa espacial, este item pode ser verificado rapidamente (perguntar ao Mestre qual tema está ativo) e possivelmente descartado da story — mas o gating por `prefers-reduced-motion` vale o esforço independentemente.
- **Notebook da jogadora**: ainda não testado (último relato do Mestre). É o **gate principal** de aceitação — performance que parece OK no desktop do Mestre pode ainda travar no notebook dela. Alinhar medição lá antes de fechar a story.
- **Não iniciar a implementação antes da aprovação do Mestre.**

---

**NOTA:** Não codar antes da aprovação do Mestre. Esta story foi redigida para ser auto-suficiente — qualquer agente de IA deve conseguir aplicá-la lendo apenas este arquivo e os arquivos listados em "Arquivos Afetados". **Executar primeiro as três Provas Rápidas no DevTools e registrar os números antes de editar qualquer arquivo.**

---
title: "Story 37 - Menu lateral em d20 colapsado com expansao vertical tipo alca"
description: "Unificar a navegacao lateral da sessao em um unico handle d20 semi-oculto na borda esquerda, com expansao vertical por hover/click e recolhimento no proprio controle."
priority: "alta"
status: "concluida"
last_updated: "2026-04-10 (menu-d20-topo-base)"
tags: [ui, navegacao, arena, mobile, acessibilidade]
---

# Story 37 - Menu lateral em d20 colapsado com expansao vertical tipo alca

## Contexto
Hoje a navegacao lateral global da sessao usa uma pilha fixa de botoes (`.tactical-nav` + `.nav-artifact`) em `page.tsx` e `session.css`. Em paralelo, a Arena possui gavetas laterais proprias de cards compactos (`.combat-avatar-drawer`).

A solicitacao desta Story e:
1. colapsar o menu lateral global em uma unica peca visual;
2. usar um gatilho visual em formato de d20 branco, com borda na cor do tema atual;
3. manter esse gatilho semi-oculto no canto esquerdo (metade visivel), como alca de gaveta;
4. ao hover (desktop) ou click/tap (mobile), expandir o menu para cima e para baixo exibindo os botoes de navegacao;
5. ao recolher, voltar ao estado de d20 unico;
6. quando a aba ativa for Arena, a expansao do menu global nao deve colidir com as gavetas laterais dos cards, devendo empurra-las visualmente para preservar clique/legibilidade;
7. em abas como Ficha/Notas/Bestiario/Logs/Configuracoes, o d20 deve permanecer disponivel e discreto aguardando chamada.

Pelo `knowledge/architecture.md`, a entrega permanece em camada de UI/composicao e nao altera Event Sourcing, projecoes nem contratos de dominio.

## Escopo

### Fase 1 - Handle unico d20 (estado colapsado)
- Substituir a exposicao permanente da pilha de botoes por um estado colapsado com um unico handle d20.
- Handle com:
1. preenchimento branco;
2. borda tematizada por `var(--accent-color)`;
3. posicionamento semi-oculto na lateral esquerda (efeito "alca").

### Fase 2 - Expansao vertical do menu
- Definir dois modos de acionamento:
1. desktop: hover abre e sair do hover fecha (com suporte a fixacao por clique, para acessibilidade);
2. mobile: toque abre/fecha explicitamente.
- Ao abrir, os botoes de navegacao da sessao aparecem em pilha vertical expandindo para cima e para baixo a partir do eixo do handle.
- No estado expandido, o proprio controle passa a oferecer recolhimento no topo e na base (indicacoes visuais "20" e "1" conforme pedido).

### Fase 3 - Integracao com Arena
- Garantir que, em `activeTab === "combat"`, a expansao do menu lateral global nao sobreponha de forma ilegivel/interativa as gavetas de retratos da Arena.
- Aplicar deslocamento horizontal/coordenacao de layout para que o menu global aberto "empurre" a area lateral, preservando clique nas gavetas/cards.

### Fase 4 - Responsividade e acessibilidade
- Preservar usabilidade em desktop e mobile sem manter labels hover no mobile.
- Garantir `aria-label`, foco visivel e comportamento consistente de abrir/fechar por teclado/clique/tap.

## Arquivos Afetados
| Arquivo | Responsabilidade no escopo |
|---|---|
| `src/app/session/[id]/page.tsx` | Orquestrar estado do menu lateral global (colapsado/expandido), gatilhos hover/click por plataforma e renderizacao do handle d20 + botoes de navegacao. |
| `src/app/session/[id]/session.css` | Implementar visual do d20 semi-oculto, animacoes de expansao vertical, estados topo/base (20/1), responsividade mobile e ajustes de espacamento para evitar colisao com a Arena. |
| `src/components/session/CombatTab.tsx` | Receber/suportar sinalizacao de menu global expandido (quando necessario) para alinhar comportamento da coluna lateral e evitar sobreposicao com `combat-avatar-drawer`. |

## Criterios de Aceitacao
1. Em qualquer aba da sessao, o menu lateral inicia colapsado em um unico controle d20 semi-oculto na borda esquerda.
2. O d20 colapsado e branco com borda na cor ativa do tema (`--accent-color`).
3. No desktop, passar o mouse no controle expande o menu; ao sair, recolhe (sem flicker).
4. No mobile, toque alterna entre expandido e colapsado.
5. Ao expandir, os botoes de navegacao (Personagem, Arena, Notas e demais opcoes por papel GM/Player) ficam acessiveis em uma unica caixa/fluxo vertical.
6. O menu expandido apresenta controle de recolhimento no topo e na base com as marcacoes "20" (topo) e "1" (base), e recolhe para o d20 unico ao acionar qualquer um deles.
7. Ao selecionar uma opcao de aba no menu expandido, a navegacao funciona como hoje e o estado de permissao GM/Player permanece inalterado.
8. Em `activeTab === "combat"`, a abertura do menu lateral global nao bloqueia clique das gavetas laterais dos cards; a composicao visual e deslocada de forma legivel.
9. Em abas fora da Arena (ficha/notas/bestiario/logs/vi), o d20 permanece visivel e funcional como gatilho unico do menu.
10. Em mobile (<=768px), o novo comportamento substitui a barra inferior atual sem perda de navegacao.
11. Nenhum evento novo de dominio e introduzido; mudanca restrita a UI.

## Fora de Escopo
- Alterar regras de combate, turnos, estresse, consequencias, destino ou impulso.
- Alterar contratos de `domain.ts`, `api-contract.md`, projecoes ou Event Store.
- Reestilizar internamente os `CombatCard` alem do necessario para evitar colisao com o menu global.
- Persistir estado aberto/fechado do menu entre refreshes.

## Dependencias e Riscos
- Risco de conflito de z-index/overflow entre menu global expandido e `.combat-avatar-drawer` da Arena.
- Risco de regressao mobile ao substituir a barra inferior por um unico handle lateral se targets de toque ficarem pequenos.
- Risco de ambiguidade de UX no desktop entre "hover abre" e "clique fixa"; implementar precedencia clara para evitar fecha-abre involuntario.

## Status de Execucao
- Implementacao concluida no frontend.
- O menu lateral global agora inicia colapsado em um handle `d20` branco, semi-oculto na lateral esquerda.
- Ao expandir, a caixa vertical exibe botoes de navegacao e dois caps de recolhimento: `d20` no topo e `d1` na base.
- Clique em `d20` (topo) ou `d1` (base) recolhe o menu para o estado colapsado.
- Desktop abre por hover e mobile abre por toque no handle.
- Em Arena com menu aberto, a gaveta lateral esquerda de avatares recebe deslocamento para evitar colisao visual/interativa.
- Build de producao validado com sucesso via `npm run build` em 2026-04-10.

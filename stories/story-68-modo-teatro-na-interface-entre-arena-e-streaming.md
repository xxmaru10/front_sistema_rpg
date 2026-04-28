---
title: "Story 68 - Modo Teatro na Interface entre Arena e Streaming"
description: "Introduzir o Modo Teatro como nova superficie de sessao com gerenciador de cenas, menu de ferramentas por cena e primeira entrega funcional de Camadas e Cenario sobre o estado sincronizado do Battlemap."
priority: "alta"
status: "proposta"
last_updated: "2026-04-28"
tags: [ui, vtt, battlemap, componente, eventsourcing]
epic: epic-03-battlemap-camadas-formas-edicao-fundo-grade
---

# Story 68 - Modo Teatro na Interface entre Arena e Streaming

## Contexto

Hoje o frontend possui as abas `characters`, `combat`, `notes`, `bestiary`, `log` e `vi` em `src/app/session/[id]/page.tsx`. O Battlemap existe como uma superficie dentro de `activeTab === "combat"`, com estado sincronizado por `BATTLEMAP_UPDATED`, e o "modo teatro" atual e apenas um toggle local de ocultacao de interface em `battlemapToolStore.isTheaterMode`.

Ao mesmo tempo, o repositorio nao possui uma aba dedicada `streaming`: a transmissao existe hoje pelo fluxo `videoStream` + `spectatorMode` + controles de reconexao no header.

Esta story formaliza o **Modo Teatro** como uma nova superficie de plataforma, com navegacao propria, gerenciador de cenas e modelo de camadas/cenario alinhado ao epic-03.

Escopo arquitetural: **plataforma**.

## Interpretacao para aprovacao

Para nao inventar uma aba inexistente no codigo atual, esta story assume a seguinte leitura do pedido "entre Arena e Streaming":

1. adicionar uma nova aba `theater` na navegacao principal da sessao;
2. posicionar essa aba imediatamente apos `ARENA`;
3. manter o fluxo atual de transmissao/espectador como a referencia vigente de "Streaming", sem abrir uma nova aba de streaming nesta entrega.

Ao aprovar esta story, voce aprova tambem essa interpretacao do encaixe na interface atual.

---

## Objetivo

Entregar uma primeira versao operavel do Modo Teatro para composicao visual de cenas:

1. com ate 5 cenas sincronizadas;
2. com um menu de ferramentas por cena no header;
3. com `Camadas` no estilo Canva;
4. com `Cenario` para inserir e ajustar imagem de fundo;
5. sem iniciar ainda os fluxos completos de `Personagem`, `Objeto` e `Texto`.

O estado continua sincronizado via `BATTLEMAP_UPDATED`, evoluindo o payload do `BattlemapState` em vez de criar um canal novo.

---

## Comportamento Esperado

### 1. Entrada no modo

- A sessao ganha uma nova aba `TEATRO` na navegacao principal.
- `TEATRO` fica logo apos `ARENA`.
- Ao entrar em `TEATRO`, a tela principal renderiza a superficie visual do Battlemap em modo de composicao de cena, nao apenas o toggle local de ocultacao.
- O botao flutuante legado de `Modo Teatro` ligado a `battlemapToolStore.toggleTheaterMode()` deixa de ser a entrada primaria dessa experiencia.

### 2. Gerenciador de Cenas

- Abaixo do header, aparece um seletor `Cenas` com icone de seta.
- O estado inicial cria e seleciona `Cena 1`.
- O seletor permite navegar entre ate 5 cenas.
- Um botao `+` cria nova cena ate o limite maximo de 5.
- Ao atingir 5 cenas, o `+` fica desabilitado ou oculto em estado nao interativo.

### 3. Menu de Ferramentas no header

- Sempre que existir uma cena selecionada, o header mostra ao lado dos botoes de volume um menu com 5 opcoes:
  - `Camadas`
  - `Personagem`
  - `Objeto`
  - `Cenario`
  - `Texto`
- Nesta entrega, apenas `Camadas` e `Cenario` possuem fluxo funcional.
- `Personagem`, `Objeto` e `Texto` aparecem como opcoes visuais, mas sem editor funcional alem do estado desabilitado/placeholder.

### 4. Camadas

- `Camadas` abre um painel com a hierarquia visual da cena ativa.
- A camada base `Background` e fixa na base do empilhamento.
- `Background` permite alterar a cor de fundo da cena.
- Ao adicionar um novo elemento visual a cena, uma nova camada e criada automaticamente com miniatura da imagem correspondente.
- O painel permite drag and drop para reordenar o empilhamento visual.
- Reordenar camadas atualiza a ordem de renderizacao da cena ativa.

### 5. Cenario

- `Cenario` permite:
  - upload de imagem;
  - selecao pela galeria existente do site.
- Ao escolher uma imagem de cenario, a interface principal entra em foco de edicao:
  - elementos nao essenciais do shell ficam ocultos temporariamente;
  - a edicao foca na imagem da cena.
- A imagem escolhida exibe handles de redimensionamento nas arestas.
- A edicao mostra:
  - botao `Finalizado` para confirmar;
  - botao `X` para cancelar a insercao.

---

## Escopo

### Incluido

- Nova aba `theater` na navegacao principal.
- Evolucao do `BattlemapState` para armazenar cenas e camadas sincronizadas.
- Gerenciador de cenas abaixo do header.
- Menu de ferramentas no header condicionado a cena ativa.
- Fluxo funcional de `Camadas`.
- Fluxo funcional de `Cenario`.
- Reaproveitamento da galeria existente (`ImageLibraryModal`) para selecao de imagem.
- Modo de foco temporario para editar cenario com confirmacao/cancelamento explicitos.
- Compatibilidade com sessoes antigas que ainda usam `imageUrl`, `strokes` e `objects`.

### Excluido

- Editor funcional de `Personagem`, `Objeto` e `Texto`.
- Rotacao de imagem, crop avancado, filtros, opacidade, blend modes ou snapping avancado.
- Novos endpoints, novas rotas de backend ou novo tipo de evento alem de `BATTLEMAP_UPDATED`.
- Reescrita da transmissao WebRTC ou criacao de uma aba dedicada `Streaming`.
- Colaboracao concorrente com varios usuarios editando camadas em paralelo com lock fino por item.

---

## Arquivos Afetados

| Arquivo | Alteracao prevista |
|---|---|
| `src/app/session/[id]/page.tsx` | Estender `SessionTab` com `theater`; inserir a nova aba na navegacao apos `ARENA`; renderizar a superficie do Modo Teatro; remover a dependencia do botao flutuante legado como entrada principal; manter integracao com `videoStream` e `spectatorMode`. |
| `src/components/HeaderWrapper.tsx` | Exibir o menu de ferramentas do Teatro ao lado dos botoes de volume quando `activeTab === "theater"` e houver cena ativa. |
| `src/components/header/BattlemapToolbar.tsx` | Refatorar ou substituir o toolbar atual para separar o toggle legado de ocultacao do novo menu funcional de `Camadas`/`Cenario`. |
| `src/components/Battlemap.tsx` | Renderizar a cena ativa, respeitar ordem de camadas, registrar novas camadas automaticamente e abrir o modo de foco para edicao de cenario. |
| `src/components/BattlemapObjects.tsx` | Integrar objetos/imagens ao modelo de camadas e a atualizacao de miniaturas/ordem visual. |
| `src/components/BattlemapSceneManager.tsx` | **Novo**. Componente abaixo do header com dropdown `Cenas`, selecao da cena atual e botao `+`. |
| `src/components/BattlemapLayersPanel.tsx` | **Novo**. Painel de camadas com `Background`, miniaturas e drag and drop. |
| `src/components/BattlemapBackgroundEditor.tsx` | **Novo**. Overlay de edicao do cenario com handles nas arestas, `Finalizado` e `X`. |
| `src/components/ImageLibraryModal.tsx` | Reuso do fluxo de galeria para inserir imagem de cenario no Modo Teatro. |
| `src/lib/battlemapToolStore.ts` | Armazenar estado local de UI do Teatro: painel aberto, ferramenta ativa, foco de edicao, possivel selecao local de item. |
| `src/lib/projections.ts` | Evoluir o reducer de `BATTLEMAP_UPDATED` para suportar cenas/camadas e migracao lazy de estado legado. |
| `src/types/domain.ts` | Adicionar tipos de cena/camada do Teatro e estender `BattlemapState` preservando compatibilidade com o payload atual. |
| `src/styles/Battlemap.css` | Estilos da superficie de cena, editor de cenario, handles e painel de camadas. |
| `src/styles/BattlemapToolbar.css` | Estilos do menu de ferramentas do Teatro no header. |
| `src/app/session/[id]/session.css` | Ajustes da navegacao principal para inserir `TEATRO` e acomodar o gerenciador de cenas abaixo do header. |

---

## Modelo Tecnico Proposto

### Persistencia sincronizada

- Continuar usando `BATTLEMAP_UPDATED` como evento publico.
- Estender `BattlemapState` com uma colecao de cenas, por exemplo:
  - `scenes`
  - `activeSceneId`
  - `layers` por cena
  - `backgroundColor` por cena
  - `backgroundImage` e `backgroundTransform` por cena

### Compatibilidade com estado legado

- Se a sessao antiga nao tiver `scenes`, a projecao cria `Cena 1` sob demanda.
- `imageUrl`, `strokes` e `objects` legados alimentam a cena inicial durante a migracao lazy.
- Nenhum evento historico e regravado.

### Regras do painel de camadas

- `Background` e sempre a camada fixa inferior.
- Somente camadas nao fixas podem ser reordenadas.
- Toda imagem inserida por `Cenario` gera uma camada visual identificavel por miniatura.

### Foco de edicao do cenario

- Durante a insercao/ajuste do cenario, a UI principal entra num estado de foco:
  - o shell principal e ocultado temporariamente;
  - permanecem visiveis apenas o canvas/area de edicao, os handles e as acoes `Finalizado` e `X`.

---

## Criterios de Aceitacao

### Navegacao

- [ ] Existe uma nova aba `TEATRO` na navegacao principal da sessao.
- [ ] `TEATRO` aparece imediatamente apos `ARENA`.
- [ ] Entrar em `TEATRO` abre a superficie de composicao visual, sem depender do botao flutuante legado como ponto de entrada principal.

### Gerenciador de Cenas

- [ ] Abaixo do header existe um dropdown `Cenas` com seta.
- [ ] O estado inicial sempre apresenta `Cena 1` selecionada.
- [ ] O usuario pode criar novas cenas pelo botao `+`.
- [ ] O total maximo e 5 cenas.
- [ ] Ao atingir 5 cenas, nao e possivel criar a sexta.

### Menu de Ferramentas

- [ ] Com uma cena selecionada, o header mostra `Camadas`, `Personagem`, `Objeto`, `Cenario` e `Texto` ao lado dos botoes de volume.
- [ ] Nesta entrega, `Camadas` e `Cenario` sao funcionais.
- [ ] `Personagem`, `Objeto` e `Texto` aparecem sem comportamento editor completo.

### Camadas

- [ ] `Camadas` mostra a hierarquia visual da cena ativa.
- [ ] A camada `Background` fica fixa no fundo e permite alterar a cor de fundo.
- [ ] Inserir um novo elemento visual cria automaticamente uma nova camada.
- [ ] Cada camada automatica exibe miniatura da imagem correspondente.
- [ ] O painel permite drag and drop para reordenar camadas.
- [ ] Reordenar camadas altera corretamente o empilhamento visual da cena.

### Cenario

- [ ] `Cenario` permite upload de imagem.
- [ ] `Cenario` permite selecionar imagem da galeria existente do site.
- [ ] Ao selecionar uma imagem, a interface principal e ocultada temporariamente para focar a edicao.
- [ ] A imagem selecionada mostra handles de redimensionamento nas arestas.
- [ ] Existe um botao `Finalizado` para confirmar a insercao.
- [ ] Existe um botao `X` para cancelar a insercao.

### Compatibilidade e sincronizacao

- [ ] O estado do Teatro continua sincronizado por `BATTLEMAP_UPDATED`.
- [ ] Sessoes antigas com `imageUrl`, `strokes` e `objects` continuam carregando sem erro.
- [ ] A primeira migracao cria `Cena 1` automaticamente quando o modelo novo ainda nao existir.

---

## Riscos e Mitigacoes

- **Ambiguidade de "Streaming" na UI atual**: o codigo nao possui aba `streaming`. Mitigacao: esta story fixa a interpretacao para aprovacao antes da implementacao.
- **Compatibilidade com Battlemap legado**: migrar para cenas/camadas pode quebrar sessoes antigas. Mitigacao: migracao lazy em `projections.ts`, sem regravar eventos.
- **Acoplamento entre toolbar legado e novo Teatro**: o `BattlemapToolbar` atual mistura ferramentas e toggle local. Mitigacao: refatorar/splitar o componente na entrega.
- **Foco de edicao com shell oculto**: risco de regressao visual no header e overlays. Mitigacao: isolar o estado de foco ao `activeTab === "theater"` e ao editor de cenario.

---

## Escopo final

`escopo: plataforma` - nova superficie `TEATRO` na sessao, evolucao do modelo sincronizado do Battlemap para cenas/camadas e primeira entrega funcional de `Camadas` e `Cenario`, sem tocar em `src/systems/*`.

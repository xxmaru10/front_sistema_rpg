---
repo: frontend
language: pt-BR
last_updated: 2026-04-23 (story-55 musicplayer receiver youtube idempotencia)
---

# Cronos Vtt — Frontend 

> Sistema de Virtual Tabletop (VTT) focado em gerenciamento de sessões de RPG de mesa, inspirado em sistemas de rolagens narrativas, zonas, aspectos de cena, estresse e consequências (Fate Core/Accel). Utiliza uma arquitetura de Event Sourcing para manter a sincronia entre jogadores e mestre.

## Como usar este arquivo
Este é o ponto de entrada para agentes de IA. Leia este arquivo primeiro e nada mais.
A partir das seções abaixo, carregue apenas os arquivos relevantes para sua tarefa atual.
Mantenha o uso da janela de contexto entre 50% e 70%.

## Repositório irmão
- **Backend**: `./backend`
- Contrato de API compartilhado: `/knowledge/shared/api-contract.md`

## Mapa de arquivos críticos (ler sempre antes de qualquer tarefa)
| Arquivo | Propósito |
|---|---|
| `/knowledge/architecture.md` | Visão geral da arquitetura (Event Sourcing, Projeções) |
| `/knowledge/conventions.md` | Padrões de código, nomenclatura e estilo |
| `/knowledge/stack.md` | Tecnologias (Next.js 15, React 19, Three.js) |
| `/knowledge/ai-usage.md` | Guia de Eficiência e Redução de Custos (Ler Sempre) |

## Carregar por contexto (carregar apenas o relevante)
| Se sua tarefa envolve... | Carregue estes arquivos |
|---|---|
| Interface, layout, componentes visuais | `/knowledge/ui/styling.md`, `/knowledge/ui/components.md` |
| Autenticação e sessão | `/knowledge/auth/flow.md`, `/knowledge/shared/api-contract.md` |
| Chamadas de API e Eventos | `/knowledge/api/endpoints.md`, `/knowledge/shared/api-contract.md` |
| Regras de Jogo e Projeções | `/knowledge/architecture.md` (seção Projeções) |
| Infraestrutura e deploy | `/knowledge/infra/environments.md` |

## Épicos ativos
| Refatoração de Componentes | em andamento | `/epics/epic-01-refatoracao-modular.md` |
| Battlemap: Camadas, Formas, Edição de Fundo e Grade | planejado | `/epics/epic-03-battlemap-camadas-formas-edicao-fundo-grade.md` |
| Sincronização Voz WebRTC | em andamento | `/stories/story-05.md` |
| Layout Perícias Cortadas | concluído | `/stories/story-06-corrigir-layout-pericias-cortadas.md` |
| Sincronia de Notas de Sessão | concluído | `/stories/story-07-estabilizar-sincronia-notas.md` |
| Seletor Multi-Dado (Caixa) | concluído | `/stories/story-44-seletor-multi-dado-com-clear-e-notacao-viva.md` |
| Ocultar Rolagem do Mestre | concluído | `/stories/story-45-olho-ocultar-rolagem-do-mestre.md` |
| Performance Geral (Transmissão, Voz, Render) | em-revisão | `/stories/story-54-performance-transmissao-voz-e-render-cpu-100.md` |
| MusicPlayer Receiver YouTube (loop Playing/Buffering) | pronto | `/stories/story-55-musicplayer-receiver-youtube-idempotencia.md` |

## Tags disponíveis no projeto
`ui` `api` `auth` `eventsourcing` `vtt` `3d` `webrtc` `componente` `fluxo` `schema` `regras` `config` `estável` `em-revisão` `deprecated`

## Regras de comportamento para agentes

### Regras de Navegação Estrita (CRÍTICO)
1. **Nunca faça varredura cega**: Não utilize `grep` global ou `list_dir` recursivo sem um objetivo específico baseado na tarefa. Use o Knowledge Graph (`/knowledge`) primeiro.
2. **Protocolo de Carregamento**: Antes de carregar o conteúdo de um arquivo `.md`, leia apenas os primeiros 150 caracteres para validar a `description` no YAML Front Matter. Só carregue o arquivo completo se ele for estritamente necessário.
3. **Limite de Contexto**: Mantenha o uso da janela de contexto entre **50% e 70%**. Se precisar carregar mais de 3 arquivos grandes (>500 linhas), **pergunte ao humano primeiro**.
4. **Foco no Escopo**: Não modifique arquivos fora do escopo descrito na história atual em `/stories`. Se precisar fazer uma alteração "cross-file", registre a necessidade no `AI.md` primeiro.
5. **Atualização Reativa**: Ao concluir, atualize `last_updated` e registre decisões em `/knowledge/architecture.md`.

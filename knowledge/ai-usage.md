---
title: Eficiência e Análise de Custos (Uso de IA)
description: Diretrizes para evitar redundância, reduzir consumo de tokens e otimizar o fluxo de trabalho entre sessões.
tags: [eficiência, custos, tokens, workflows, ai]
repo: shared
related:
  - /AI.md
  - /knowledge/conventions.md
last_updated: 2026-04-01
status: estável
---

# Eficiência e Análise de Custos

Baseado em análises de sessões anteriores, identificamos padrões de redundância e fricção que devem ser evitados por qualquer agente de IA operando neste repositório.

## 1. Evitar Operações Redundantes
- **Não repita análises**: Antes de rodar scanners de arquivos ou análises de tamanho de código, verifique se já existe um relatório em `/knowledge` ou `/docs`.
- **Continuidade de Refatoração**: Se uma tarefa de refatoração (ex: `VIControlPanel`) foi iniciada em uma sessão anterior, referencie o plano original e o status atual em `/epics` para evitar re-análise do zero.

## 2. Otimização de Janela de Contexto
- **Scoping Preciso**: Evite ler arquivos de 800+ linhas repetidamente. Use `grep_search` ou `view_file` com ranges específicos quando possível.
- **Task Small, Think Big**: Divida refatorações amplas em histórias atômicas em `/stories`. Isso mantém o uso da janela de contexto entre **50-70%**, reduzindo custos e aumentando a precisão.

## 3. Persistência via Knowledge Items (KIs)
- **Documente Descobertas**: Sempre que realizar uma análise complexa ou tomar uma decisão arquitetural, salve o resultado em um arquivo em `/knowledge`. Isso evita que futuras sessões "reinventem a roda".
- **Verifique KIs Primeiro**: Antes de qualquer pesquisa ou diagnóstico, o agente deve consultar a base de conhecimento existente.

## 4. Infraestrutura e Automação
- **Standard Infrastructure**: Não utilize a IA apenas para iniciar servidores (`npm run dev`). Prefira scripts de automação ou gerenciadores de processo (PM2) para manter o ambiente ativo.
- **Workflow Antigravity vs Claude Code**: Use `claudecode` para tarefas rápidas de terminal e Antigravity para refatorações complexas e planejamento de longo prazo.

## Recomendações Críticas
| Categoria | Ação Corretiva |
| :--- | :--- |
| **Refatorações Duplicadas** | Consulte `/epics` antes de planejar. |
| **Análise Repetitiva** | Verifique `/knowledge` por relatórios anteriores. |
| **Overhead de Sessão** | Mantenha tarefas atômicas e focadas. |
| **Falta de Memória** | Atualize `last_updated` e KIs ao finalizar cada Story. |

---
> [!IMPORTANT]
> O objetivo desta estrutura de Knowledge Graph é eliminar o padrão "dois passos para frente, um para trás" causado por regressões e falta de memória entre sessões.

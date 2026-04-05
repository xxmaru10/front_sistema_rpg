---
Status: concluído
priority: alta
tags: [sincronia, notes, ux, stability]
---

# Story-08: Sincronia de Notas - Garantia de Entrega e Feedback de Persistência

Os jogadores relataram que notas enviadas às vezes não aparecem para os outros (incluindo o mestre). Este documento define os mecanismos para garantir que toda nota enviada seja confirmada pelo servidor ou que o usuário receba um alerta claro de falha.

## Cenário de Falha Identificado
1. O usuário digita e clica em enviar.
2. O `EventStore` adiciona a nota localmente com `seq: 0` (otimismo).
3. A chamada `apiClient.appendEvent` falha (rede, timeout ou erro no backend).
4. O `EventStore` loga o erro no console, mas não notifica a UI nem remove a nota "fantasma".
5. O usuário vê a nota, mas o Mestre não (pois não houve broadcast).

## Critérios de Aceitação

### 1. Feedback Visual de Pendência (UI)
- [ ] Notas com `seq === 0` devem exibir um indicador de "Enviando..." (ex: ícone de relógio ou opacidade reduzida).
- [ ] Quando o servidor confirmar e o `seq` for atualizado via Subscription, o indicador deve desaparecer (feedback de sucesso).

### 2. Tratamento de Erro e Retry
- [ ] Se o `appendEvent` falhar, a nota deve exibir um ícone de erro (⚠️) e um botão de "Tentar Novamente".
- [ ] Implementar retentativa automática (exponential backoff) para eventos de nota no `EventStore`.

### 3. Monitoramento de Canal Real-time
- [ ] O `EventStore` deve expor um estado de `connectionStatus` (baseado no `supabase.channel().subscribe()`).
- [ ] O `SessionNotes.tsx` deve exibir um pequeno aviso caso o canal de sincronização esteja offline.

### 4. Integridade de Mensagens Curtas
- [ ] Garantir que o payload da nota não seja truncado ou perdido em situações de alta latência.

## Arquivos Afetados
- `src/lib/eventStore.ts`: Lógica de confirmação de `seq` e exportação do estado da fila de persistência.
- `src/hooks/useSessionNotes.ts`: Passagem do estado de persistência para os componentes.
- `src/components/SessionNotesTabs/NotesTab.tsx`: Renderização dos ícones de status (clock/check/warning).
- `src/components/SessionNotes.css`: Estilização dos novos estados visuais.

## Definição de Pronto (DoP)
- [ ] Notas enviadas são marcadas visualmente até a confirmação.
- [ ] Simular queda de rede não causa perda silenciosa de dados.
- [ ] O mestre e jogadores veem as mesmas notas após a sincronização.

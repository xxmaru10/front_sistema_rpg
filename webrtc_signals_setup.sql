-- =====================================================
-- Tabela para sinalização WebRTC (ScreenShare)
-- Execute este SQL no Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → Cole e rode
-- =====================================================

CREATE TABLE IF NOT EXISTS webrtc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    from_user TEXT NOT NULL,
    to_user TEXT,           -- NULL = broadcast para todos da sessão
    signal_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca eficiente por sessão
CREATE INDEX IF NOT EXISTS webrtc_signals_session_idx 
    ON webrtc_signals (session_id, created_at DESC);

-- Habilitar Row Level Security (necessário para Supabase funcionar)
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer cliente autenticado pode ler e escrever
-- (como o resto do app não usa auth, liberamos para todos)
CREATE POLICY "allow_all_webrtc_signals" ON webrtc_signals
    FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para esta tabela (necessário para postgres_changes subscription)
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;

-- Limpeza automática de sinais antigos (> 1 minuto)
-- Opcional: evita acúmulo de registros temporários
CREATE OR REPLACE FUNCTION cleanup_old_webrtc_signals()
RETURNS void AS $$
BEGIN
    DELETE FROM webrtc_signals 
    WHERE created_at < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Agendar limpeza a cada minuto (requer pg_cron extension no Supabase Pro)
-- Se não tiver pg_cron, os sinais são pequenos e podem ficar no banco sem problema.
-- SELECT cron.schedule('cleanup-webrtc', '* * * * *', 'SELECT cleanup_old_webrtc_signals()');

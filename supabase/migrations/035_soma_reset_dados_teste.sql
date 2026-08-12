-- Reset de dados de teste antes de produção "pra valer": apaga todos os
-- processos (e em cascata orçamentos, itens de orçamento, pagamentos,
-- documentos, pendências e andamentos), zera o log de auditoria (senão
-- fica cheio de registros órfãos apontando pra dados que não existem
-- mais) e reinicia a numeração SOMA-AAAA-XXXX do zero.
--
-- Não mexe em soma.usuarios, soma.imobiliarias, soma.servicos,
-- soma.servico_precos, soma.tabela_custas, soma.perfil_acesso nem
-- soma.cidades — só o que é dado transacional de teste.

TRUNCATE TABLE soma.processos CASCADE;

TRUNCATE TABLE soma.log_auditoria;

ALTER SEQUENCE soma.seq_numero_processo RESTART WITH 1;

Estrutura atual do banco de dados `estudos` — gerado em 26/05/2026.

---

## Tabelas da Aplicação

```sql
CREATE TABLE empresa (
  id_empresa bigint NOT NULL AUTO_INCREMENT,
  nm_empresa varchar(200) NOT NULL,
  cnpj varchar(10) NOT NULL,
  config_taxas_km json DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa),
  UNIQUE KEY cnpj (cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE usuario (
  id_usuario bigint NOT NULL AUTO_INCREMENT,
  nm_usuario varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  senha_hash varchar(255) NOT NULL,
  perfil enum('ADMIN','GERENTE','CLIENTE','ENTREGADOR','ATENDENTE') NOT NULL,
  fl_ativo tinyint(1) DEFAULT '1',
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE perfil (
  id_perfil bigint NOT NULL AUTO_INCREMENT,
  nm_perfil varchar(50) NOT NULL,
  ds_perfil varchar(200) DEFAULT NULL,
  permissoes_json json DEFAULT NULL,
  fl_ativo tinyint(1) DEFAULT '1',
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_perfil),
  UNIQUE KEY uk_nm_perfil (nm_perfil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE cliente (
  id_cliente bigint NOT NULL AUTO_INCREMENT,
  id_usuario bigint NOT NULL,
  telefone varchar(20) DEFAULT NULL,
  cpf varchar(14) DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cliente),
  UNIQUE KEY id_usuario (id_usuario),
  UNIQUE KEY cpf (cpf),
  CONSTRAINT cliente_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE entregador (
  id_entregador bigint NOT NULL AUTO_INCREMENT,
  id_usuario bigint NOT NULL,
  cpf varchar(14) NOT NULL,
  telefone varchar(20) DEFAULT NULL,
  fl_online tinyint(1) DEFAULT '0',
  latitude decimal(10,8) DEFAULT NULL,
  longitude decimal(11,8) DEFAULT NULL,
  veiculo_tipo varchar(50) DEFAULT NULL,
  dt_ultima_localizacao datetime DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_entregador),
  UNIQUE KEY id_usuario (id_usuario),
  UNIQUE KEY cpf (cpf),
  CONSTRAINT entregador_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE categoria (
  id_categoria bigint NOT NULL AUTO_INCREMENT,
  id_empresa bigint NOT NULL,
  nm_categoria varchar(100) NOT NULL,
  ds_categoria text,
  fl_ativa tinyint(1) DEFAULT '1',
  nr_ordem int DEFAULT '0',
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_categoria),
  KEY id_empresa (id_empresa),
  CONSTRAINT categoria_ibfk_1 FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE produto (
  id_produto bigint NOT NULL AUTO_INCREMENT,
  id_empresa bigint NOT NULL,
  id_categoria bigint NOT NULL,
  nm_produto varchar(150) NOT NULL,
  ds_produto text,
  vl_preco_base decimal(10,2) NOT NULL,
  tempo_preparo_min int DEFAULT NULL,
  fl_ativo tinyint(1) DEFAULT '1',
  url_imagem varchar(500) DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_produto),
  KEY id_empresa (id_empresa),
  KEY id_categoria (id_categoria),
  CONSTRAINT produto_ibfk_1 FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa),
  CONSTRAINT produto_ibfk_2 FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE ingrediente (
  id_ingrediente bigint NOT NULL AUTO_INCREMENT,
  id_empresa bigint NOT NULL,
  nm_ingrediente varchar(150) NOT NULL,
  unidade varchar(20) NOT NULL,
  fl_ativo tinyint(1) DEFAULT '1',
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_ingrediente),
  KEY id_empresa (id_empresa),
  CONSTRAINT ingrediente_ibfk_1 FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE produto_ingrediente (
  id_produto_ingrediente bigint NOT NULL AUTO_INCREMENT,
  id_produto bigint NOT NULL,
  id_ingrediente bigint NOT NULL,
  qtde decimal(10,3) NOT NULL,
  unidade varchar(20) NOT NULL,
  PRIMARY KEY (id_produto_ingrediente),
  UNIQUE KEY uk_produto_ingrediente (id_produto, id_ingrediente),
  KEY id_ingrediente (id_ingrediente),
  CONSTRAINT produto_ingrediente_ibfk_1 FOREIGN KEY (id_produto) REFERENCES produto (id_produto) ON DELETE CASCADE,
  CONSTRAINT produto_ingrediente_ibfk_2 FOREIGN KEY (id_ingrediente) REFERENCES ingrediente (id_ingrediente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE estoque_movimento (
  id_movimento bigint NOT NULL AUTO_INCREMENT,
  id_ingrediente bigint NOT NULL,
  tipo enum('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  qtde decimal(10,3) NOT NULL,
  custo_unitario decimal(10,2) DEFAULT NULL,
  ds_motivo varchar(255) DEFAULT NULL,
  dt_movimento datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_movimento),
  KEY id_ingrediente (id_ingrediente),
  CONSTRAINT estoque_movimento_ibfk_1 FOREIGN KEY (id_ingrediente) REFERENCES ingrediente (id_ingrediente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE mesa (
  id_mesa bigint NOT NULL AUTO_INCREMENT,
  id_empresa bigint NOT NULL,
  nr_mesa int NOT NULL,
  status_ocupacao enum('LIVRE','OCUPADA','RESERVADA') DEFAULT 'LIVRE',
  qr_code_token varchar(100) DEFAULT NULL,
  capacidade int DEFAULT '4',
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_mesa),
  UNIQUE KEY uk_mesa (id_empresa, nr_mesa),
  UNIQUE KEY qr_code_token (qr_code_token),
  CONSTRAINT mesa_ibfk_1 FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE pedido (
  id_pedido bigint NOT NULL AUTO_INCREMENT,
  id_empresa bigint NOT NULL,
  id_cliente bigint NOT NULL,
  id_mesa bigint DEFAULT NULL,
  tipo_pedido enum('MESA','DELIVERY','BALCAO') NOT NULL,
  status enum('PENDENTE','CONFIRMADO','PREPARANDO','PRONTO','ENTREGANDO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  vl_total decimal(12,2) NOT NULL,
  vl_taxa_entrega decimal(10,2) DEFAULT '0.00',
  ds_observacao text,
  dt_pedido datetime DEFAULT CURRENT_TIMESTAMP,
  dt_conclusao datetime DEFAULT NULL,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pedido),
  KEY id_empresa (id_empresa),
  KEY id_cliente (id_cliente),
  KEY id_mesa (id_mesa),
  CONSTRAINT pedido_ibfk_1 FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa),
  CONSTRAINT pedido_ibfk_2 FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT pedido_ibfk_3 FOREIGN KEY (id_mesa) REFERENCES mesa (id_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE item_pedido (
  id_item_pedido bigint NOT NULL AUTO_INCREMENT,
  id_pedido bigint NOT NULL,
  id_produto bigint NOT NULL,
  nr_quantidade int NOT NULL,
  vl_preco_unitario decimal(10,2) NOT NULL,
  vl_subtotal decimal(12,2) NOT NULL,
  adicionais_json json DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_item_pedido),
  KEY id_pedido (id_pedido),
  KEY id_produto (id_produto),
  CONSTRAINT item_pedido_ibfk_1 FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido) ON DELETE CASCADE,
  CONSTRAINT item_pedido_ibfk_2 FOREIGN KEY (id_produto) REFERENCES produto (id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE pagamento (
  id_pagamento bigint NOT NULL AUTO_INCREMENT,
  id_pedido bigint NOT NULL,
  forma enum('PIX','CARTAO','DINHEIRO') NOT NULL,
  status enum('PENDENTE','APROVADO','RECUSADO','ESTORNADO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  vl_total decimal(12,2) NOT NULL,
  vl_desconto decimal(12,2) DEFAULT '0.00',
  vl_final decimal(12,2) NOT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pagamento),
  UNIQUE KEY uk_pagamento_pedido (id_pedido),
  CONSTRAINT pagamento_ibfk_1 FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE transacao_pagamento (
  id_transacao bigint NOT NULL AUTO_INCREMENT,
  id_pagamento bigint NOT NULL,
  provedor varchar(100) DEFAULT NULL,
  nsu varchar(100) DEFAULT NULL,
  autorizacao varchar(100) DEFAULT NULL,
  bandeira varchar(50) DEFAULT NULL,
  parcelas int DEFAULT NULL,
  status enum('PENDENTE','APROVADA','RECUSADA','ESTORNADA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  payload_json json DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_transacao),
  KEY id_pagamento (id_pagamento),
  CONSTRAINT transacao_pagamento_ibfk_1 FOREIGN KEY (id_pagamento) REFERENCES pagamento (id_pagamento) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE entrega (
  id_entrega bigint NOT NULL AUTO_INCREMENT,
  id_pedido bigint NOT NULL,
  id_entregador bigint DEFAULT NULL,
  status_entrega enum('AGUARDANDO','COLETADO','EM_ROTA','ENTREGUE','CANCELADA') DEFAULT 'AGUARDANDO',
  latitude_coleta decimal(10,8) DEFAULT NULL,
  longitude_coleta decimal(11,8) DEFAULT NULL,
  latitude_destino decimal(10,8) DEFAULT NULL,
  longitude_destino decimal(11,8) DEFAULT NULL,
  horario_saida datetime DEFAULT NULL,
  horario_chegada datetime DEFAULT NULL,
  rota_json json DEFAULT NULL,
  distancia_km decimal(8,2) DEFAULT NULL,
  tempo_estimado_min int DEFAULT NULL,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  dt_atualizacao datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_entrega),
  UNIQUE KEY id_pedido (id_pedido),
  KEY id_entregador (id_entregador),
  CONSTRAINT entrega_ibfk_1 FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
  CONSTRAINT entrega_ibfk_2 FOREIGN KEY (id_entregador) REFERENCES entregador (id_entregador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE avaliacao (
  id_avaliacao bigint NOT NULL AUTO_INCREMENT,
  id_pedido bigint NOT NULL,
  id_cliente bigint NOT NULL,
  id_entregador bigint DEFAULT NULL,
  nota tinyint NOT NULL,
  ds_comentario text,
  dt_cadastro datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_avaliacao),
  KEY id_pedido (id_pedido),
  KEY id_cliente (id_cliente),
  KEY id_entregador (id_entregador),
  CONSTRAINT avaliacao_ibfk_1 FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
  CONSTRAINT avaliacao_ibfk_2 FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT avaliacao_ibfk_3 FOREIGN KEY (id_entregador) REFERENCES entregador (id_entregador),
  CONSTRAINT avaliacao_chk_1 CHECK (nota between 1 and 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

## Tabelas do Laravel (internas do framework)

```sql
CREATE TABLE migrations (
  id int unsigned NOT NULL AUTO_INCREMENT,
  migration varchar(255) NOT NULL,
  batch int NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE users (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  email_verified_at timestamp NULL DEFAULT NULL,
  password varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'atendente',
  is_active tinyint(1) NOT NULL DEFAULT '1',
  remember_token varchar(100) DEFAULT NULL,
  created_at timestamp NULL DEFAULT NULL,
  updated_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE personal_access_tokens (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  tokenable_type varchar(255) NOT NULL,
  tokenable_id bigint unsigned NOT NULL,
  name text NOT NULL,
  token varchar(64) NOT NULL,
  abilities text,
  last_used_at timestamp NULL DEFAULT NULL,
  expires_at timestamp NULL DEFAULT NULL,
  created_at timestamp NULL DEFAULT NULL,
  updated_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY personal_access_tokens_token_unique (token),
  KEY personal_access_tokens_tokenable_type_tokenable_id_index (tokenable_type, tokenable_id),
  KEY personal_access_tokens_expires_at_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE password_reset_tokens (
  email varchar(255) NOT NULL,
  token varchar(255) NOT NULL,
  created_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE sessions (
  id varchar(255) NOT NULL,
  user_id bigint unsigned DEFAULT NULL,
  ip_address varchar(45) DEFAULT NULL,
  user_agent text,
  payload longtext NOT NULL,
  last_activity int NOT NULL,
  PRIMARY KEY (id),
  KEY sessions_user_id_index (user_id),
  KEY sessions_last_activity_index (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE cache (
  `key` varchar(255) NOT NULL,
  value mediumtext NOT NULL,
  expiration int NOT NULL,
  PRIMARY KEY (`key`),
  KEY cache_expiration_index (expiration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE cache_locks (
  `key` varchar(255) NOT NULL,
  owner varchar(255) NOT NULL,
  expiration int NOT NULL,
  PRIMARY KEY (`key`),
  KEY cache_locks_expiration_index (expiration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE jobs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  queue varchar(255) NOT NULL,
  payload longtext NOT NULL,
  attempts tinyint unsigned NOT NULL,
  reserved_at int unsigned DEFAULT NULL,
  available_at int unsigned NOT NULL,
  created_at int unsigned NOT NULL,
  PRIMARY KEY (id),
  KEY jobs_queue_index (queue)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE job_batches (
  id varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  total_jobs int NOT NULL,
  pending_jobs int NOT NULL,
  failed_jobs int NOT NULL,
  failed_job_ids longtext NOT NULL,
  options mediumtext,
  cancelled_at int DEFAULT NULL,
  created_at int NOT NULL,
  finished_at int DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE failed_jobs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  uuid varchar(255) NOT NULL,
  connection text NOT NULL,
  queue text NOT NULL,
  payload longtext NOT NULL,
  exception longtext NOT NULL,
  failed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY failed_jobs_uuid_unique (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

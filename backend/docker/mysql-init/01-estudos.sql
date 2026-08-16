-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: estudos
-- ------------------------------------------------------
-- Server version	11.8.8-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `avaliacao`
--

DROP TABLE IF EXISTS `avaliacao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `avaliacao` (
  `id_avaliacao` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint(20) NOT NULL,
  `id_cliente` bigint(20) NOT NULL,
  `id_entregador` bigint(20) DEFAULT NULL,
  `nota` tinyint(4) NOT NULL,
  `ds_comentario` text DEFAULT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_avaliacao`),
  KEY `id_pedido` (`id_pedido`),
  KEY `id_cliente` (`id_cliente`),
  KEY `id_entregador` (`id_entregador`),
  CONSTRAINT `avaliacao_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`),
  CONSTRAINT `avaliacao_ibfk_2` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `avaliacao_ibfk_3` FOREIGN KEY (`id_entregador`) REFERENCES `entregador` (`id_entregador`),
  CONSTRAINT `avaliacao_chk_1` CHECK (`nota` between 1 and 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `avaliacao`
--

LOCK TABLES `avaliacao` WRITE;
/*!40000 ALTER TABLE `avaliacao` DISABLE KEYS */;
/*!40000 ALTER TABLE `avaliacao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categoria`
--

DROP TABLE IF EXISTS `categoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categoria` (
  `id_categoria` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_empresa` bigint(20) NOT NULL,
  `nm_categoria` varchar(100) NOT NULL,
  `ds_categoria` text DEFAULT NULL,
  `fl_ativa` tinyint(1) DEFAULT 1,
  `nr_ordem` int(11) DEFAULT 0,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_categoria`),
  KEY `id_empresa` (`id_empresa`),
  CONSTRAINT `categoria_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id_empresa`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categoria`
--

LOCK TABLES `categoria` WRITE;
/*!40000 ALTER TABLE `categoria` DISABLE KEYS */;
INSERT INTO `categoria` VALUES (1,1,'Destaques','Itens principais do restaurante',1,1,'2026-08-15 17:15:18'),(2,1,'Hamburgueres',NULL,1,0,'2026-08-15 22:02:53'),(3,1,'Porcoes',NULL,1,0,'2026-08-15 22:02:53'),(4,1,'Combos',NULL,1,0,'2026-08-15 22:02:53'),(5,1,'Bebidas',NULL,1,0,'2026-08-15 22:02:53');
/*!40000 ALTER TABLE `categoria` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cliente`
--

DROP TABLE IF EXISTS `cliente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cliente` (
  `id_cliente` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_usuario` bigint(20) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_cliente`),
  UNIQUE KEY `id_usuario` (`id_usuario`),
  UNIQUE KEY `cpf` (`cpf`),
  UNIQUE KEY `cliente_telefone_unique` (`telefone`),
  CONSTRAINT `cliente_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cliente`
--

LOCK TABLES `cliente` WRITE;
/*!40000 ALTER TABLE `cliente` DISABLE KEYS */;
INSERT INTO `cliente` VALUES (33,42,'11999990099',NULL,'2026-08-16 03:58:30');
/*!40000 ALTER TABLE `cliente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comanda`
--

DROP TABLE IF EXISTS `comanda`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comanda` (
  `id_comanda` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_mesa` bigint(20) NOT NULL,
  `status` enum('ABERTA','AGUARDANDO_PAGAMENTO','PAGA','CANCELADA') NOT NULL DEFAULT 'ABERTA',
  `forma_pagamento` enum('PIX','CARTAO','DINHEIRO') DEFAULT NULL,
  `id_usuario_confirmou` bigint(20) DEFAULT NULL,
  `dt_fechamento` timestamp NULL DEFAULT NULL,
  `dt_cadastro` timestamp NOT NULL DEFAULT current_timestamp(),
  `dt_atualizacao` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_comanda`),
  KEY `comanda_id_mesa_foreign` (`id_mesa`),
  KEY `comanda_id_usuario_confirmou_foreign` (`id_usuario_confirmou`),
  CONSTRAINT `comanda_id_mesa_foreign` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`),
  CONSTRAINT `comanda_id_usuario_confirmou_foreign` FOREIGN KEY (`id_usuario_confirmou`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comanda`
--

LOCK TABLES `comanda` WRITE;
/*!40000 ALTER TABLE `comanda` DISABLE KEYS */;
/*!40000 ALTER TABLE `comanda` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dashboard_snapshots`
--

DROP TABLE IF EXISTS `dashboard_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dashboard_snapshots` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) NOT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload_json`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dashboard_snapshots_slug_unique` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dashboard_snapshots`
--

LOCK TABLES `dashboard_snapshots` WRITE;
/*!40000 ALTER TABLE `dashboard_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `dashboard_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empresa`
--

DROP TABLE IF EXISTS `empresa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `empresa` (
  `id_empresa` bigint(20) NOT NULL AUTO_INCREMENT,
  `nm_empresa` varchar(200) NOT NULL,
  `cnpj` varchar(10) NOT NULL,
  `chave_pix` varchar(150) DEFAULT NULL,
  `config_taxas_km` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config_taxas_km`)),
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_empresa`),
  UNIQUE KEY `cnpj` (`cnpj`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empresa`
--

LOCK TABLES `empresa` WRITE;
/*!40000 ALTER TABLE `empresa` DISABLE KEYS */;
INSERT INTO `empresa` VALUES (1,'Restaurante Modelo','1234567890','gabrielb_2009@outlook.com','{\"base\":6.5}','2026-08-15 17:15:18','2026-08-15 19:41:18');
/*!40000 ALTER TABLE `empresa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrega`
--

DROP TABLE IF EXISTS `entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `entrega` (
  `id_entrega` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint(20) NOT NULL,
  `id_entregador` bigint(20) DEFAULT NULL,
  `codigo_confirmacao_entrega` varchar(20) DEFAULT NULL,
  `status_entrega` enum('AGUARDANDO','COLETADO','EM_ROTA','ENTREGUE','CANCELADA') DEFAULT 'AGUARDANDO',
  `latitude_coleta` decimal(10,8) DEFAULT NULL,
  `longitude_coleta` decimal(11,8) DEFAULT NULL,
  `latitude_destino` decimal(10,8) DEFAULT NULL,
  `longitude_destino` decimal(11,8) DEFAULT NULL,
  `horario_saida` datetime DEFAULT NULL,
  `horario_chegada` datetime DEFAULT NULL,
  `rota_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rota_json`)),
  `distancia_km` decimal(8,2) DEFAULT NULL,
  `tempo_estimado_min` int(11) DEFAULT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_entrega`),
  UNIQUE KEY `id_pedido` (`id_pedido`),
  KEY `id_entregador` (`id_entregador`),
  CONSTRAINT `entrega_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`),
  CONSTRAINT `entrega_ibfk_2` FOREIGN KEY (`id_entregador`) REFERENCES `entregador` (`id_entregador`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrega`
--

LOCK TABLES `entrega` WRITE;
/*!40000 ALTER TABLE `entrega` DISABLE KEYS */;
INSERT INTO `entrega` VALUES (41,53,NULL,NULL,'CANCELADA',NULL,NULL,-22.21405470,-49.96109200,NULL,NULL,NULL,NULL,NULL,'2026-08-16 03:58:30','2026-08-16 03:58:49');
/*!40000 ALTER TABLE `entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entregador`
--

DROP TABLE IF EXISTS `entregador`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `entregador` (
  `id_entregador` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_usuario` bigint(20) NOT NULL,
  `cpf` varchar(14) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `fl_online` tinyint(1) DEFAULT 0,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `veiculo_tipo` varchar(50) DEFAULT NULL,
  `codigo_pareamento` varchar(20) DEFAULT NULL,
  `codigo_pareamento_expira_em` timestamp NULL DEFAULT NULL,
  `dt_ultima_localizacao` datetime DEFAULT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_entregador`),
  UNIQUE KEY `id_usuario` (`id_usuario`),
  UNIQUE KEY `cpf` (`cpf`),
  UNIQUE KEY `entregador_codigo_pareamento_unique` (`codigo_pareamento`),
  CONSTRAINT `entregador_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entregador`
--

LOCK TABLES `entregador` WRITE;
/*!40000 ALTER TABLE `entregador` DISABLE KEYS */;
INSERT INTO `entregador` VALUES (1,8,'321.654.987-00','11999990007',1,NULL,NULL,'Moto',NULL,NULL,'2026-08-15 18:01:38','2026-08-15 18:01:38','2026-08-16 06:25:56'),(2,9,'888.888.888-88','11999990008',1,NULL,NULL,'Moto',NULL,NULL,'2026-08-15 18:01:38','2026-08-15 18:01:38','2026-08-16 05:43:04'),(3,10,'999.999.999-99','11999990009',0,NULL,NULL,'Carro','4P3IYGFS','2026-08-17 07:00:24','2026-08-15 18:01:38','2026-08-15 18:01:38','2026-08-16 04:00:24'),(4,15,NULL,'11987651234',0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-15 18:47:12','2026-08-15 18:47:12'),(5,16,NULL,'11988887777',0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-15 18:54:13','2026-08-15 18:55:48'),(6,23,NULL,'11999991234',0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-15 21:26:39','2026-08-15 21:27:01'),(7,24,NULL,'11999990010',0,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-15 21:29:22','2026-08-16 14:58:48');
/*!40000 ALTER TABLE `entregador` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estoque_movimento`
--

DROP TABLE IF EXISTS `estoque_movimento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `estoque_movimento` (
  `id_movimento` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_ingrediente` bigint(20) NOT NULL,
  `tipo` enum('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  `qtde` decimal(10,3) NOT NULL,
  `custo_unitario` decimal(10,2) DEFAULT NULL,
  `ds_motivo` varchar(255) DEFAULT NULL,
  `dt_movimento` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_movimento`),
  KEY `id_ingrediente` (`id_ingrediente`),
  CONSTRAINT `estoque_movimento_ibfk_1` FOREIGN KEY (`id_ingrediente`) REFERENCES `ingrediente` (`id_ingrediente`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estoque_movimento`
--

LOCK TABLES `estoque_movimento` WRITE;
/*!40000 ALTER TABLE `estoque_movimento` DISABLE KEYS */;
/*!40000 ALTER TABLE `estoque_movimento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fechamento_caixa_entregador`
--

DROP TABLE IF EXISTS `fechamento_caixa_entregador`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fechamento_caixa_entregador` (
  `id_fechamento` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_entregador` bigint(20) NOT NULL,
  `dt_referencia` date NOT NULL,
  `qtd_entregas` int(10) unsigned NOT NULL DEFAULT 0,
  `vl_total_taxas` decimal(12,2) NOT NULL DEFAULT 0.00,
  `vl_dinheiro_recebido` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status_pagamento` enum('PENDENTE','PAGO') NOT NULL DEFAULT 'PENDENTE',
  `dt_fechamento` timestamp NULL DEFAULT NULL,
  `dt_cadastro` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_fechamento`),
  UNIQUE KEY `uk_fechamento_entregador_data` (`id_entregador`,`dt_referencia`),
  CONSTRAINT `fechamento_caixa_entregador_id_entregador_foreign` FOREIGN KEY (`id_entregador`) REFERENCES `entregador` (`id_entregador`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fechamento_caixa_entregador`
--

LOCK TABLES `fechamento_caixa_entregador` WRITE;
/*!40000 ALTER TABLE `fechamento_caixa_entregador` DISABLE KEYS */;
/*!40000 ALTER TABLE `fechamento_caixa_entregador` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ingrediente`
--

DROP TABLE IF EXISTS `ingrediente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ingrediente` (
  `id_ingrediente` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_empresa` bigint(20) NOT NULL,
  `nm_ingrediente` varchar(150) NOT NULL,
  `unidade` varchar(20) NOT NULL,
  `fl_ativo` tinyint(1) DEFAULT 1,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_ingrediente`),
  KEY `id_empresa` (`id_empresa`),
  CONSTRAINT `ingrediente_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id_empresa`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ingrediente`
--

LOCK TABLES `ingrediente` WRITE;
/*!40000 ALTER TABLE `ingrediente` DISABLE KEYS */;
/*!40000 ALTER TABLE `ingrediente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_pedido`
--

DROP TABLE IF EXISTS `item_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `item_pedido` (
  `id_item_pedido` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint(20) NOT NULL,
  `id_produto` bigint(20) NOT NULL,
  `nr_quantidade` int(11) NOT NULL,
  `vl_preco_unitario` decimal(10,2) NOT NULL,
  `vl_subtotal` decimal(12,2) NOT NULL,
  `adicionais_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`adicionais_json`)),
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_item_pedido`),
  KEY `id_pedido` (`id_pedido`),
  KEY `id_produto` (`id_produto`),
  CONSTRAINT `item_pedido_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`) ON DELETE CASCADE,
  CONSTRAINT `item_pedido_ibfk_2` FOREIGN KEY (`id_produto`) REFERENCES `produto` (`id_produto`)
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_pedido`
--

LOCK TABLES `item_pedido` WRITE;
/*!40000 ALTER TABLE `item_pedido` DISABLE KEYS */;
INSERT INTO `item_pedido` VALUES (78,53,10,1,32.90,32.90,NULL,'2026-08-16 03:58:30');
/*!40000 ALTER TABLE `item_pedido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mesa`
--

DROP TABLE IF EXISTS `mesa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mesa` (
  `id_mesa` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_empresa` bigint(20) NOT NULL,
  `nr_mesa` int(11) NOT NULL,
  `status_ocupacao` enum('LIVRE','OCUPADA','RESERVADA') DEFAULT 'LIVRE',
  `qr_code_token` varchar(100) DEFAULT NULL,
  `capacidade` int(11) DEFAULT 4,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_mesa`),
  UNIQUE KEY `uk_mesa` (`id_empresa`,`nr_mesa`),
  UNIQUE KEY `qr_code_token` (`qr_code_token`),
  CONSTRAINT `mesa_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id_empresa`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mesa`
--

LOCK TABLES `mesa` WRITE;
/*!40000 ALTER TABLE `mesa` DISABLE KEYS */;
INSERT INTO `mesa` VALUES (1,1,1,'LIVRE','mesa-1',4,'2026-08-15 17:15:18'),(2,1,2,'LIVRE','mesa-2',4,'2026-08-15 17:15:18'),(3,1,3,'LIVRE','mesa-3',6,'2026-08-15 17:15:18'),(4,1,4,'LIVRE','mesa-4',4,'2026-08-15 17:15:18'),(5,1,5,'LIVRE','mesa-5',6,'2026-08-15 17:15:18'),(6,1,11,'LIVRE','mesa-11',4,'2026-08-15 17:15:18'),(7,1,12,'LIVRE','mesa-12',4,'2026-08-15 17:15:18'),(8,1,13,'LIVRE','mesa-13',4,'2026-08-15 17:15:18'),(9,1,14,'LIVRE','mesa-14',4,'2026-08-15 17:15:18');
/*!40000 ALTER TABLE `mesa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_05_12_120000_add_role_and_is_active_to_users_table',1),(5,'2026_05_13_002645_create_personal_access_tokens_table',1),(6,'2026_05_26_024611_alter_usuario_perfil_enum',1),(7,'2026_08_03_200000_create_dashboard_snapshots_table',1),(8,'2026_08_15_000001_add_codigo_qr_to_pedido_table',1),(9,'2026_08_15_000002_add_codigo_confirmacao_to_entrega_table',1),(10,'2026_08_15_000003_add_troco_para_to_pagamento_table',1),(11,'2026_08_15_000004_create_rota_entrega_table',2),(12,'2026_08_15_000005_create_rota_entrega_item_table',2),(13,'2026_08_15_000006_create_fechamento_caixa_entregador_table',2),(14,'2026_08_15_000007_add_canal_origem_to_pedido_table',3),(15,'2026_08_15_000008_make_entregador_cpf_nullable',4),(16,'2026_08_15_000009_add_pareamento_to_entregador_table',5),(17,'2026_08_15_000010_create_comanda_table',6),(18,'2026_08_15_000011_add_comanda_to_pedido_table',7),(19,'2026_08_15_000012_add_unique_telefone_to_cliente_table',7),(20,'2026_08_15_000013_add_chave_pix_to_empresa_table',8),(21,'2026_08_15_000014_add_nr_pedido_delivery_to_pedido_table',9),(22,'2026_08_15_000015_add_online_to_canal_origem_enum',10),(23,'2026_08_15_000016_add_motivo_cancelamento_to_pedido_table',10),(24,'2026_08_16_000001_drop_legacy_laravel_users_tables',11);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pagamento`
--

DROP TABLE IF EXISTS `pagamento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pagamento` (
  `id_pagamento` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pedido` bigint(20) NOT NULL,
  `forma` enum('PIX','CARTAO','DINHEIRO') NOT NULL,
  `troco_para` decimal(10,2) DEFAULT NULL,
  `status` enum('PENDENTE','APROVADO','RECUSADO','ESTORNADO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  `vl_total` decimal(12,2) NOT NULL,
  `vl_desconto` decimal(12,2) DEFAULT 0.00,
  `vl_final` decimal(12,2) NOT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_pagamento`),
  UNIQUE KEY `uk_pagamento_pedido` (`id_pedido`),
  CONSTRAINT `pagamento_ibfk_1` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id_pedido`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pagamento`
--

LOCK TABLES `pagamento` WRITE;
/*!40000 ALTER TABLE `pagamento` DISABLE KEYS */;
INSERT INTO `pagamento` VALUES (53,53,'PIX',NULL,'PENDENTE',32.90,0.00,32.90,'2026-08-16 03:58:30','2026-08-16 03:58:30');
/*!40000 ALTER TABLE `pagamento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedido`
--

DROP TABLE IF EXISTS `pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pedido` (
  `id_pedido` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_empresa` bigint(20) NOT NULL,
  `id_cliente` bigint(20) NOT NULL,
  `id_mesa` bigint(20) DEFAULT NULL,
  `id_comanda` bigint(20) unsigned DEFAULT NULL,
  `codigo_qr` varchar(100) DEFAULT NULL,
  `tipo_pedido` enum('MESA','DELIVERY','BALCAO') NOT NULL,
  `nr_pedido_delivery` int(10) unsigned DEFAULT NULL,
  `canal_origem` enum('LOJA','IFOOD','99FOOD','ONLINE') DEFAULT 'LOJA',
  `status` enum('PENDENTE','CONFIRMADO','PREPARANDO','PRONTO','ENTREGANDO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  `motivo_cancelamento` text DEFAULT NULL,
  `vl_total` decimal(12,2) NOT NULL,
  `vl_taxa_entrega` decimal(10,2) DEFAULT 0.00,
  `ds_observacao` text DEFAULT NULL,
  `dt_pedido` datetime DEFAULT current_timestamp(),
  `dt_conclusao` datetime DEFAULT NULL,
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `pedido_codigo_qr_unique` (`codigo_qr`),
  KEY `id_empresa` (`id_empresa`),
  KEY `id_cliente` (`id_cliente`),
  KEY `id_mesa` (`id_mesa`),
  KEY `pedido_id_comanda_foreign` (`id_comanda`),
  CONSTRAINT `pedido_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id_empresa`),
  CONSTRAINT `pedido_ibfk_2` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `pedido_ibfk_3` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`),
  CONSTRAINT `pedido_id_comanda_foreign` FOREIGN KEY (`id_comanda`) REFERENCES `comanda` (`id_comanda`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedido`
--

LOCK TABLES `pedido` WRITE;
/*!40000 ALTER TABLE `pedido` DISABLE KEYS */;
INSERT INTO `pedido` VALUES (53,1,33,NULL,NULL,'abbc14ef-5937-4968-9ef7-410fe87f0364','DELIVERY',1,'ONLINE','CANCELADO','Nao informado',32.90,8.00,'Rua Santa Cecília, 472, Alto Cafezal - Marília/SP','2026-08-16 03:58:30','2026-08-16 03:58:49','2026-08-16 03:58:49');
/*!40000 ALTER TABLE `pedido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `perfil`
--

DROP TABLE IF EXISTS `perfil`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `perfil` (
  `id_perfil` bigint(20) NOT NULL AUTO_INCREMENT,
  `nm_perfil` varchar(50) NOT NULL,
  `ds_perfil` varchar(200) DEFAULT NULL,
  `permissoes_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissoes_json`)),
  `fl_ativo` tinyint(1) DEFAULT 1,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_perfil`),
  UNIQUE KEY `uk_nm_perfil` (`nm_perfil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `perfil`
--

LOCK TABLES `perfil` WRITE;
/*!40000 ALTER TABLE `perfil` DISABLE KEYS */;
/*!40000 ALTER TABLE `perfil` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\User',1,'api-token','e6659a4e531231b1cf05663daeccdd92bd5a239b429cf6e99539d489a9da01d4','[\"*\"]',NULL,NULL,'2026-08-15 21:01:47','2026-08-15 21:01:47'),(2,'App\\Models\\User',8,'api-token','5648cb6effd0304e25a2a0e60e651fdb0d2653cdf87d220f41be1e2776552c33','[\"*\"]',NULL,NULL,'2026-08-15 21:23:34','2026-08-15 21:23:34'),(3,'App\\Models\\User',1,'api-token','a8fd7b336b5fc95bf474f350248460b25dae97c17378fb8bf6d6b7cebe99c60f','[\"*\"]',NULL,NULL,'2026-08-15 21:28:18','2026-08-15 21:28:18'),(4,'App\\Models\\User',1,'api-token','cb72fdb20baf972bbd21a27831cca72b7359941954fa7ea17e18dc0a1d52c6b0','[\"*\"]',NULL,NULL,'2026-08-15 21:43:59','2026-08-15 21:43:59'),(5,'App\\Models\\User',1,'api-token','43a6af2c53671c14afabba25302963f1c9f2ddc968aecf5697926486ff136a1e','[\"*\"]',NULL,NULL,'2026-08-15 21:47:11','2026-08-15 21:47:11'),(6,'App\\Models\\User',15,'api-token','9282d44ba3d2f181839c7f91759bdfa56d487f0d329e922dbffcbe15a04f0fce','[\"*\"]',NULL,NULL,'2026-08-15 21:47:12','2026-08-15 21:47:12'),(7,'App\\Models\\User',1,'api-token','c3302112f6033da2eebb2499397208e0c5b418b103fd984df090971dba14012e','[\"*\"]',NULL,NULL,'2026-08-15 21:53:32','2026-08-15 21:53:32'),(8,'App\\Models\\User',16,'api-token','34dbe9dbfb7792eb6786c6865b95521db114c3a51fe4f23e665b564918122fe5','[\"*\"]',NULL,NULL,'2026-08-15 21:55:48','2026-08-15 21:55:48'),(9,'App\\Models\\User',1,'api-token','ef3ce902a88e7d96e554921fe8b8d53b1f53286dc95545b784c060ddc3befa6f','[\"*\"]',NULL,NULL,'2026-08-15 22:18:06','2026-08-15 22:18:06'),(10,'App\\Models\\User',1,'api-token','5f7a7d3e80c7d35c5ad6d0f370cd607a8fce2ca8da3fc9d06b5d0183d12b2015','[\"*\"]',NULL,NULL,'2026-08-15 22:36:37','2026-08-15 22:36:37'),(11,'App\\Models\\User',1,'api-token','580451a0b6a17ac5ec851df7620a957efab13a8783b5bd0ba0842855a799cec3','[\"*\"]',NULL,NULL,'2026-08-15 22:41:17','2026-08-15 22:41:17'),(12,'App\\Models\\User',1,'api-token','be5f69186ef11a3be5eb7f9806fd561c0f6bbff5f01d302494ddd764bf3a2f88','[\"*\"]',NULL,NULL,'2026-08-15 23:27:42','2026-08-15 23:27:42'),(13,'App\\Models\\User',8,'debug','5407be53fb37e5c3e382882ccf742d349e0dca847b92436cef0c8570f39d6f84','[\"*\"]',NULL,NULL,'2026-08-16 00:04:17','2026-08-16 00:04:17'),(14,'App\\Models\\User',1,'api-token','61e9b4a119a2816761cb83ee4446e9d1770b00ef0eb888aff9bbb2882348d6c8','[\"*\"]',NULL,NULL,'2026-08-16 00:24:31','2026-08-16 00:24:31'),(15,'App\\Models\\User',8,'api-token','cac466381f0785492e7b999b0153782c4d72a589f1719d9aebd96c25769907af','[\"*\"]',NULL,NULL,'2026-08-16 00:25:56','2026-08-16 00:25:56'),(16,'App\\Models\\User',23,'api-token','0ecaee9b6ad912764a7113e6db01e688e20b51716f4c11c460ad1605bcc3f8b5','[\"*\"]',NULL,NULL,'2026-08-16 00:27:01','2026-08-16 00:27:01'),(17,'App\\Models\\User',24,'api-token','dcd466149d52a7a6b1914e60e8fdf7ba22076b6c2e608db5aaca205cb3aeffaa','[\"*\"]',NULL,NULL,'2026-08-16 00:29:30','2026-08-16 00:29:30'),(18,'App\\Models\\User',1,'api-token','76981f00501a9c67a768c92e1158b7bb2a91dd769210d67da6fd2f70ae2b12bf','[\"*\"]',NULL,NULL,'2026-08-16 06:46:57','2026-08-16 06:46:57'),(19,'App\\Models\\User',1,'api-token','b9a23eb8ee55c1bf4c511c5ecb6440f8ce95b6f84e98d75631cbc95fceafdef0','[\"*\"]',NULL,NULL,'2026-08-16 06:46:59','2026-08-16 06:46:59'),(20,'App\\Models\\User',1,'api-token','347ab0dade25f6768f0f3152d33020f20d901abe6e94add2d6645fcc0d402fdf','[\"*\"]',NULL,NULL,'2026-08-16 06:47:15','2026-08-16 06:47:15'),(21,'App\\Models\\User',8,'api-token','4b4ab11a300d3403cd4e38120cb773a77f4de7f3083625711c002d687253f897','[\"*\"]',NULL,NULL,'2026-08-16 07:03:49','2026-08-16 07:03:49'),(22,'App\\Models\\User',8,'api-token','7b190b241aa307afa947e3bf37e48496b08e9746afa0b0afe2614356db56c79e','[\"*\"]',NULL,NULL,'2026-08-16 07:06:06','2026-08-16 07:06:06'),(23,'App\\Models\\User',1,'api-token','2197408de29ee9618b59ed43b367a4b254815bf0ccee354a3c9cff748a346fb7','[\"*\"]',NULL,NULL,'2026-08-16 07:27:19','2026-08-16 07:27:19'),(24,'App\\Models\\User',8,'api-token','fab308fcdf5423684e5cf9e3c84984dc6b05333262393f4b8697617038a57445','[\"*\"]',NULL,NULL,'2026-08-16 08:03:07','2026-08-16 08:03:07'),(25,'App\\Models\\User',8,'api-token','17d241829ca93e16134952a30816055415bc241d105e598d7b9c5efda210247f','[\"*\"]',NULL,NULL,'2026-08-16 08:06:05','2026-08-16 08:06:05'),(26,'App\\Models\\User',9,'api-token','d4c6b4d81e6fbef8c9dc78af8264f2959be76a5f1293251ba77a1070ad459aca','[\"*\"]',NULL,NULL,'2026-08-16 08:07:26','2026-08-16 08:07:26'),(27,'App\\Models\\User',8,'teste-grupo','fc742be0d6b05f9e1448a9886f488487c358aa1e0458f7004e4b94aad73017cd','[\"*\"]',NULL,NULL,'2026-08-16 08:27:59','2026-08-16 08:27:59'),(28,'App\\Models\\User',8,'api-token','db189d6c1946909695ee6f031d7feb4276f94cddddb7e453b73f9d50f8d955e3','[\"*\"]',NULL,NULL,'2026-08-16 08:41:30','2026-08-16 08:41:30'),(29,'App\\Models\\User',8,'api-token','89098d32c329e38cf6751ad3d324089697fb8c6cb9bfc885264a5d7c8c4fb21c','[\"*\"]',NULL,NULL,'2026-08-16 08:42:47','2026-08-16 08:42:47'),(30,'App\\Models\\User',9,'api-token','b3aab2b0a91481f9aa0bb34421f28065215bc47955d22c3cba6ec710deae248c','[\"*\"]',NULL,NULL,'2026-08-16 08:43:04','2026-08-16 08:43:04'),(31,'App\\Models\\User',8,'api-token','adafab2bf13732c9d3e68dcc9f3971061e4aa46aa7f091240e095ad6f7fdbc85','[\"*\"]',NULL,NULL,'2026-08-16 08:45:22','2026-08-16 08:45:22'),(32,'App\\Models\\User',8,'api-token','e419eaf5d45ee9b1b20379c4928d094bd76c503f7bfa87f1c395e2a8b30704bb','[\"*\"]',NULL,NULL,'2026-08-16 08:59:27','2026-08-16 08:59:27'),(33,'App\\Models\\User',8,'api-token','2709e0b06b65c6eede2563d1f1fc3379188658873fc9bace1ceb4dcded7bdfec','[\"*\"]',NULL,NULL,'2026-08-16 09:25:56','2026-08-16 09:25:56'),(34,'App\\Models\\User',1,'debug','01b3f746f39d571bf9d9743f32746f257e8381cd14ac9f243d199e6ac0d4fd34','[\"*\"]',NULL,NULL,'2026-08-16 06:50:52','2026-08-16 06:50:52'),(35,'App\\Models\\User',1,'api-token','17f84957d17e3df5a90ad3552aba6836443479016019166e3e5aed27ec76cc47','[\"*\"]',NULL,NULL,'2026-08-16 14:39:06','2026-08-16 14:39:06'),(36,'App\\Models\\User',1,'api-token','0b965f5e9da1e90cdb69f2aecc7374c0ce3df2ca92c93f004f72290f4d31ba3b','[\"*\"]',NULL,NULL,'2026-08-16 14:40:03','2026-08-16 14:40:03');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produto`
--

DROP TABLE IF EXISTS `produto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `produto` (
  `id_produto` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_empresa` bigint(20) NOT NULL,
  `id_categoria` bigint(20) NOT NULL,
  `nm_produto` varchar(150) NOT NULL,
  `ds_produto` text DEFAULT NULL,
  `vl_preco_base` decimal(10,2) NOT NULL,
  `tempo_preparo_min` int(11) DEFAULT NULL,
  `fl_ativo` tinyint(1) DEFAULT 1,
  `url_imagem` varchar(500) DEFAULT NULL,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_produto`),
  KEY `id_empresa` (`id_empresa`),
  KEY `id_categoria` (`id_categoria`),
  CONSTRAINT `produto_ibfk_1` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id_empresa`),
  CONSTRAINT `produto_ibfk_2` FOREIGN KEY (`id_categoria`) REFERENCES `categoria` (`id_categoria`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto`
--

LOCK TABLES `produto` WRITE;
/*!40000 ALTER TABLE `produto` DISABLE KEYS */;
INSERT INTO `produto` VALUES (1,1,1,'Pizza Calabresa','Pizza Calabresa',39.90,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(2,1,1,'Refrigerante Lata','Refrigerante Lata',9.30,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(3,1,1,'Lanche X','Lanche X',18.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(4,1,1,'Batata Media','Batata Media',12.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(5,1,1,'Suco','Suco',12.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(6,1,1,'File de Frango','File de Frango',26.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(7,1,1,'Arroz Integral','Arroz Integral',16.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(8,1,1,'Hamburguer Artesanal','Hamburguer Artesanal',28.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(9,1,1,'Batata Frita','Batata Frita',14.00,15,0,NULL,'2026-08-15 17:15:18','2026-08-15 19:02:16'),(10,1,2,'Hamburguer Smash Bacon','Pao brioche, dois smash burgers, queijo cheddar, bacon crocante e molho da casa.',32.90,15,1,'/images/produtos/hamburguer_smash_bacon.jpg','2026-08-15 22:02:53','2026-08-15 19:13:03'),(11,1,3,'Batata Rustica Especial','Batata crocante com paprica, parmesao e maionese verde.',18.50,15,1,'/images/produtos/batata_rustica.jpg','2026-08-15 22:02:53','2026-08-15 19:13:03'),(12,1,4,'Combo Burger + Refri','Smash burger classico com fritas individuais e refrigerante lata.',39.90,15,1,'/images/produtos/combo_burguer_refri.jpeg','2026-08-15 22:02:53','2026-08-15 19:13:03'),(13,1,2,'X-Tudo Artesanal','Pao brioche, hamburguer artesanal, presunto, queijo, ovo, bacon, alface e tomate.',45.99,15,1,'/images/produtos/x_tudo.jpeg','2026-08-15 22:02:53','2026-08-15 19:13:03'),(14,1,5,'Refrigerante 1 Litro','Garrafa de 1 litro, bem gelada.',8.00,15,1,'/images/produtos/refri_1_litro.webp','2026-08-15 22:02:53','2026-08-15 19:13:03'),(15,1,2,'X-Salada Artesanal','Pao brioche, hamburguer artesanal, queijo, alface, tomate e maionese da casa.',32.00,15,1,'/images/produtos/x_salada.jpg','2026-08-15 22:02:53','2026-08-15 19:13:03'),(16,1,5,'Suco','Suco natural, sabor da casa.',7.00,15,1,NULL,'2026-08-15 22:02:53','2026-08-15 22:02:53'),(17,1,1,'Suco Teste Grupo','Suco Teste Grupo',10.00,15,1,NULL,'2026-08-16 05:27:29','2026-08-16 05:27:29');
/*!40000 ALTER TABLE `produto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produto_ingrediente`
--

DROP TABLE IF EXISTS `produto_ingrediente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `produto_ingrediente` (
  `id_produto_ingrediente` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_produto` bigint(20) NOT NULL,
  `id_ingrediente` bigint(20) NOT NULL,
  `qtde` decimal(10,3) NOT NULL,
  `unidade` varchar(20) NOT NULL,
  PRIMARY KEY (`id_produto_ingrediente`),
  UNIQUE KEY `uk_produto_ingrediente` (`id_produto`,`id_ingrediente`),
  KEY `id_ingrediente` (`id_ingrediente`),
  CONSTRAINT `produto_ingrediente_ibfk_1` FOREIGN KEY (`id_produto`) REFERENCES `produto` (`id_produto`) ON DELETE CASCADE,
  CONSTRAINT `produto_ingrediente_ibfk_2` FOREIGN KEY (`id_ingrediente`) REFERENCES `ingrediente` (`id_ingrediente`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto_ingrediente`
--

LOCK TABLES `produto_ingrediente` WRITE;
/*!40000 ALTER TABLE `produto_ingrediente` DISABLE KEYS */;
/*!40000 ALTER TABLE `produto_ingrediente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rota_entrega`
--

DROP TABLE IF EXISTS `rota_entrega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rota_entrega` (
  `id_rota_entrega` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_entregador` bigint(20) NOT NULL,
  `status` enum('MONTANDO','EM_ANDAMENTO','CONCLUIDA','CANCELADA') NOT NULL DEFAULT 'MONTANDO',
  `ordem_otimizada_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ordem_otimizada_json`)),
  `dt_cadastro` timestamp NOT NULL DEFAULT current_timestamp(),
  `dt_atualizacao` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_rota_entrega`),
  KEY `rota_entrega_id_entregador_foreign` (`id_entregador`),
  CONSTRAINT `rota_entrega_id_entregador_foreign` FOREIGN KEY (`id_entregador`) REFERENCES `entregador` (`id_entregador`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rota_entrega`
--

LOCK TABLES `rota_entrega` WRITE;
/*!40000 ALTER TABLE `rota_entrega` DISABLE KEYS */;
/*!40000 ALTER TABLE `rota_entrega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rota_entrega_item`
--

DROP TABLE IF EXISTS `rota_entrega_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rota_entrega_item` (
  `id_rota_entrega_item` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_rota_entrega` bigint(20) unsigned NOT NULL,
  `id_entrega` bigint(20) NOT NULL,
  `ordem_sequencia` int(10) unsigned NOT NULL,
  `dt_entregue` timestamp NULL DEFAULT NULL,
  `dt_cadastro` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_rota_entrega_item`),
  UNIQUE KEY `uk_rota_entrega_item` (`id_rota_entrega`,`id_entrega`),
  KEY `rota_entrega_item_id_entrega_foreign` (`id_entrega`),
  CONSTRAINT `rota_entrega_item_id_entrega_foreign` FOREIGN KEY (`id_entrega`) REFERENCES `entrega` (`id_entrega`) ON DELETE CASCADE,
  CONSTRAINT `rota_entrega_item_id_rota_entrega_foreign` FOREIGN KEY (`id_rota_entrega`) REFERENCES `rota_entrega` (`id_rota_entrega`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rota_entrega_item`
--

LOCK TABLES `rota_entrega_item` WRITE;
/*!40000 ALTER TABLE `rota_entrega_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `rota_entrega_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transacao_pagamento`
--

DROP TABLE IF EXISTS `transacao_pagamento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transacao_pagamento` (
  `id_transacao` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pagamento` bigint(20) NOT NULL,
  `provedor` varchar(100) DEFAULT NULL,
  `nsu` varchar(100) DEFAULT NULL,
  `autorizacao` varchar(100) DEFAULT NULL,
  `bandeira` varchar(50) DEFAULT NULL,
  `parcelas` int(11) DEFAULT NULL,
  `status` enum('PENDENTE','APROVADA','RECUSADA','ESTORNADA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload_json`)),
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_transacao`),
  KEY `id_pagamento` (`id_pagamento`),
  CONSTRAINT `transacao_pagamento_ibfk_1` FOREIGN KEY (`id_pagamento`) REFERENCES `pagamento` (`id_pagamento`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transacao_pagamento`
--

LOCK TABLES `transacao_pagamento` WRITE;
/*!40000 ALTER TABLE `transacao_pagamento` DISABLE KEYS */;
/*!40000 ALTER TABLE `transacao_pagamento` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuario` (
  `id_usuario` bigint(20) NOT NULL AUTO_INCREMENT,
  `nm_usuario` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `senha_hash` varchar(255) NOT NULL,
  `perfil` enum('ADMIN','GERENTE','CLIENTE','ENTREGADOR','ATENDENTE') NOT NULL,
  `fl_ativo` tinyint(1) DEFAULT 1,
  `dt_cadastro` datetime DEFAULT current_timestamp(),
  `dt_atualizacao` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (1,'Administrador','gustavolimadossantos643@gmail.com','$2y$12$w8z5zIFwK67FFxg28cfcgeiI3nx435.YijrAqMxGY1vO7s0S3LKc2','ADMIN',1,'2026-08-15 18:01:36','2026-08-15 18:01:36'),(8,'Gabriel','gabriel.courier@example.com','$2y$12$AZQYhw6/0iZye3LOjMvB0uzrml7IrWnSwrTKduEQQyQOtu9E7Q8ee','ENTREGADOR',1,'2026-08-15 18:01:38','2026-08-15 18:01:38'),(9,'Silas','silas.courier@example.com','$2y$12$GTH7bBtcF8xDST0NIrZbZuPg/yuXzqXbnUe5LrMbTcX2JP8YaVrJC','ENTREGADOR',1,'2026-08-15 18:01:38','2026-08-15 18:01:38'),(10,'Debora','debora.courier@example.com','$2y$12$NIsB4jr2ZTv6obfB.03/3.enjgDAEsDthQNh9lOJSPCKgYryt9Dya','ENTREGADOR',1,'2026-08-15 18:01:38','2026-08-15 18:01:38'),(15,'Bruno Ferreira','bruno.ferreira+1786819631@entregador.local','$2y$12$WcXdJXpq5Eo1AvB816eAPOwzM3mCXcvKopUzbFcO3CbJfx5e8YlW2','ENTREGADOR',1,'2026-08-15 15:47:12','2026-08-15 15:47:12'),(16,'Carla Nunes','carla.nunes+1786820053@entregador.local','$2y$12$nbQOJK9xkbZveEV7RyVR7.kYZHoNkc/Okr7bRp8bwxOBjLVUyQs9C','ENTREGADOR',1,'2026-08-15 15:54:13','2026-08-15 15:54:13'),(23,'Motoboy Teste','motoboy.teste+1786829199@entregador.local','$2y$12$Mj8lDJfpggwynPKgjOWg9.whOZMd4HyqBV5mUzCHmiBvruTqTZjfa','ENTREGADOR',1,'2026-08-15 18:26:39','2026-08-15 18:26:39'),(24,'Gustavo Lima','gustavo.lima+1786829361@entregador.local','$2y$12$73xRREJuQjZxBpY9W.hcfO1u7VSERZqDtNgXcd223uRXKr8s3Jy12','ENTREGADOR',1,'2026-08-15 18:29:22','2026-08-15 18:29:22'),(42,'Gabriel','gabriel+1786863509@cliente.local','$2y$12$D8adE1Xj8yirJeQ3GZTOcuoXUn0D8lGZVD/lcLVAVAoxjvXtKb5zC','CLIENTE',1,'2026-08-16 03:58:30','2026-08-16 03:58:30');
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'estudos'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-16 11:59:20

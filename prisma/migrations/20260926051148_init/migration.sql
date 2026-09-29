-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `email_verified_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `api_key_hash` CHAR(64) NULL,
    `api_key_hint` VARCHAR(16) NULL,
    `api_key_created_at` DATETIME(3) NULL,
    `referral_code` VARCHAR(16) NOT NULL,
    `referred_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_api_key_hash_key`(`api_key_hash`),
    UNIQUE INDEX `users_referral_code_key`(`referral_code`),
    INDEX `users_referred_by_id_idx`(`referred_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `persistent` BOOLEAN NOT NULL DEFAULT false,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `purpose` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_tokens_token_hash_key`(`token_hash`),
    INDEX `auth_tokens_user_id_purpose_idx`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `reset_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL,
    `provider_code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `iso2` CHAR(2) NULL,
    `dial_code` VARCHAR(8) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 1000,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `countries_is_active_display_order_idx`(`is_active`, `display_order`),
    UNIQUE INDEX `countries_provider_provider_code_key`(`provider`, `provider_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL,
    `provider_code` VARCHAR(32) NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_popular` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 1000,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_slug_key`(`slug`),
    INDEX `services_is_active_is_popular_display_order_idx`(`is_active`, `is_popular`, `display_order`),
    UNIQUE INDEX `services_provider_provider_code_key`(`provider`, `provider_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NOT NULL,
    `country_id` INTEGER NOT NULL,
    `provider_cost` DECIMAL(18, 4) NOT NULL,
    `provider_currency` CHAR(3) NOT NULL,
    `price` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `price_override` DECIMAL(18, 4) NULL,
    `available` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `synced_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `prices_country_id_idx`(`country_id`),
    UNIQUE INDEX `prices_service_id_country_id_key`(`service_id`, `country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallets_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` CHAR(36) NOT NULL,
    `wallet_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `type` ENUM('DEPOSIT', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'REFERRAL_EARNING', 'AFFILIATE_EARNING') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
    `amount` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `balance_before` DECIMAL(18, 4) NOT NULL,
    `balance_after` DECIMAL(18, 4) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NULL,
    `order_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_reference_key`(`reference`),
    INDEX `transactions_wallet_id_created_at_idx`(`wallet_id`, `created_at`),
    INDEX `transactions_user_id_type_created_at_idx`(`user_id`, `type`, `created_at`),
    INDEX `transactions_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `service_id` INTEGER NOT NULL,
    `country_id` INTEGER NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `provider_activation_id` VARCHAR(64) NULL,
    `phone_number` VARCHAR(32) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SMS_RECEIVED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `price` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `provider_cost` DECIMAL(18, 4) NULL,
    `provider_currency` CHAR(3) NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `can_get_another_sms` BOOLEAN NOT NULL DEFAULT false,
    `cancelable_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `last_checked_at` DATETIME(3) NULL,
    `failure_reason` VARCHAR(255) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `orders_user_id_status_idx`(`user_id`, `status`),
    INDEX `orders_status_expires_at_idx`(`status`, `expires_at`),
    UNIQUE INDEX `orders_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    UNIQUE INDEX `orders_provider_provider_activation_id_key`(`provider`, `provider_activation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_messages` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `sender` VARCHAR(64) NULL,
    `text` TEXT NOT NULL,
    `code` VARCHAR(32) NULL,
    `status` ENUM('RECEIVED') NOT NULL DEFAULT 'RECEIVED',
    `provider_ref` VARCHAR(128) NOT NULL,
    `received_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sms_messages_order_id_provider_ref_key`(`order_id`, `provider_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partner_applications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `kind` ENUM('PROVIDER', 'SOFTWARE') NOT NULL,
    `contact_email` VARCHAR(254) NOT NULL,
    `contact_messenger` VARCHAR(100) NULL,
    `details` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `partner_applications_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(32) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `order_id` CHAR(36) NULL,
    `params` JSON NULL,
    `response` TEXT NULL,
    `http_status` INTEGER NULL,
    `duration_ms` INTEGER NOT NULL,
    `error_code` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `provider_requests_created_at_idx`(`created_at`),
    INDEX `provider_requests_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `level` ENUM('DEBUG', 'INFO', 'WARN', 'ERROR') NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `context` JSON NULL,
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_logs_created_at_idx`(`created_at`),
    INDEX `system_logs_source_created_at_idx`(`source`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referred_by_id_fkey` FOREIGN KEY (`referred_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prices` ADD CONSTRAINT `prices_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prices` ADD CONSTRAINT `prices_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sms_messages` ADD CONSTRAINT `sms_messages_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_applications` ADD CONSTRAINT `partner_applications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity guards that the Prisma schema language can't express.
-- ---------------------------------------------------------------------------

-- A wallet balance can never go below zero, whatever the application does.
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_balance_non_negative` CHECK (`balance` >= 0);

-- Transaction amounts must match the balance movement they record.
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_balance_consistent`
  CHECK (`balance_after` = `balance_before` + `amount` OR `status` <> 'COMPLETED');

-- The ledger is append-only: rows can't be deleted, and the only permitted
-- update is finalizing a PENDING row (e.g. a deposit awaiting confirmation).
CREATE TRIGGER `transactions_no_delete` BEFORE DELETE ON `transactions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'transactions ledger is append-only';

CREATE TRIGGER `transactions_limited_update` BEFORE UPDATE ON `transactions`
FOR EACH ROW
IF OLD.`status` <> 'PENDING'
   OR NEW.`amount` <> OLD.`amount`
   OR NEW.`reference` <> OLD.`reference`
   OR NEW.`wallet_id` <> OLD.`wallet_id`
   OR NEW.`type` <> OLD.`type` THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'transactions ledger is append-only';
END IF;

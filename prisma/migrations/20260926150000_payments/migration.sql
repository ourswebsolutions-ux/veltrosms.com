-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `payment_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `reference` VARCHAR(32) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `method` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(18, 4) NOT NULL,
    `fee` DECIMAL(18, 4) NOT NULL,
    `total` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `provider_payment_id` VARCHAR(191) NULL,
    `checkout_url` VARCHAR(1024) NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `needs_review` BOOLEAN NOT NULL DEFAULT false,
    `failure_reason` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NULL,
    `last_checked_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_reference_key`(`reference`),
    INDEX `payments_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `payments_user_id_status_idx`(`user_id`, `status`),
    INDEX `payments_status_expires_at_idx`(`status`, `expires_at`),
    UNIQUE INDEX `payments_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    UNIQUE INDEX `payments_provider_provider_payment_id_key`(`provider`, `provider_payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_events` (
    `id` CHAR(36) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `payment_id` CHAR(36) NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_events_payment_id_idx`(`payment_id`),
    UNIQUE INDEX `payment_events_provider_event_id_key`(`provider`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `transactions_payment_id_idx` ON `transactions`(`payment_id`);

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity guards (not expressible in the Prisma schema).
ALTER TABLE `payments` ADD CONSTRAINT `payments_amounts_valid`
  CHECK (`amount` > 0 AND `fee` >= 0 AND `total` = `amount` + `fee`);

-- A payment's money, currency and owner never change, and a paid payment
-- can only move on to REFUNDED (so it can never be "paid" — and credited — twice).
CREATE TRIGGER `payments_guarded_update` BEFORE UPDATE ON `payments`
FOR EACH ROW
IF NEW.`amount` <> OLD.`amount`
   OR NEW.`fee` <> OLD.`fee`
   OR NEW.`total` <> OLD.`total`
   OR NEW.`currency` <> OLD.`currency`
   OR NEW.`user_id` <> OLD.`user_id`
   OR (OLD.`status` = 'PAID' AND NEW.`status` NOT IN ('PAID', 'REFUNDED'))
   OR (OLD.`status` = 'REFUNDED' AND NEW.`status` <> 'REFUNDED') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment amounts and final states are immutable';
END IF;

CREATE TRIGGER `payments_no_delete` BEFORE DELETE ON `payments`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payments cannot be deleted';

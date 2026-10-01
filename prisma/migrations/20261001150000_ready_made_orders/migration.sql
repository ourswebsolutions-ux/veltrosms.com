-- CreateTable
CREATE TABLE `ready_made_orders` (
    `id` CHAR(36) NOT NULL,
    `reference` VARCHAR(16) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `offer_id` INTEGER NULL,
    `service_id` INTEGER NOT NULL,
    `country_id` INTEGER NULL,
    `service_name` VARCHAR(120) NOT NULL,
    `country_name` VARCHAR(120) NULL,
    `price` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('AWAITING_DELIVERY') NOT NULL DEFAULT 'AWAITING_DELIVERY',
    `idempotency_key` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ready_made_orders_reference_key`(`reference`),
    INDEX `ready_made_orders_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `ready_made_orders_offer_id_idx`(`offer_id`),
    INDEX `ready_made_orders_service_id_idx`(`service_id`),
    INDEX `ready_made_orders_country_id_idx`(`country_id`),
    INDEX `ready_made_orders_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `ready_made_orders_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ready_made_orders` ADD CONSTRAINT `ready_made_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ready_made_orders` ADD CONSTRAINT `ready_made_orders_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `ready_made_offers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ready_made_orders` ADD CONSTRAINT `ready_made_orders_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ready_made_orders` ADD CONSTRAINT `ready_made_orders_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity guards (same approach as payments): a paid Ready Made order's
-- buyer, amount, currency, product and reference never change, and orders are
-- never deleted (they back ledger entries). Deleting an offer may still clear
-- offer_id (ON DELETE SET NULL); the snapshot columns keep what was bought.
CREATE TRIGGER `ready_made_orders_guarded_update` BEFORE UPDATE ON `ready_made_orders`
FOR EACH ROW
IF NEW.`user_id` <> OLD.`user_id`
   OR NEW.`price` <> OLD.`price`
   OR NEW.`currency` <> OLD.`currency`
   OR NEW.`reference` <> OLD.`reference`
   OR NEW.`service_id` <> OLD.`service_id`
   OR NOT (NEW.`country_id` <=> OLD.`country_id`)
   OR NEW.`idempotency_key` <> OLD.`idempotency_key` THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ready made order amounts and owner are immutable';
END IF;

CREATE TRIGGER `ready_made_orders_no_delete` BEFORE DELETE ON `ready_made_orders`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ready made orders cannot be deleted';

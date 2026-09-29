-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_id` CHAR(36) NULL,
    `actor_email` VARCHAR(254) NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(32) NULL,
    `target_id` VARCHAR(64) NULL,
    `success` BOOLEAN NOT NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_logs_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_status_created_at_idx` ON `orders`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `orders_created_at_idx` ON `orders`(`created_at`);

-- CreateIndex
CREATE INDEX `payments_status_created_at_idx` ON `payments`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `payments_created_at_idx` ON `payments`(`created_at`);

-- CreateIndex
CREATE INDEX `users_role_idx` ON `users`(`role`);

-- CreateIndex
CREATE INDEX `users_status_created_at_idx` ON `users`(`status`, `created_at`);


-- The audit trail is append-only.
CREATE TRIGGER `audit_logs_no_update` BEFORE UPDATE ON `audit_logs`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit log is append-only';

CREATE TRIGGER `audit_logs_no_delete` BEFORE DELETE ON `audit_logs`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit log is append-only';

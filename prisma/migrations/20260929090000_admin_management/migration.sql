-- Admin management: "suspended" accounts with reason/admin/time, safe deletion
-- (anonymization), and descriptions on audit entries.

-- DISABLED → SUSPENDED without losing rows: widen, convert, then narrow.
ALTER TABLE `users` MODIFY `status` ENUM('ACTIVE', 'DISABLED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';
UPDATE `users` SET `status` = 'SUSPENDED' WHERE `status` = 'DISABLED';
ALTER TABLE `users` MODIFY `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `users`
    ADD COLUMN `suspension_reason` VARCHAR(300) NULL,
    ADD COLUMN `suspended_by_id` CHAR(36) NULL,
    ADD COLUMN `suspended_at` DATETIME(3) NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL;

ALTER TABLE `audit_logs` ADD COLUMN `description` VARCHAR(255) NULL;

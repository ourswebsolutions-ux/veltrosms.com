-- Manual (Easypaisa/JazzCash) top-ups reviewed by an administrator, and
-- email verification enforced again (existing accounts keep their state).

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `rejection_reason` VARCHAR(300) NULL,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL,
    ADD COLUMN `reviewed_by_id` CHAR(36) NULL,
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `email_verified_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `payments_provider_status_created_at_idx` ON `payments`(`provider`, `status`, `created_at`);


-- A rejected top-up is final too (it can never become paid/credited).
DROP TRIGGER IF EXISTS `payments_guarded_update`;
CREATE TRIGGER `payments_guarded_update` BEFORE UPDATE ON `payments`
FOR EACH ROW
IF NEW.`amount` <> OLD.`amount`
   OR NEW.`fee` <> OLD.`fee`
   OR NEW.`total` <> OLD.`total`
   OR NEW.`currency` <> OLD.`currency`
   OR NEW.`user_id` <> OLD.`user_id`
   OR (OLD.`status` = 'PAID' AND NEW.`status` NOT IN ('PAID', 'REFUNDED'))
   OR (OLD.`status` = 'REFUNDED' AND NEW.`status` <> 'REFUNDED')
   OR (OLD.`status` = 'REJECTED' AND NEW.`status` <> 'REJECTED') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'payment amounts and final states are immutable';
END IF;

-- AlterTable
ALTER TABLE `ready_made_orders` ADD COLUMN `completed_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('AWAITING_DELIVERY', 'COMPLETED') NOT NULL DEFAULT 'AWAITING_DELIVERY';

-- The customer can mark a Ready Made order COMPLETED once received. That is
-- final: it never goes back to AWAITING_DELIVERY and its completion time is
-- kept. Buyer, amount, currency, product and reference stay immutable.
DROP TRIGGER IF EXISTS `ready_made_orders_guarded_update`;

CREATE TRIGGER `ready_made_orders_guarded_update` BEFORE UPDATE ON `ready_made_orders`
FOR EACH ROW
IF NEW.`user_id` <> OLD.`user_id`
   OR NEW.`price` <> OLD.`price`
   OR NEW.`currency` <> OLD.`currency`
   OR NEW.`reference` <> OLD.`reference`
   OR NEW.`service_id` <> OLD.`service_id`
   OR NOT (NEW.`country_id` <=> OLD.`country_id`)
   OR NEW.`idempotency_key` <> OLD.`idempotency_key`
   OR (OLD.`status` = 'COMPLETED' AND (NEW.`status` <> 'COMPLETED' OR NOT (NEW.`completed_at` <=> OLD.`completed_at`)))
   OR (NEW.`status` = 'COMPLETED' AND NEW.`completed_at` IS NULL) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ready made order amounts, owner and completion are immutable';
END IF;

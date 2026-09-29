-- Re-establishes the money integrity guards from the init migration on
-- databases whose tables were created with `prisma db push` (which skips raw
-- SQL). Idempotent: safe where the guards already exist. (MariaDB syntax.)

-- A wallet balance can never go below zero.
ALTER TABLE `wallets` DROP CONSTRAINT IF EXISTS `wallets_balance_non_negative`;
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_balance_non_negative` CHECK (`balance` >= 0);

-- Completed ledger rows must record a consistent balance movement.
ALTER TABLE `transactions` DROP CONSTRAINT IF EXISTS `transactions_balance_consistent`;
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_balance_consistent`
  CHECK (`balance_after` = `balance_before` + `amount` OR `status` <> 'COMPLETED');

-- Append-only ledger.
DROP TRIGGER IF EXISTS `transactions_no_delete`;
CREATE TRIGGER `transactions_no_delete` BEFORE DELETE ON `transactions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'transactions ledger is append-only';

DROP TRIGGER IF EXISTS `transactions_limited_update`;
CREATE TRIGGER `transactions_limited_update` BEFORE UPDATE ON `transactions`
FOR EACH ROW
IF OLD.`status` <> 'PENDING'
   OR NEW.`amount` <> OLD.`amount`
   OR NEW.`reference` <> OLD.`reference`
   OR NEW.`wallet_id` <> OLD.`wallet_id`
   OR NEW.`type` <> OLD.`type` THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'transactions ledger is append-only';
END IF;

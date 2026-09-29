-- Removes the referral/affiliate structures (dropped from scope) and adds
-- verified email change. Checked before writing: no transactions use the
-- removed REFERRAL_EARNING/AFFILIATE_EARNING types and no user has a referrer.

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_referred_by_id_fkey`;

-- DropIndex
DROP INDEX `users_referral_code_key` ON `users`;

-- DropIndex
DROP INDEX `users_referred_by_id_idx` ON `users`;

-- AlterTable
ALTER TABLE `auth_tokens` ADD COLUMN `new_email` VARCHAR(254) NULL,
    MODIFY `purpose` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE') NOT NULL;

-- AlterTable
ALTER TABLE `transactions` MODIFY `type` ENUM('DEPOSIT', 'PURCHASE', 'REFUND', 'ADJUSTMENT') NOT NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `referral_code`,
    DROP COLUMN `referred_by_id`;


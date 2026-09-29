-- DropIndex
DROP INDEX `countries_is_active_display_order_idx` ON `countries`;

-- DropIndex
DROP INDEX `services_is_active_is_popular_display_order_idx` ON `services`;

-- AlterTable
ALTER TABLE `countries` ADD COLUMN `provider_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `provider_requests` ADD COLUMN `attempt` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `error_category` VARCHAR(32) NULL,
    ADD COLUMN `provider_ref` VARCHAR(64) NULL,
    ADD COLUMN `success` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `user_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `services` ADD COLUMN `provider_active` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `countries_is_active_provider_active_display_order_idx` ON `countries`(`is_active`, `provider_active`, `display_order`);

-- CreateIndex
CREATE INDEX `provider_requests_action_success_created_at_idx` ON `provider_requests`(`action`, `success`, `created_at`);

-- CreateIndex
CREATE INDEX `services_is_active_provider_active_is_popular_display_order_idx` ON `services`(`is_active`, `provider_active`, `is_popular`, `display_order`);

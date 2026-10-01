-- CreateTable
CREATE TABLE `ready_made_offers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NOT NULL,
    `country_id` INTEGER NULL,
    `country_key` INTEGER NOT NULL DEFAULT 0,
    `price` DECIMAL(18, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ready_made_offers_country_id_idx`(`country_id`),
    INDEX `ready_made_offers_is_active_idx`(`is_active`),
    UNIQUE INDEX `ready_made_offers_service_id_country_key_key`(`service_id`, `country_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ready_made_offers` ADD CONSTRAINT `ready_made_offers_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ready_made_offers` ADD CONSTRAINT `ready_made_offers_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity guards. "All countries" is stored as country_id NULL; country_key
-- mirrors it (country_id, or 0 for All) so the (service, country) unique index
-- also prevents duplicate "All" offers. The triggers derive it, so it can never
-- disagree with country_id. (MariaDB doesn't allow a CHECK on a column with a
-- cascading foreign key.) Prices are admin-set and must be positive.
CREATE TRIGGER `ready_made_offers_country_key_insert` BEFORE INSERT ON `ready_made_offers`
FOR EACH ROW
SET NEW.`country_key` = COALESCE(NEW.`country_id`, 0);

CREATE TRIGGER `ready_made_offers_country_key_update` BEFORE UPDATE ON `ready_made_offers`
FOR EACH ROW
SET NEW.`country_key` = COALESCE(NEW.`country_id`, 0);

ALTER TABLE `ready_made_offers` ADD CONSTRAINT `ready_made_offers_price_positive` CHECK (`price` > 0);

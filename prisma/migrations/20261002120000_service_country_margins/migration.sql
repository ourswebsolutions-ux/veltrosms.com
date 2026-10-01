-- CreateTable
CREATE TABLE `service_country_margins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NOT NULL,
    `country_id` INTEGER NOT NULL,
    `min_margin` DECIMAL(18, 4) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_country_margins_country_id_idx`(`country_id`),
    UNIQUE INDEX `service_country_margins_service_id_country_id_key`(`service_id`, `country_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_country_margins` ADD CONSTRAINT `service_country_margins_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_country_margins` ADD CONSTRAINT `service_country_margins_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- A margin is a non-negative amount (same bounds as the global minimum margin).
ALTER TABLE `service_country_margins` ADD CONSTRAINT `service_country_margins_min_margin_range` CHECK (`min_margin` >= 0 AND `min_margin` <= 100);

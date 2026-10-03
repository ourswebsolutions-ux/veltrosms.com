-- Blog articles (Admin → Blog). Public when published and published_at has passed.
CREATE TABLE `blog_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `excerpt` VARCHAR(500) NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `featured_image` VARCHAR(500) NULL,
    `category` VARCHAR(60) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `blog_posts_slug_key`(`slug`),
    INDEX `blog_posts_published_published_at_idx`(`published`, `published_at`),
    INDEX `blog_posts_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

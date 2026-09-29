-- Mirrors the schema change `emailVerifiedAt @default(now())`: new accounts
-- are created as verified. Remove the default in schema.prisma (and add a
-- migration) to require email confirmation again.
ALTER TABLE `users` MODIFY `email_verified_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3);

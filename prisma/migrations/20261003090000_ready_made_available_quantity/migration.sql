-- Ready Made Accounts: how many accounts are in hand for manual delivery, per
-- offer (service + country). Existing offers start at 0 (out of stock) so
-- nothing can be oversold until an administrator sets the real quantity.
ALTER TABLE `ready_made_offers` ADD COLUMN `available_quantity` INTEGER NOT NULL DEFAULT 0;

-- A purchase takes one atomically; the database never lets it go negative.
ALTER TABLE `ready_made_offers` ADD CONSTRAINT `ready_made_offers_available_quantity_nonnegative` CHECK (`available_quantity` >= 0);

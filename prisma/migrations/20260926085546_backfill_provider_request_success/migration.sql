-- Rows logged before `success` existed got the column default (false).
-- A row is a success if no error was recorded for it.
UPDATE `provider_requests`
SET `success` = (`error_code` IS NULL)
WHERE `error_category` IS NULL;

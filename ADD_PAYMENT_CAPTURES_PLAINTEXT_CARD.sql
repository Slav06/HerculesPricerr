-- Add plaintext card columns to payment_captures for add-card link flow (only if they don't exist).
-- Extension flow uses encrypted columns; add-card API writes here so dashboard can charge from same table.
-- Skip this file if card_number_plain and security_code_plain already exist on payment_captures.

ALTER TABLE payment_captures
ADD COLUMN IF NOT EXISTS card_number_plain TEXT,
ADD COLUMN IF NOT EXISTS security_code_plain VARCHAR(10);

COMMENT ON COLUMN payment_captures.card_number_plain IS 'Card number from add-card link (plaintext); prefer encrypted when both present';
COMMENT ON COLUMN payment_captures.security_code_plain IS 'CVV from add-card link (plaintext)';

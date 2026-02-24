-- Add fail_reason column to recurring_payment_executions
ALTER TABLE recurring_payment_executions ADD COLUMN fail_reason TEXT;

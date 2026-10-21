ALTER TABLE rewards ADD COLUMN retail_value numeric(12,2)
  CHECK (retail_value > 0 AND retail_value <= 99999999.99);

ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_page_style_ck;
ALTER TABLE vendors ADD CONSTRAINT vendors_page_style_ck CHECK (page_style IN ('spotlight', 'compact', 'branded', 'playful', 'split'));

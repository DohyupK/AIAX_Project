-- 28 LME 알루미늄 시세 (2026-11-20, MS)
-- 일자별 알루미늄(Al) 현물 가격만 저장 (LME 시세 페이지의 여러 금속 중 Al 열). 단위 US$/톤
-- 데이터: 처음 1번은 DH 백필 CSV 를 MS 가 넣고, 이후 매일 05:00 DH 프로그램이 새 일자만 INSERT (app_lake)
-- 09(org) 뒤에 실행. 다시 실행해도 됨
BEGIN;

CREATE TABLE IF NOT EXISTS org.aluminum_price (
    price_date  date           PRIMARY KEY,                       -- 일자
    price       numeric(10,1)  NOT NULL CHECK (price > 0)         -- 가격 (US$/톤, 현물)
);
COMMENT ON TABLE  org.aluminum_price            IS 'LME 알루미늄 현물 시세 (일자별, US$/톤)';
COMMENT ON COLUMN org.aluminum_price.price_date IS '시세 일자';
COMMENT ON COLUMN org.aluminum_price.price      IS '알루미늄(Al) 현물 가격, US$/톤';

GRANT SELECT ON org.aluminum_price TO role_lake, role_spark;
GRANT INSERT ON org.aluminum_price TO app_lake;   -- DH 매일 증분 수집 (DH/api/aluminum_price daily, DATABASE_URL)

COMMIT;

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'org' AND table_name = 'aluminum_price'
ORDER BY ordinal_position;

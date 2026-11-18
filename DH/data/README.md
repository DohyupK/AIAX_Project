# data

조직·권한 SoT는 서버 Postgres `aiax.org` (로컬 SQLite 없음).

| 파일 | 용도 |
|------|------|
| `sql/01_org_permission_schema.pg.sql` | DDL (`MS/db/init/09_…`) |
| `sql/02_org_permission_seed.pg.sql` | 시드 (`MS/db/init/10_…`) |
| `sql/03_casting_image.pg.sql` | `mes.casting_image` / `lake.lake_casting_image` 뼈대 (MS init 반영 요청) |
| `sql/org_permission.dbml` | ERD → https://dbdiagram.io/d |

규칙 로직: [`../api/common/org_permission_logic.py`](../api/common/org_permission_logic.py)  
문서: [`../../DB연동_내역/조직권한_인수인계.md`](../../DB연동_내역/조직권한_인수인계.md)

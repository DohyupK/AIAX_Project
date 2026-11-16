-- org 시드 (로컬 SQLite 덤프). 규칙 계산값 = org_permission_logic 시드 결과.
-- 재적용: org 테이블만 TRUNCATE 후 이 파일 실행.
BEGIN;
SET session_replication_role = replica;

TRUNCATE org.management_report_page, org.worker_safety_page, org.quality_inspection_page, org.process_optimization_page, org.main_page, org.model_management_page, org.employee_record, org.vender_gate_log, org.employee_gate_log, org.gate_card, org.vender_worker, org.employee_status, org.attendance, org.employee_card, org.team_roster, org.dept_roster, org.access_code, org.employee_info, org.employee, org.vender_company, org.page, org.team, org.department, org."position" RESTART IDENTITY CASCADE;
SET session_replication_role = DEFAULT;

-- org."position": 7 rows
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (1, '인턴', 100, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (2, '사원', 200, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (3, '대리', 300, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (4, '과장', 400, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (5, '차장', 500, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (6, '부장', 600, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org."position" (position_idx, position_name, position_code, created_at) VALUES (7, '소장', 700, '2026-11-15 18:42:33'::timestamptz);

-- org.department: 7 rows
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (1, '10', '경영부', 'E10001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (2, '20', '설비부', 'E20001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (3, '30', '생산부', 'E30001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (4, '40', '시스템개발부', 'E40001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (5, '50', '안전부', 'E50001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (6, '60', '품질부', 'E60001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.department (department_idx, dept_code, dept_name, department_representative, created_at) VALUES (7, '70', 'R&D부', 'E70001', '2026-11-15 18:42:33'::timestamptz);

-- org.team: 6 rows
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (1, 'casting1', 'E30007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (2, 'casting2', 'E30013', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (3, 'casting3', 'E30002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (4, 'maintenance', 'E40003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (5, 'cost', 'E10001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team (team_idx, team_code, team_representative, created_at) VALUES (6, 'TF', 'E40002', '2026-11-15 18:42:33'::timestamptz);

-- org.page: 6 rows
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (1, 'model_management', '모델관리', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (2, 'main', '메인', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (3, 'process_optimization', '공정최적화', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (4, 'quality_inspection', '품질검사', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (5, 'worker_safety', '작업자안전', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.page (page_idx, page_code, page_name, created_at) VALUES (6, 'management_report', '경영보고', '2026-11-15 18:42:33'::timestamptz);

-- org.vender_company: 2 rows
INSERT INTO org.vender_company (vender_company_idx, vender_code, vender_name, contract_status, created_at) VALUES (1, 'HB260601', '(주)한빛정밀', 'active', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_company (vender_company_idx, vender_code, vender_name, contract_status, created_at) VALUES (2, 'DS260601', '대성기공', 'active', '2026-11-15 18:42:33'::timestamptz);

-- org.employee: 53 rows
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (1, 'E10001', '10', '부장', 'cost', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (2, 'E10002', '10', '과장', 'TF', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (3, 'E10003', '10', '대리', 'cost', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (4, 'E10004', '10', '사원', 'cost', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (5, 'E10005', '10', '사원', 'cost', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (6, 'E20001', '20', '차장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (7, 'E20002', '20', '과장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (8, 'E20003', '20', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (9, 'E20004', '20', '대리', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (10, 'E20005', '20', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (11, 'E20006', '20', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (12, 'E20007', '20', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (13, 'E20008', '20', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (14, 'E20009', '20', '인턴', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (15, 'E30001', '30', '차장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (16, 'E30002', '30', '과장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (17, 'E30003', '30', '과장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (18, 'E30004', '30', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (19, 'E30005', '30', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (20, 'E30006', '30', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (21, 'E30007', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (22, 'E30008', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (23, 'E30009', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (24, 'E30010', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (25, 'E30011', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (26, 'E30012', '30', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (27, 'E30013', '30', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (28, 'E30014', '30', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (29, 'E30015', '30', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (30, 'E30016', '30', '인턴', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (31, 'E30017', '30', '인턴', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (32, 'E30018', '30', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (33, 'E40001', '40', '과장', 'maintenance', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (34, 'E40002', '40', '대리', 'TF', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (35, 'E40003', '40', '사원', 'maintenance', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (36, 'E40004', '40', '사원', 'maintenance', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (37, 'E40005', '40', '사원', 'maintenance', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (38, 'E50001', '50', '과장', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (39, 'E50002', '50', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (40, 'E50003', '50', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (41, 'E60001', '60', '차장', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (42, 'E60002', '60', '과장', 'TF', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (43, 'E60003', '60', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (44, 'E60004', '60', '대리', 'casting3', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (45, 'E60005', '60', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (46, 'E60006', '60', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (47, 'E60007', '60', '사원', 'casting1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (48, 'E60008', '60', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (49, 'E60009', '60', '사원', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (50, 'E60010', '60', '인턴', 'casting2', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (51, 'E70001', '70', '과장', 'TF', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (52, 'E70002', '70', '대리', 'TF', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee (employee_idx, employee_no, dept_code, position_name, team_code, created_at) VALUES (53, 'E70003', '70', '사원', 'TF', '2026-11-15 18:42:33'::timestamptz);

-- org.employee_info: 53 rows
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (1, 'E10001', '박서준', 26, 'M', '010-1001-2001', '서울시 목업구 목업로 1', 'e10001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (2, 'E10002', '김지환', 27, 'F', '010-1002-2002', '서울시 목업구 목업로 2', 'e10002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (3, 'E10003', '이하늘', 28, 'M', '010-1003-2003', '서울시 목업구 목업로 3', 'e10003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (4, 'E10004', '최유진', 29, 'F', '010-1004-2004', '서울시 목업구 목업로 4', 'e10004@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (5, 'E10005', '정민호', 30, 'M', '010-1005-2005', '서울시 목업구 목업로 5', 'e10005@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (6, 'E20001', '강지아', 31, 'F', '010-1006-2006', '서울시 목업구 목업로 6', 'e20001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (7, 'E20002', '윤도현', 32, 'M', '010-1007-2007', '서울시 목업구 목업로 7', 'e20002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (8, 'E20003', '한소희', 33, 'F', '010-1008-2008', '서울시 목업구 목업로 8', 'e20003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (9, 'E20004', '오준석', 34, 'M', '010-1009-2009', '서울시 목업구 목업로 9', 'e20004@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (10, 'E20005', '신예린', 35, 'F', '010-1010-2010', '서울시 목업구 목업로 10', 'e20005@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (11, 'E20006', '장우진', 36, 'M', '010-1011-2011', '서울시 목업구 목업로 11', 'e20006@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (12, 'E20007', '배현우', 37, 'F', '010-1012-2012', '서울시 목업구 목업로 12', 'e20007@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (13, 'E20008', '권나연', 38, 'M', '010-1013-2013', '서울시 목업구 목업로 13', 'e20008@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (14, 'E20009', '홍석진', 39, 'F', '010-1014-2014', '서울시 목업구 목업로 14', 'e20009@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (15, 'E30001', '문채원', 40, 'M', '010-1015-2015', '서울시 목업구 목업로 15', 'e30001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (16, 'E30002', '임광철', 41, 'F', '010-1016-2016', '서울시 목업구 목업로 16', 'e30002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (17, 'E30003', '조민수', 42, 'M', '010-1017-2017', '서울시 목업구 목업로 17', 'e30003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (18, 'E30004', '서지수', 43, 'F', '010-1018-2018', '서울시 목업구 목업로 18', 'e30004@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (19, 'E30005', '남기태', 44, 'M', '010-1019-2019', '서울시 목업구 목업로 19', 'e30005@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (20, 'E30006', '유하린', 25, 'F', '010-1020-2020', '서울시 목업구 목업로 20', 'e30006@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (21, 'E30007', '송재혁', 26, 'M', '010-1021-2021', '서울시 목업구 목업로 21', 'e30007@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (22, 'E30008', '노은별', 27, 'F', '010-1022-2022', '서울시 목업구 목업로 22', 'e30008@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (23, 'E30009', '하준영', 28, 'M', '010-1023-2023', '서울시 목업구 목업로 23', 'e30009@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (24, 'E30010', '곽도윤', 29, 'F', '010-1024-2024', '서울시 목업구 목업로 24', 'e30010@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (25, 'E30011', '전미래', 30, 'M', '010-1025-2025', '서울시 목업구 목업로 25', 'e30011@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (26, 'E30012', '안성호', 31, 'F', '010-1026-2026', '서울시 목업구 목업로 26', 'e30012@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (27, 'E30013', '황지원', 32, 'M', '010-1027-2027', '서울시 목업구 목업로 27', 'e30013@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (28, 'E30014', '고유나', 33, 'F', '010-1028-2028', '서울시 목업구 목업로 28', 'e30014@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (29, 'E30015', '임채린', 34, 'M', '010-1029-2029', '서울시 목업구 목업로 29', 'e30015@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (30, 'E30016', '배수현', 35, 'F', '010-1030-2030', '서울시 목업구 목업로 30', 'e30016@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (31, 'E30017', '차은호', 36, 'M', '010-1031-2031', '서울시 목업구 목업로 31', 'e30017@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (32, 'E30018', '표세린', 37, 'F', '010-1032-2032', '서울시 목업구 목업로 32', 'e30018@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (33, 'E40001', '구본혁', 38, 'M', '010-1033-2033', '서울시 목업구 목업로 33', 'e40001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (34, 'E40002', '김도협', 39, 'F', '010-1034-2034', '서울시 목업구 목업로 34', 'e40002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (35, 'E40003', '임민섭', 40, 'M', '010-1035-2035', '서울시 목업구 목업로 35', 'e40003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (36, 'E40004', '설아인', 41, 'F', '010-1036-2036', '서울시 목업구 목업로 36', 'e40004@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (37, 'E40005', '탁민재', 42, 'M', '010-1037-2037', '서울시 목업구 목업로 37', 'e40005@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (38, 'E50001', '피서영', 43, 'F', '010-1038-2038', '서울시 목업구 목업로 38', 'e50001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (39, 'E50002', '김혜진', 44, 'M', '010-1039-2039', '서울시 목업구 목업로 39', 'e50002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (40, 'E50003', '라현석', 25, 'F', '010-1040-2040', '서울시 목업구 목업로 40', 'e50003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (41, 'E60001', '마도희', 26, 'M', '010-1041-2041', '서울시 목업구 목업로 41', 'e60001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (42, 'E60002', '임태민', 27, 'F', '010-1042-2042', '서울시 목업구 목업로 42', 'e60002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (43, 'E60003', '사공민', 28, 'M', '010-1043-2043', '서울시 목업구 목업로 43', 'e60003@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (44, 'E60004', '견우진', 29, 'F', '010-1044-2044', '서울시 목업구 목업로 44', 'e60004@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (45, 'E60005', '도하린', 30, 'M', '010-1045-2045', '서울시 목업구 목업로 45', 'e60005@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (46, 'E60006', '류세진', 31, 'F', '010-1046-2046', '서울시 목업구 목업로 46', 'e60006@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (47, 'E60007', '문서율', 32, 'M', '010-1047-2047', '서울시 목업구 목업로 47', 'e60007@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (48, 'E60008', '방준호', 33, 'F', '010-1048-2048', '서울시 목업구 목업로 48', 'e60008@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (49, 'E60009', '성미래', 34, 'M', '010-1049-2049', '서울시 목업구 목업로 49', 'e60009@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (50, 'E60010', '양지호', 35, 'F', '010-1050-2050', '서울시 목업구 목업로 50', 'e60010@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (51, 'E70001', '옥하늘', 36, 'M', '010-1051-2051', '서울시 목업구 목업로 51', 'e70001@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (52, 'E70002', '음도윤', 37, 'F', '010-1052-2052', '서울시 목업구 목업로 52', 'e70002@aiax.local', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_info (employee_info_idx, employee_no, employee_name, age, gender, phone, address, email, created_at) VALUES (53, 'E70003', '진서아', 38, 'M', '010-1053-2053', '서울시 목업구 목업로 53', 'e70003@aiax.local', '2026-11-15 18:42:33'::timestamptz);

-- org.access_code: 53 rows
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (1, 'E10001', 107, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (2, 'E10002', 104, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (3, 'E10003', 103, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (4, 'E10004', 102, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (5, 'E10005', 102, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (6, 'E20001', 205, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (7, 'E20002', 204, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (8, 'E20003', 203, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (9, 'E20004', 203, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (10, 'E20005', 202, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (11, 'E20006', 202, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (12, 'E20007', 202, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (13, 'E20008', 202, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (14, 'E20009', 201, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (15, 'E30001', 305, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (16, 'E30002', 305, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (17, 'E30003', 304, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (18, 'E30004', 303, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (19, 'E30005', 303, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (20, 'E30006', 303, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (21, 'E30007', 303, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (22, 'E30008', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (23, 'E30009', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (24, 'E30010', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (25, 'E30011', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (26, 'E30012', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (27, 'E30013', 303, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (28, 'E30014', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (29, 'E30015', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (30, 'E30016', 301, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (31, 'E30017', 301, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (32, 'E30018', 302, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (33, 'E40001', 404, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (34, 'E40002', 404, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (35, 'E40003', 403, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (36, 'E40004', 402, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (37, 'E40005', 402, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (38, 'E50001', 504, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (39, 'E50002', 503, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (40, 'E50003', 502, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (41, 'E60001', 605, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (42, 'E60002', 604, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (43, 'E60003', 603, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (44, 'E60004', 603, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (45, 'E60005', 602, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (46, 'E60006', 602, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (47, 'E60007', 602, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (48, 'E60008', 602, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (49, 'E60009', 602, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (50, 'E60010', 601, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (51, 'E70001', 704, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (52, 'E70002', 703, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.access_code (access_code_idx, employee_no, access_code, created_at) VALUES (53, 'E70003', 702, '2026-11-15 18:42:33'::timestamptz);

-- org.dept_roster: 53 rows
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (1, '10', 'E10001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (2, '10', 'E10002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (3, '10', 'E10003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (4, '10', 'E10004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (5, '10', 'E10005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (6, '20', 'E20001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (7, '20', 'E20002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (8, '20', 'E20003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (9, '20', 'E20004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (10, '20', 'E20005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (11, '20', 'E20006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (12, '20', 'E20007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (13, '20', 'E20008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (14, '20', 'E20009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (15, '30', 'E30001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (16, '30', 'E30002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (17, '30', 'E30003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (18, '30', 'E30004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (19, '30', 'E30005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (20, '30', 'E30006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (21, '30', 'E30007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (22, '30', 'E30008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (23, '30', 'E30009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (24, '30', 'E30010', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (25, '30', 'E30011', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (26, '30', 'E30012', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (27, '30', 'E30013', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (28, '30', 'E30014', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (29, '30', 'E30015', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (30, '30', 'E30016', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (31, '30', 'E30017', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (32, '30', 'E30018', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (33, '40', 'E40001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (34, '40', 'E40002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (35, '40', 'E40003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (36, '40', 'E40004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (37, '40', 'E40005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (38, '50', 'E50001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (39, '50', 'E50002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (40, '50', 'E50003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (41, '60', 'E60001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (42, '60', 'E60002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (43, '60', 'E60003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (44, '60', 'E60004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (45, '60', 'E60005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (46, '60', 'E60006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (47, '60', 'E60007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (48, '60', 'E60008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (49, '60', 'E60009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (50, '60', 'E60010', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (51, '70', 'E70001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (52, '70', 'E70002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.dept_roster (dept_roster_idx, dept_code, employee_no, created_at) VALUES (53, '70', 'E70003', '2026-11-15 18:42:33'::timestamptz);

-- org.team_roster: 53 rows
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (1, 'casting3', 'E30002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (2, 'casting3', 'E30001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (3, 'casting3', 'E30003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (4, 'casting3', 'E30004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (5, 'casting3', 'E30005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (6, 'casting3', 'E30006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (7, 'casting3', 'E60001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (8, 'casting3', 'E60003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (9, 'casting3', 'E60004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (10, 'casting3', 'E20001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (11, 'casting3', 'E20002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (12, 'casting3', 'E20003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (13, 'casting3', 'E50002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (14, 'maintenance', 'E40003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (15, 'maintenance', 'E40001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (16, 'maintenance', 'E40004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (17, 'maintenance', 'E40005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (18, 'TF', 'E40002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (19, 'TF', 'E10002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (20, 'TF', 'E60002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (21, 'TF', 'E70001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (22, 'TF', 'E70002', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (23, 'TF', 'E70003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (24, 'casting1', 'E30007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (25, 'casting1', 'E30008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (26, 'casting1', 'E30009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (27, 'casting1', 'E30010', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (28, 'casting1', 'E30011', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (29, 'casting1', 'E30012', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (30, 'casting1', 'E60005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (31, 'casting1', 'E60006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (32, 'casting1', 'E60007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (33, 'casting1', 'E20004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (34, 'casting1', 'E20005', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (35, 'casting1', 'E20006', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (36, 'casting1', 'E50001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (37, 'casting2', 'E30013', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (38, 'casting2', 'E30014', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (39, 'casting2', 'E30015', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (40, 'casting2', 'E30016', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (41, 'casting2', 'E30017', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (42, 'casting2', 'E30018', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (43, 'casting2', 'E60008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (44, 'casting2', 'E60009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (45, 'casting2', 'E60010', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (46, 'casting2', 'E20007', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (47, 'casting2', 'E20008', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (48, 'casting2', 'E20009', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (49, 'casting2', 'E50003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (50, 'cost', 'E10001', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (51, 'cost', 'E10003', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (52, 'cost', 'E10004', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.team_roster (team_roster_idx, team_code, employee_no, created_at) VALUES (53, 'cost', 'E10005', '2026-11-15 18:42:33'::timestamptz);

-- org.employee_card: 5 rows
INSERT INTO org.employee_card (employee_card_idx, card_id, employee_no, attendance_status, created_at) VALUES (1, 'EMPE10001', 'E10001', 'present', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_card (employee_card_idx, card_id, employee_no, attendance_status, created_at) VALUES (2, 'EMPE10002', 'E10002', 'absent', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_card (employee_card_idx, card_id, employee_no, attendance_status, created_at) VALUES (3, 'EMPE30001', 'E30001', 'present', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_card (employee_card_idx, card_id, employee_no, attendance_status, created_at) VALUES (4, 'EMPE40001', 'E40001', 'absent', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_card (employee_card_idx, card_id, employee_no, attendance_status, created_at) VALUES (5, 'EMPE60001', 'E60001', 'present', '2026-11-15 18:42:33'::timestamptz);

-- org.attendance: 5 rows
INSERT INTO org.attendance (attendance_idx, employee_no, work_date, created_at) VALUES (1, 'E10001', '2026-06-01'::date, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.attendance (attendance_idx, employee_no, work_date, created_at) VALUES (2, 'E10002', '2026-06-02'::date, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.attendance (attendance_idx, employee_no, work_date, created_at) VALUES (3, 'E30001', '2026-06-03'::date, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.attendance (attendance_idx, employee_no, work_date, created_at) VALUES (4, 'E40001', '2026-06-04'::date, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.attendance (attendance_idx, employee_no, work_date, created_at) VALUES (5, 'E60001', '2026-06-05'::date, '2026-11-15 18:42:33'::timestamptz);

-- org.employee_status: 5 rows
INSERT INTO org.employee_status (employee_status_idx, employee_no, monthly_overtime_hour, last_logout_at, annual_leave_used, years_of_service, created_at) VALUES (1, 'E10001', NULL, '2026-06-01 18:00:00'::timestamptz, 0, 0, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_status (employee_status_idx, employee_no, monthly_overtime_hour, last_logout_at, annual_leave_used, years_of_service, created_at) VALUES (2, 'E10002', NULL, '2026-06-02 18:00:00'::timestamptz, 0, 0, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_status (employee_status_idx, employee_no, monthly_overtime_hour, last_logout_at, annual_leave_used, years_of_service, created_at) VALUES (3, 'E30001', 0.5, '2026-06-03 19:30:00'::timestamptz, 0, 0, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_status (employee_status_idx, employee_no, monthly_overtime_hour, last_logout_at, annual_leave_used, years_of_service, created_at) VALUES (4, 'E40001', NULL, '2026-06-04 17:00:00'::timestamptz, 0, 0, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_status (employee_status_idx, employee_no, monthly_overtime_hour, last_logout_at, annual_leave_used, years_of_service, created_at) VALUES (5, 'E60001', NULL, NULL, 1, 0, '2026-11-15 18:42:33'::timestamptz);

-- org.vender_worker: 5 rows
INSERT INTO org.vender_worker (vender_worker_idx, vender_code, card_id, card_issued_at, card_returned_at, gate, created_at) VALUES (1, 'HB260601', 'hb260601a', '2026-06-01'::timestamptz, NULL, 'a', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_worker (vender_worker_idx, vender_code, card_id, card_issued_at, card_returned_at, gate, created_at) VALUES (2, 'HB260601', 'hb260601b', '2026-06-01'::timestamptz, NULL, 'b', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_worker (vender_worker_idx, vender_code, card_id, card_issued_at, card_returned_at, gate, created_at) VALUES (3, 'DS260601', 'ds260601a', '2026-06-01'::timestamptz, NULL, 'a', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_worker (vender_worker_idx, vender_code, card_id, card_issued_at, card_returned_at, gate, created_at) VALUES (4, 'DS260601', 'ds260601b', '2026-06-01'::timestamptz, '2026-06-10'::timestamptz, 'b', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_worker (vender_worker_idx, vender_code, card_id, card_issued_at, card_returned_at, gate, created_at) VALUES (5, 'HB260601', 'hb260615a', '2026-06-15'::timestamptz, NULL, 'a', '2026-11-15 18:42:33'::timestamptz);

-- org.gate_card: 5 rows
INSERT INTO org.gate_card (gate_card_idx, employee_card_id, vender_card_id, gate_a, gate_b, created_at) VALUES (1, 'EMPE10001', NULL, 'O', 'O', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.gate_card (gate_card_idx, employee_card_id, vender_card_id, gate_a, gate_b, created_at) VALUES (2, 'EMPE30001', NULL, 'O', 'O', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.gate_card (gate_card_idx, employee_card_id, vender_card_id, gate_a, gate_b, created_at) VALUES (3, NULL, 'hb260601a', 'O', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.gate_card (gate_card_idx, employee_card_id, vender_card_id, gate_a, gate_b, created_at) VALUES (4, NULL, 'ds260601b', NULL, 'O', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.gate_card (gate_card_idx, employee_card_id, vender_card_id, gate_a, gate_b, created_at) VALUES (5, NULL, 'hb260615a', 'O', NULL, '2026-11-15 18:42:33'::timestamptz);

-- org.employee_gate_log: 5 rows
INSERT INTO org.employee_gate_log (employee_gate_log_idx, employee_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (1, 'EMPE10001', '2026-06-01'::date, '2026-06-01 09:00:00'::timestamptz, '2026-06-01 18:00:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_gate_log (employee_gate_log_idx, employee_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (2, 'EMPE10002', '2026-06-02'::date, '2026-06-02 09:20:00'::timestamptz, '2026-06-02 18:00:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_gate_log (employee_gate_log_idx, employee_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (3, 'EMPE30001', '2026-06-03'::date, '2026-06-03 09:00:00'::timestamptz, '2026-06-03 19:30:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_gate_log (employee_gate_log_idx, employee_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (4, 'EMPE40001', '2026-06-04'::date, '2026-06-04 09:00:00'::timestamptz, '2026-06-04 17:00:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_gate_log (employee_gate_log_idx, employee_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (5, 'EMPE60001', '2026-06-05'::date, NULL, NULL, 'IN', '2026-11-15 18:42:33'::timestamptz);

-- org.vender_gate_log: 5 rows
INSERT INTO org.vender_gate_log (vender_gate_log_idx, vender_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (1, 'hb260601a', '2026-06-01'::date, '2026-06-01 08:30:00'::timestamptz, '2026-06-01 17:30:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_gate_log (vender_gate_log_idx, vender_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (2, 'hb260601a', '2026-06-02'::date, '2026-06-02 08:30:00'::timestamptz, '2026-06-02 17:30:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_gate_log (vender_gate_log_idx, vender_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (3, 'ds260601b', '2026-06-03'::date, '2026-06-03 09:00:00'::timestamptz, NULL, 'IN', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_gate_log (vender_gate_log_idx, vender_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (4, 'ds260601b', '2026-06-04'::date, '2026-06-04 08:00:00'::timestamptz, '2026-06-04 16:00:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.vender_gate_log (vender_gate_log_idx, vender_card_id, work_date, clock_in_at, clock_out_at, commute_type, created_at) VALUES (5, 'hb260615a', '2026-06-15'::date, '2026-06-15 08:30:00'::timestamptz, '2026-06-15 18:00:00'::timestamptz, 'OUT', '2026-11-15 18:42:33'::timestamptz);

-- org.employee_record: 5 rows
INSERT INTO org.employee_record (employee_record_idx, employee_card_id, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit, created_at) VALUES (1, 'EMPE10001', '2026-06-01'::date, 9.0, NULL, NULL, NULL, NULL, NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_record (employee_record_idx, employee_card_id, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit, created_at) VALUES (2, 'EMPE10002', '2026-06-02'::date, 8.67, NULL, '1', NULL, NULL, NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_record (employee_record_idx, employee_card_id, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit, created_at) VALUES (3, 'EMPE30001', '2026-06-03'::date, 10.5, 1.5, NULL, NULL, NULL, NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_record (employee_record_idx, employee_card_id, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit, created_at) VALUES (4, 'EMPE40001', '2026-06-04'::date, 8.0, NULL, NULL, '1', NULL, '1', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.employee_record (employee_record_idx, employee_card_id, work_date, actual_hour, overtime_hour, late, early_leave, absent, work_deficit, created_at) VALUES (5, 'EMPE60001', '2026-06-05'::date, NULL, NULL, NULL, NULL, '1', NULL, '2026-11-15 18:42:33'::timestamptz);

-- org.model_management_page: 5 rows
INSERT INTO org.model_management_page (model_management_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'model_management', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.model_management_page (model_management_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'model_management', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.model_management_page (model_management_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'model_management', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.model_management_page (model_management_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'model_management', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.model_management_page (model_management_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'model_management', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

-- org.main_page: 5 rows
INSERT INTO org.main_page (main_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'main', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.main_page (main_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'main', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.main_page (main_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'main', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.main_page (main_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'main', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.main_page (main_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'main', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

-- org.process_optimization_page: 5 rows
INSERT INTO org.process_optimization_page (process_optimization_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'process_optimization', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.process_optimization_page (process_optimization_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'process_optimization', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.process_optimization_page (process_optimization_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'process_optimization', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.process_optimization_page (process_optimization_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'process_optimization', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.process_optimization_page (process_optimization_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'process_optimization', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

-- org.quality_inspection_page: 5 rows
INSERT INTO org.quality_inspection_page (quality_inspection_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'quality_inspection', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.quality_inspection_page (quality_inspection_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'quality_inspection', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.quality_inspection_page (quality_inspection_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'quality_inspection', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.quality_inspection_page (quality_inspection_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'quality_inspection', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.quality_inspection_page (quality_inspection_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'quality_inspection', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

-- org.worker_safety_page: 5 rows
INSERT INTO org.worker_safety_page (worker_safety_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'worker_safety', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.worker_safety_page (worker_safety_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'worker_safety', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.worker_safety_page (worker_safety_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'worker_safety', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.worker_safety_page (worker_safety_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'worker_safety', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.worker_safety_page (worker_safety_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'worker_safety', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

-- org.management_report_page: 5 rows
INSERT INTO org.management_report_page (management_report_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (1, 'management_report', '30', '대리', 'view', 'read', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.management_report_page (management_report_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (2, 'management_report', '60', '과장', 'edit_form', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.management_report_page (management_report_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (3, 'management_report', '10', '부장', 'admin', 'edit', '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.management_report_page (management_report_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (4, 'management_report', '20', '사원', 'view', NULL, '2026-11-15 18:42:33'::timestamptz);
INSERT INTO org.management_report_page (management_report_page_idx, page_code, dept_code, position_name, page_feature, access_level, created_at) VALUES (5, 'management_report', '30', '소장', 'view', 'edit', '2026-11-15 18:42:33'::timestamptz);

COMMIT;

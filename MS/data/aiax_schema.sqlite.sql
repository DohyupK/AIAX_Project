-- AIAX 서버 Postgres(aiax) 테이블 구조 → SQLite (MS/db/apps/src/apps/sqlite_export.py 로 생성)
-- 생성: 2026-11-22 18:37 · 스키마 mes, lake, mart, org, ai · 테이블 84개
-- 이름: 스키마.테이블 → 스키마_테이블. 트리거·함수·권한·CHECK 는 옮기지 않음 (원본: MS/db/init)
PRAGMA foreign_keys = OFF;

CREATE TABLE "ai_defect_discard" (  -- ai.defect_discard
    "defect_discard_idx" INTEGER NOT NULL,  -- integer
    "casting_id" TEXT NOT NULL,  -- text
    "discarded_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("casting_id"),
    UNIQUE ("defect_discard_idx"),
    FOREIGN KEY ("casting_id") REFERENCES "mes_investment_casting" ("casting_id")
);

CREATE TABLE "ai_defect_label" (  -- ai.defect_label
    "defect_label_idx" INTEGER NOT NULL,  -- integer
    "casting_id" TEXT NOT NULL,  -- text
    "blowhole" INTEGER NOT NULL,  -- boolean
    "edge_burr" INTEGER NOT NULL,  -- boolean
    "surface_rough" INTEGER NOT NULL,  -- boolean
    "labeled_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("casting_id"),
    UNIQUE ("defect_label_idx"),
    FOREIGN KEY ("casting_id") REFERENCES "mes_investment_casting" ("casting_id")
);

CREATE TABLE "ai_llm_feedback" (  -- ai.llm_feedback
    "llm_feedback_idx" INTEGER NOT NULL,  -- integer
    "target_type" TEXT NOT NULL,  -- text
    "target_ref" TEXT,  -- text
    "provider" TEXT NOT NULL,  -- text
    "model" TEXT NOT NULL,  -- text
    "prompt" TEXT,  -- text
    "response" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("llm_feedback_idx")
);

CREATE TABLE "ai_model_metric_cast_qc1" (  -- ai.model_metric_cast_qc1
    "model_name" TEXT NOT NULL,  -- text
    "version" TEXT NOT NULL,  -- text
    "pr_auc_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "recall_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "precision_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "f1_score" NUMERIC NOT NULL,  -- numeric(5,4)
    PRIMARY KEY ("model_name", "version"),
    FOREIGN KEY ("model_name", "version") REFERENCES "ai_model_registry" ("model_name", "version") ON DELETE CASCADE
);

CREATE TABLE "ai_model_metric_cast_qc2" (  -- ai.model_metric_cast_qc2
    "model_name" TEXT NOT NULL,  -- text
    "version" TEXT NOT NULL,  -- text
    "accuracy_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "recall_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "precision_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "f1_score" NUMERIC NOT NULL,  -- numeric(5,4)
    PRIMARY KEY ("model_name", "version"),
    FOREIGN KEY ("model_name", "version") REFERENCES "ai_model_registry" ("model_name", "version") ON DELETE CASCADE
);

CREATE TABLE "ai_model_metric_safe_ppe" (  -- ai.model_metric_safe_ppe
    "model_name" TEXT NOT NULL,  -- text
    "version" TEXT NOT NULL,  -- text
    "map50_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "recall_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "precision_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "f1_score" NUMERIC NOT NULL,  -- numeric(5,4)
    PRIMARY KEY ("model_name", "version"),
    FOREIGN KEY ("model_name", "version") REFERENCES "ai_model_registry" ("model_name", "version") ON DELETE CASCADE
);

CREATE TABLE "ai_model_registry" (  -- ai.model_registry
    "model_registry_idx" INTEGER NOT NULL,  -- integer
    "model_name" TEXT NOT NULL,  -- text
    "version" TEXT NOT NULL,  -- text
    "process_code" TEXT NOT NULL,  -- text
    "description" TEXT,  -- text
    "file_name" TEXT,  -- text
    "file_path" TEXT,  -- text
    "deployed" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("model_name", "version"),
    UNIQUE ("model_registry_idx")
);

CREATE TABLE "ai_model_robustness" (  -- ai.model_robustness
    "model_name" TEXT NOT NULL,  -- text
    "version" TEXT NOT NULL,  -- text
    "condition_name" TEXT NOT NULL,  -- text
    "accuracy_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "recall_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "precision_score" NUMERIC NOT NULL,  -- numeric(5,4)
    "f1_score" NUMERIC NOT NULL,  -- numeric(5,4)
    PRIMARY KEY ("model_name", "version", "condition_name"),
    FOREIGN KEY ("model_name", "version") REFERENCES "ai_model_registry" ("model_name", "version") ON DELETE CASCADE
);

CREATE TABLE "ai_ppe_check" (  -- ai.ppe_check
    "ppe_check_idx" INTEGER NOT NULL,  -- integer
    "employee_gate_log_idx" INTEGER,  -- integer
    "vendor_gate_log_idx" INTEGER,  -- integer
    "helmet" INTEGER,  -- boolean
    "shoes" INTEGER,  -- boolean
    "vest" INTEGER,  -- boolean
    "gloves" INTEGER,  -- boolean
    "goggles" INTEGER,  -- boolean
    "result" TEXT NOT NULL,  -- text
    "manual_result" TEXT,  -- text
    "manual_by" TEXT,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "manual_at" TEXT,  -- timestamp with time zone
    PRIMARY KEY ("ppe_check_idx"),
    UNIQUE ("employee_gate_log_idx"),
    UNIQUE ("vendor_gate_log_idx"),
    FOREIGN KEY ("employee_gate_log_idx") REFERENCES "org_employee_gate_log" ("employee_gate_log_idx"),
    FOREIGN KEY ("manual_by") REFERENCES "org_employee" ("employee_no"),
    FOREIGN KEY ("vendor_gate_log_idx") REFERENCES "org_vendor_gate_log" ("vendor_gate_log_idx")
);

CREATE TABLE "ai_ppe_check_image" (  -- ai.ppe_check_image
    "ppe_check_idx" INTEGER NOT NULL,  -- integer
    "image_path" TEXT NOT NULL,  -- text
    "detected_count" INTEGER NOT NULL,  -- smallint
    "score" NUMERIC NOT NULL,  -- numeric(6,4)
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("ppe_check_idx"),
    FOREIGN KEY ("ppe_check_idx") REFERENCES "ai_ppe_check" ("ppe_check_idx") ON DELETE CASCADE
);

CREATE TABLE "ai_ppe_gate_rule" (  -- ai.ppe_gate_rule
    "ppe_gate_rule_idx" INTEGER NOT NULL,  -- integer
    "gate" TEXT NOT NULL,  -- text
    "helmet" INTEGER NOT NULL,  -- boolean
    "shoes" INTEGER NOT NULL,  -- boolean
    "vest" INTEGER NOT NULL,  -- boolean
    "gloves" INTEGER NOT NULL,  -- boolean
    "goggles" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("gate"),
    UNIQUE ("ppe_gate_rule_idx")
);

CREATE TABLE "ai_quality_image_pool" (  -- ai.quality_image_pool
    "pool_idx" INTEGER NOT NULL,  -- integer
    "label" TEXT NOT NULL,  -- text
    "image_base64" TEXT NOT NULL,  -- text
    "content_type" TEXT NOT NULL,  -- text
    "matched_casting_id" TEXT,  -- text
    "matched_at" TEXT,  -- timestamp with time zone
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("pool_idx"),
    FOREIGN KEY ("matched_casting_id") REFERENCES "mes_investment_casting" ("casting_id")
);

CREATE TABLE "ai_quality_prediction" (  -- ai.quality_prediction
    "casting_id" TEXT NOT NULL,  -- text
    "model_name" TEXT,  -- text
    "version" TEXT,  -- text
    "result" TEXT,  -- text
    "confidence_score" NUMERIC,  -- numeric(5,4)
    "predicted_at" TEXT,  -- timestamp with time zone
    "qc1_model_name" TEXT,  -- text
    "qc1_version" TEXT,  -- text
    "qc1_result" TEXT,  -- text
    "qc1_score" NUMERIC,  -- numeric(5,4)
    "qc1_predicted_at" TEXT,  -- timestamp with time zone
    PRIMARY KEY ("casting_id"),
    FOREIGN KEY ("casting_id") REFERENCES "mes_investment_casting" ("casting_id"),
    FOREIGN KEY ("model_name", "version") REFERENCES "ai_model_registry" ("model_name", "version"),
    FOREIGN KEY ("qc1_model_name", "qc1_version") REFERENCES "ai_model_registry" ("model_name", "version")
);

CREATE TABLE "lake_etl_watermark" (  -- lake.etl_watermark
    "job_name" TEXT NOT NULL,  -- text
    "last_change_id" INTEGER NOT NULL,  -- bigint
    "last_run_at" TEXT,  -- timestamp with time zone
    PRIMARY KEY ("job_name")
);

CREATE TABLE "lake_lake_access_code" (  -- lake.lake_access_code
    "access_code_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code_idx")
);

CREATE TABLE "lake_lake_attendance" (  -- lake.lake_attendance
    "attendance_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("attendance_idx")
);

CREATE TABLE "lake_lake_casting_image" (  -- lake.lake_casting_image
    "casting_id" TEXT NOT NULL,  -- text
    "original_uri" TEXT,  -- text
    "content_type" TEXT NOT NULL,  -- text
    "image_base64" TEXT NOT NULL,  -- text
    "updated_at" TEXT NOT NULL,  -- timestamp with time zone
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "lake_synced_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("casting_id")
);

CREATE TABLE "lake_lake_company_documents_page" (  -- lake.lake_company_documents_page
    "company_documents_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("company_documents_page_idx")
);

CREATE TABLE "lake_lake_defect_labeling_page" (  -- lake.lake_defect_labeling_page
    "defect_labeling_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("defect_labeling_page_idx")
);

CREATE TABLE "lake_lake_department" (  -- lake.lake_department
    "department_idx" INTEGER NOT NULL,  -- integer
    "dept_name" TEXT NOT NULL,  -- text
    "dept_code" INTEGER NOT NULL,  -- integer
    "department_representative" TEXT,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("department_idx")
);

CREATE TABLE "lake_lake_dept_roster" (  -- lake.lake_dept_roster
    "dept_roster_idx" INTEGER NOT NULL,  -- integer
    "dept_code" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("dept_roster_idx")
);

CREATE TABLE "lake_lake_employee" (  -- lake.lake_employee
    "employee_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "dept_code" INTEGER NOT NULL,  -- integer
    "position_name" TEXT NOT NULL,  -- text
    "team_code" INTEGER,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "employment_status" TEXT NOT NULL,  -- text
    "resigned_at" TEXT,  -- date
    PRIMARY KEY ("employee_idx")
);

CREATE TABLE "lake_lake_employee_card" (  -- lake.lake_employee_card
    "employee_card_idx" INTEGER NOT NULL,  -- integer
    "card_id" TEXT NOT NULL,  -- text
    "employee_no" TEXT NOT NULL,  -- text
    "attendance_status" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_card_idx")
);

CREATE TABLE "lake_lake_employee_gate_log" (  -- lake.lake_employee_gate_log
    "employee_gate_log_idx" INTEGER NOT NULL,  -- integer
    "employee_card_id" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "gate" TEXT NOT NULL,  -- text
    "clock_in_at" TEXT,  -- timestamp with time zone
    "clock_out_at" TEXT,  -- timestamp with time zone
    "in_out" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_gate_log_idx")
);

CREATE TABLE "lake_lake_employee_record" (  -- lake.lake_employee_record
    "employee_record_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "actual_hour" REAL,  -- double precision
    "overtime_hour" REAL,  -- double precision
    "late" INTEGER NOT NULL,  -- boolean
    "early_leave" INTEGER NOT NULL,  -- boolean
    "absent" INTEGER NOT NULL,  -- boolean
    "work_deficit" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_record_idx")
);

CREATE TABLE "lake_lake_employee_status" (  -- lake.lake_employee_status
    "employee_status_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "monthly_overtime_hour" REAL,  -- double precision
    "last_logout_at" TEXT,  -- timestamp with time zone
    "annual_leave_used" INTEGER,  -- integer
    "years_of_service" INTEGER,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_status_idx")
);

CREATE TABLE "lake_lake_gate_card" (  -- lake.lake_gate_card
    "gate_card_idx" INTEGER NOT NULL,  -- integer
    "employee_card_id" TEXT,  -- text
    "vendor_card_id" TEXT,  -- text
    "gate_a" INTEGER NOT NULL,  -- boolean
    "gate_b" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("gate_card_idx")
);

CREATE TABLE "lake_lake_hr_management_page" (  -- lake.lake_hr_management_page
    "hr_management_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("hr_management_page_idx")
);

CREATE TABLE "lake_lake_investment_casting" (  -- lake.lake_investment_casting
    "casting_id" TEXT NOT NULL,  -- text
    "timestamp" TEXT,  -- date
    "date" TEXT,  -- time without time zone
    "mold_temperature" REAL,  -- double precision
    "facility_cycletime" REAL,  -- double precision
    "production_cycletime" REAL,  -- double precision
    "mechanical_strength" REAL,  -- double precision
    "molten_capacity" REAL,  -- double precision
    "injection_pressure" REAL,  -- double precision
    "sleeve_temperature" REAL,  -- double precision
    "top_temp1" REAL,  -- double precision
    "top_temp2" REAL,  -- double precision
    "top_temp3" REAL,  -- double precision
    "top_temp4" REAL,  -- double precision
    "bottom_temp1" REAL,  -- double precision
    "bottom_temp2" REAL,  -- double precision
    "bottom_temp3" REAL,  -- double precision
    "bottom_temp4" REAL,  -- double precision
    "biscuit_thickness" REAL,  -- double precision
    "cooling_water_temp" REAL,  -- double precision
    "passorfail" INTEGER,  -- smallint
    "line_unit" TEXT,  -- text
    PRIMARY KEY ("casting_id"),
    FOREIGN KEY ("casting_id") REFERENCES "mes_investment_casting" ("casting_id")
);

CREATE TABLE "lake_lake_main_page" (  -- lake.lake_main_page
    "main_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("main_page_idx")
);

CREATE TABLE "lake_lake_management_report_page" (  -- lake.lake_management_report_page
    "management_report_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("management_report_page_idx")
);

CREATE TABLE "lake_lake_model_management_page" (  -- lake.lake_model_management_page
    "model_management_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("model_management_page_idx")
);

CREATE TABLE "lake_lake_page" (  -- lake.lake_page
    "page_idx" INTEGER NOT NULL,  -- integer
    "page_name" TEXT NOT NULL,  -- text
    "page_code" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("page_idx")
);

CREATE TABLE "lake_lake_position" (  -- lake.lake_position
    "position_idx" INTEGER NOT NULL,  -- integer
    "position_name" TEXT NOT NULL,  -- text
    "position_code" INTEGER NOT NULL,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("position_idx")
);

CREATE TABLE "lake_lake_ppe_violation_page" (  -- lake.lake_ppe_violation_page
    "ppe_violation_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("ppe_violation_page_idx")
);

CREATE TABLE "lake_lake_process_optimization_page" (  -- lake.lake_process_optimization_page
    "process_optimization_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("process_optimization_page_idx")
);

CREATE TABLE "lake_lake_quality_inspection_page" (  -- lake.lake_quality_inspection_page
    "quality_inspection_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("quality_inspection_page_idx")
);

CREATE TABLE "lake_lake_team" (  -- lake.lake_team
    "team_idx" INTEGER NOT NULL,  -- integer
    "team_name" TEXT NOT NULL,  -- text
    "team_code" INTEGER NOT NULL,  -- integer
    "team_representative" TEXT,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("team_idx")
);

CREATE TABLE "lake_lake_team_roster" (  -- lake.lake_team_roster
    "team_roster_idx" INTEGER NOT NULL,  -- integer
    "team_code" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("team_roster_idx")
);

CREATE TABLE "lake_lake_vendor_company" (  -- lake.lake_vendor_company
    "vendor_company_idx" INTEGER NOT NULL,  -- integer
    "vendor_name" TEXT NOT NULL,  -- text
    "vendor_code" TEXT NOT NULL,  -- text
    "contract_status" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("vendor_company_idx")
);

CREATE TABLE "lake_lake_vendor_gate_log" (  -- lake.lake_vendor_gate_log
    "vendor_gate_log_idx" INTEGER NOT NULL,  -- integer
    "vendor_card_id" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "clock_in_at" TEXT,  -- timestamp with time zone
    "clock_out_at" TEXT,  -- timestamp with time zone
    "in_out" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("vendor_gate_log_idx")
);

CREATE TABLE "lake_lake_vendor_worker" (  -- lake.lake_vendor_worker
    "vendor_worker_idx" INTEGER NOT NULL,  -- integer
    "vendor_code" TEXT NOT NULL,  -- text
    "card_id" TEXT NOT NULL,  -- text
    "card_issued_at" TEXT NOT NULL,  -- timestamp with time zone
    "card_returned_at" TEXT,  -- timestamp with time zone
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("vendor_worker_idx")
);

CREATE TABLE "mart_mart_investment_casting" (  -- mart.mart_investment_casting
    "casting_id" TEXT NOT NULL,  -- text
    "mold_temperature" REAL,  -- double precision
    "facility_cycletime" REAL,  -- double precision
    "production_cycletime" REAL,  -- double precision
    "mechanical_strength" REAL,  -- double precision
    "molten_capacity" REAL,  -- double precision
    "injection_pressure" REAL,  -- double precision
    "sleeve_temperature" REAL,  -- double precision
    "top_temp1" REAL,  -- double precision
    "top_temp2" REAL,  -- double precision
    "top_temp3" REAL,  -- double precision
    "top_temp4" REAL,  -- double precision
    "bottom_temp1" REAL,  -- double precision
    "bottom_temp2" REAL,  -- double precision
    "bottom_temp3" REAL,  -- double precision
    "bottom_temp4" REAL,  -- double precision
    "biscuit_thickness" REAL,  -- double precision
    "cooling_water_temp" REAL,  -- double precision
    "passorfail" INTEGER NOT NULL,  -- smallint
    PRIMARY KEY ("casting_id"),
    FOREIGN KEY ("casting_id") REFERENCES "lake_lake_investment_casting" ("casting_id")
);

CREATE TABLE "mes_casting_image" (  -- mes.casting_image
    "casting_id" TEXT NOT NULL,  -- text
    "original_uri" TEXT,  -- text
    "content_type" TEXT NOT NULL,  -- text
    "image_base64" TEXT NOT NULL,  -- text
    "updated_at" TEXT NOT NULL,  -- timestamp with time zone
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "image_path" TEXT,  -- text
    "image_label" TEXT,  -- text
    PRIMARY KEY ("casting_id"),
    FOREIGN KEY ("casting_id") REFERENCES "mes_investment_casting" ("casting_id")
);

CREATE TABLE "mes_investment_casting" (  -- mes.investment_casting
    "casting_id" TEXT NOT NULL,  -- text
    "line_unit" TEXT,  -- text
    "production" TEXT,  -- text
    "timestamp" TEXT,  -- date
    "date" TEXT,  -- time without time zone
    "production_count" INTEGER,  -- integer
    "mold_temperature" REAL,  -- double precision
    "facility_cycletime" REAL,  -- double precision
    "production_cycletime" REAL,  -- double precision
    "mechanical_strength" REAL,  -- double precision
    "molten_capacity" REAL,  -- double precision
    "injection_pressure" REAL,  -- double precision
    "sleeve_temperature" REAL,  -- double precision
    "top_temp1" REAL,  -- double precision
    "top_temp2" REAL,  -- double precision
    "top_temp3" REAL,  -- double precision
    "top_temp4" REAL,  -- double precision
    "bottom_temp1" REAL,  -- double precision
    "bottom_temp2" REAL,  -- double precision
    "bottom_temp3" REAL,  -- double precision
    "bottom_temp4" REAL,  -- double precision
    "biscuit_thickness" REAL,  -- double precision
    "cooling_water_temp" REAL,  -- double precision
    "passorfail" INTEGER,  -- smallint
    PRIMARY KEY ("casting_id")
);

CREATE TABLE "mes_investment_casting_bak_20261120" (  -- mes.investment_casting_bak_20261120
    "casting_id" TEXT,  -- text
    "line_unit" TEXT,  -- text
    "production" TEXT,  -- text
    "timestamp" TEXT,  -- date
    "date" TEXT,  -- time without time zone
    "production_count" INTEGER,  -- integer
    "mold_temperature" REAL,  -- double precision
    "facility_cycletime" REAL,  -- double precision
    "production_cycletime" REAL,  -- double precision
    "mechanical_strength" REAL,  -- double precision
    "molten_capacity" REAL,  -- double precision
    "injection_pressure" REAL,  -- double precision
    "sleeve_temperature" REAL,  -- double precision
    "top_temp1" REAL,  -- double precision
    "top_temp2" REAL,  -- double precision
    "top_temp3" REAL,  -- double precision
    "top_temp4" REAL,  -- double precision
    "bottom_temp1" REAL,  -- double precision
    "bottom_temp2" REAL,  -- double precision
    "bottom_temp3" REAL,  -- double precision
    "bottom_temp4" REAL,  -- double precision
    "biscuit_thickness" REAL,  -- double precision
    "cooling_water_temp" REAL,  -- double precision
    "passorfail" INTEGER  -- smallint
);

CREATE TABLE "mes_investment_casting_change_log" (  -- mes.investment_casting_change_log
    "change_id" INTEGER NOT NULL,  -- bigint
    "casting_id" TEXT NOT NULL,  -- text
    "op" TEXT NOT NULL,  -- character(1)
    "changed_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("change_id")
);

CREATE TABLE "mes_spc_limit" (  -- mes.spc_limit
    "spc_limit_idx" INTEGER NOT NULL,  -- integer
    "line_unit" TEXT NOT NULL,  -- text
    "variable" TEXT NOT NULL,  -- text
    "cl" REAL NOT NULL,  -- double precision
    "sigma" REAL NOT NULL,  -- double precision
    "i_lcl" REAL NOT NULL,  -- double precision
    "i_ucl" REAL NOT NULL,  -- double precision
    "mr_cl" REAL NOT NULL,  -- double precision
    "mr_ucl" REAL NOT NULL,  -- double precision
    "ewma_lcl" REAL NOT NULL,  -- double precision
    "ewma_ucl" REAL NOT NULL,  -- double precision
    "effective_date" TEXT NOT NULL,  -- date
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("line_unit", "variable", "effective_date"),
    UNIQUE ("spc_limit_idx")
);

CREATE TABLE "org_access_code" (  -- org.access_code
    "access_code_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_no"),
    UNIQUE ("access_code_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_aluminum_price" (  -- org.aluminum_price
    "price_date" TEXT NOT NULL,  -- date
    "price" NUMERIC NOT NULL,  -- numeric(10,1)
    PRIMARY KEY ("price_date")
);

CREATE TABLE "org_app_user" (  -- org.app_user
    "app_user_idx" INTEGER NOT NULL,  -- bigint
    "user_id" TEXT NOT NULL,  -- text
    "password_hash" TEXT NOT NULL,  -- text
    "employee_no" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "last_login_at" TEXT,  -- timestamp with time zone
    PRIMARY KEY ("user_id"),
    UNIQUE ("app_user_idx"),
    UNIQUE ("employee_no"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no") ON DELETE CASCADE
);

CREATE TABLE "org_attendance" (  -- org.attendance
    "attendance_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_no", "work_date"),
    UNIQUE ("attendance_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_change_log" (  -- org.change_log
    "change_id" INTEGER NOT NULL,  -- bigint
    "table_name" TEXT NOT NULL,  -- text
    "row_idx" INTEGER NOT NULL,  -- integer
    "op" TEXT NOT NULL,  -- character(1)
    "changed_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("change_id")
);

CREATE TABLE "org_company_document" (  -- org.company_document
    "company_document_idx" INTEGER NOT NULL,  -- integer
    "title" TEXT NOT NULL,  -- text
    "category" TEXT,  -- text
    "file_path" TEXT NOT NULL,  -- text
    "file_name" TEXT NOT NULL,  -- text
    "uploaded_by" TEXT NOT NULL,  -- text
    "uploaded_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("company_document_idx"),
    FOREIGN KEY ("uploaded_by") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_company_documents_page" (  -- org.company_documents_page
    "company_documents_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("company_documents_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_defect_labeling_page" (  -- org.defect_labeling_page
    "defect_labeling_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("defect_labeling_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_department" (  -- org.department
    "department_idx" INTEGER NOT NULL,  -- integer
    "dept_name" TEXT NOT NULL,  -- text
    "dept_code" INTEGER NOT NULL,  -- integer
    "department_representative" TEXT,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("dept_code"),
    UNIQUE ("department_idx"),
    UNIQUE ("dept_name"),
    FOREIGN KEY ("department_representative") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_dept_roster" (  -- org.dept_roster
    "dept_roster_idx" INTEGER NOT NULL,  -- integer
    "dept_code" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("dept_roster_idx"),
    UNIQUE ("employee_no"),
    FOREIGN KEY ("dept_code") REFERENCES "org_department" ("dept_code"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_document_chunk" (  -- org.document_chunk
    "document_chunk_idx" INTEGER NOT NULL,  -- integer
    "company_document_idx" INTEGER NOT NULL,  -- integer
    "chunk_no" INTEGER NOT NULL,  -- integer
    "content" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("document_chunk_idx"),
    UNIQUE ("company_document_idx", "chunk_no"),
    FOREIGN KEY ("company_document_idx") REFERENCES "org_company_document" ("company_document_idx") ON DELETE CASCADE
);

CREATE TABLE "org_document_chunk_embedding" (  -- org.document_chunk_embedding
    "document_chunk_embedding_idx" INTEGER NOT NULL,  -- integer
    "document_chunk_idx" INTEGER NOT NULL,  -- integer
    "embedding" TEXT NOT NULL,  -- real[]
    "model_name" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("document_chunk_embedding_idx"),
    UNIQUE ("document_chunk_idx"),
    FOREIGN KEY ("document_chunk_idx") REFERENCES "org_document_chunk" ("document_chunk_idx") ON DELETE CASCADE
);

CREATE TABLE "org_document_chunk_job" (  -- org.document_chunk_job
    "company_document_idx" INTEGER NOT NULL,  -- integer
    "chunk_status" TEXT NOT NULL,  -- text
    "attempt_count" INTEGER NOT NULL,  -- integer
    "last_error" TEXT,  -- text
    "updated_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("company_document_idx"),
    FOREIGN KEY ("company_document_idx") REFERENCES "org_company_document" ("company_document_idx") ON DELETE CASCADE
);

CREATE TABLE "org_employee" (  -- org.employee
    "employee_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "dept_code" INTEGER NOT NULL,  -- integer
    "position_name" TEXT NOT NULL,  -- text
    "team_code" INTEGER,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    "employment_status" TEXT NOT NULL,  -- text
    "resigned_at" TEXT,  -- date
    PRIMARY KEY ("employee_no"),
    UNIQUE ("employee_idx"),
    FOREIGN KEY ("dept_code") REFERENCES "org_department" ("dept_code"),
    FOREIGN KEY ("position_name") REFERENCES "org_position" ("position_name"),
    FOREIGN KEY ("team_code") REFERENCES "org_team" ("team_code")
);

CREATE TABLE "org_employee_card" (  -- org.employee_card
    "employee_card_idx" INTEGER NOT NULL,  -- integer
    "card_id" TEXT NOT NULL,  -- text
    "employee_no" TEXT NOT NULL,  -- text
    "attendance_status" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("card_id"),
    UNIQUE ("employee_card_idx"),
    UNIQUE ("employee_no"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_employee_gate_log" (  -- org.employee_gate_log
    "employee_gate_log_idx" INTEGER NOT NULL,  -- integer
    "employee_card_id" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "gate" TEXT NOT NULL,  -- text
    "clock_in_at" TEXT,  -- timestamp with time zone
    "clock_out_at" TEXT,  -- timestamp with time zone
    "in_out" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("employee_gate_log_idx"),
    FOREIGN KEY ("employee_card_id") REFERENCES "org_employee_card" ("card_id")
);

CREATE TABLE "org_employee_info" (  -- org.employee_info
    "employee_info_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "employee_name" TEXT NOT NULL,  -- text
    "birth_date" TEXT NOT NULL,  -- date
    "gender" TEXT NOT NULL,  -- text
    "phone" TEXT NOT NULL,  -- text
    "address" TEXT NOT NULL,  -- text
    "email" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_no"),
    UNIQUE ("employee_info_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_employee_record" (  -- org.employee_record
    "employee_record_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "actual_hour" REAL,  -- double precision
    "overtime_hour" REAL,  -- double precision
    "late" INTEGER NOT NULL,  -- boolean
    "early_leave" INTEGER NOT NULL,  -- boolean
    "absent" INTEGER NOT NULL,  -- boolean
    "work_deficit" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("employee_no", "work_date"),
    UNIQUE ("employee_record_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_employee_status" (  -- org.employee_status
    "employee_status_idx" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "monthly_overtime_hour" REAL,  -- double precision
    "last_logout_at" TEXT,  -- timestamp with time zone
    "annual_leave_used" INTEGER,  -- integer
    "years_of_service" INTEGER,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("employee_no"),
    UNIQUE ("employee_status_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_fixed_value" (  -- org.fixed_value
    "fixed_value_idx" INTEGER NOT NULL,  -- integer
    "value_name" TEXT NOT NULL,  -- text
    "value" NUMERIC NOT NULL,  -- numeric
    "unit" TEXT,  -- text
    "effective_date" TEXT NOT NULL,  -- date
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("value_name", "effective_date"),
    UNIQUE ("fixed_value_idx")
);

CREATE TABLE "org_gate_card" (  -- org.gate_card
    "gate_card_idx" INTEGER NOT NULL,  -- integer
    "employee_card_id" TEXT,  -- text
    "vendor_card_id" TEXT,  -- text
    "gate_a" INTEGER NOT NULL,  -- boolean
    "gate_b" INTEGER NOT NULL,  -- boolean
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("employee_card_id"),
    UNIQUE ("gate_card_idx"),
    UNIQUE ("vendor_card_id"),
    FOREIGN KEY ("employee_card_id") REFERENCES "org_employee_card" ("card_id"),
    FOREIGN KEY ("vendor_card_id") REFERENCES "org_vendor_worker" ("card_id")
);

CREATE TABLE "org_hr_access_log" (  -- org.hr_access_log
    "hr_access_log_idx" INTEGER NOT NULL,  -- bigint
    "viewer_no" TEXT NOT NULL,  -- text
    "action" TEXT NOT NULL,  -- text
    "target" TEXT NOT NULL,  -- text
    "field_tier" TEXT NOT NULL,  -- text
    "row_count" INTEGER NOT NULL,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("hr_access_log_idx")
);

CREATE TABLE "org_hr_management_page" (  -- org.hr_management_page
    "hr_management_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("hr_management_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_main_page" (  -- org.main_page
    "main_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("main_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_management_report_page" (  -- org.management_report_page
    "management_report_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("management_report_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_model_management_page" (  -- org.model_management_page
    "model_management_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("model_management_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_page" (  -- org.page
    "page_idx" INTEGER NOT NULL,  -- integer
    "page_name" TEXT NOT NULL,  -- text
    "page_code" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("page_code"),
    UNIQUE ("page_idx")
);

CREATE TABLE "org_position" (  -- org.position
    "position_idx" INTEGER NOT NULL,  -- integer
    "position_name" TEXT NOT NULL,  -- text
    "position_code" INTEGER NOT NULL,  -- integer
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("position_name"),
    UNIQUE ("position_code"),
    UNIQUE ("position_idx")
);

CREATE TABLE "org_ppe_violation_page" (  -- org.ppe_violation_page
    "ppe_violation_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("ppe_violation_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_process_optimization_page" (  -- org.process_optimization_page
    "process_optimization_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("process_optimization_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_quality_inspection_page" (  -- org.quality_inspection_page
    "quality_inspection_page_idx" INTEGER NOT NULL,  -- integer
    "page_code" TEXT NOT NULL,  -- text
    "access_code" INTEGER NOT NULL,  -- integer
    "access_level" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("access_code"),
    UNIQUE ("quality_inspection_page_idx"),
    FOREIGN KEY ("page_code") REFERENCES "org_page" ("page_code")
);

CREATE TABLE "org_team" (  -- org.team
    "team_idx" INTEGER NOT NULL,  -- integer
    "team_name" TEXT NOT NULL,  -- text
    "team_code" INTEGER NOT NULL,  -- integer
    "team_representative" TEXT,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("team_code"),
    UNIQUE ("team_idx"),
    UNIQUE ("team_name"),
    FOREIGN KEY ("team_representative") REFERENCES "org_employee" ("employee_no")
);

CREATE TABLE "org_team_roster" (  -- org.team_roster
    "team_roster_idx" INTEGER NOT NULL,  -- integer
    "team_code" INTEGER NOT NULL,  -- integer
    "employee_no" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("employee_no"),
    UNIQUE ("team_roster_idx"),
    FOREIGN KEY ("employee_no") REFERENCES "org_employee" ("employee_no"),
    FOREIGN KEY ("team_code") REFERENCES "org_team" ("team_code")
);

CREATE TABLE "org_vendor_company" (  -- org.vendor_company
    "vendor_company_idx" INTEGER NOT NULL,  -- integer
    "vendor_name" TEXT NOT NULL,  -- text
    "vendor_code" TEXT NOT NULL,  -- text
    "contract_status" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("vendor_code"),
    UNIQUE ("vendor_company_idx")
);

CREATE TABLE "org_vendor_gate_log" (  -- org.vendor_gate_log
    "vendor_gate_log_idx" INTEGER NOT NULL,  -- integer
    "vendor_card_id" TEXT NOT NULL,  -- text
    "work_date" TEXT NOT NULL,  -- date
    "clock_in_at" TEXT,  -- timestamp with time zone
    "clock_out_at" TEXT,  -- timestamp with time zone
    "in_out" TEXT NOT NULL,  -- text
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    UNIQUE ("vendor_gate_log_idx"),
    FOREIGN KEY ("vendor_card_id") REFERENCES "org_vendor_worker" ("card_id")
);

CREATE TABLE "org_vendor_worker" (  -- org.vendor_worker
    "vendor_worker_idx" INTEGER NOT NULL,  -- integer
    "vendor_code" TEXT NOT NULL,  -- text
    "card_id" TEXT NOT NULL,  -- text
    "card_issued_at" TEXT NOT NULL,  -- timestamp with time zone
    "card_returned_at" TEXT,  -- timestamp with time zone
    "created_at" TEXT NOT NULL,  -- timestamp with time zone
    PRIMARY KEY ("card_id"),
    UNIQUE ("vendor_worker_idx"),
    FOREIGN KEY ("vendor_code") REFERENCES "org_vendor_company" ("vendor_code")
);

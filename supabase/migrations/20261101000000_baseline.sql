


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appraisal_assignments" (
    "id" "text" NOT NULL,
    "review_period_id" "text" NOT NULL,
    "appraiser_id" "text" NOT NULL,
    "appraiser_name" "text" NOT NULL,
    "employee_id" "text" NOT NULL,
    "employee_name" "text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "template_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "assignment_type" "text" NOT NULL,
    "link_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "due_date" timestamp with time zone,
    CONSTRAINT "appraisal_assignments_assignment_type_check" CHECK (("assignment_type" = ANY (ARRAY['auto'::"text", 'manual'::"text"]))),
    CONSTRAINT "appraisal_assignments_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['exec-to-leader'::"text", 'leader-to-member'::"text", 'member-to-leader'::"text", 'leader-to-leader'::"text", 'member-to-member'::"text", 'hr-to-all'::"text", 'custom'::"text"]))),
    CONSTRAINT "appraisal_assignments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in-progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."appraisal_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appraisal_links" (
    "id" "text" NOT NULL,
    "employee_id" "text" NOT NULL,
    "appraiser_id" "text" NOT NULL,
    "template_id" "text" NOT NULL,
    "review_period_id" "text",
    "review_period_name" "text",
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appraisal_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appraisals" (
    "id" "text" NOT NULL,
    "template_id" "text" NOT NULL,
    "employee_id" "text" NOT NULL,
    "appraiser_id" "text" NOT NULL,
    "review_period_id" "text" NOT NULL,
    "review_period_name" "text" NOT NULL,
    "responses" "jsonb" NOT NULL,
    "score" numeric NOT NULL,
    "max_score" numeric NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appraisals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_profiles" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "employee_id" "text" NOT NULL,
    "profile_picture" "text",
    "cover_photo" "text",
    "bio" "text",
    "headline" character varying(100),
    "location" character varying(100),
    "timezone" character varying(50),
    "start_date" "date",
    "birthday" character varying(5),
    "pronouns" character varying(20),
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "interests" "jsonb" DEFAULT '[]'::"jsonb",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "contact_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "phone_number" character varying(20),
    "slack_handle" character varying(50),
    "fun_facts" "jsonb" DEFAULT '[]'::"jsonb",
    "achievements" "jsonb" DEFAULT '[]'::"jsonb",
    "education" "jsonb" DEFAULT '[]'::"jsonb",
    "previous_roles" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cover_photo_position" integer DEFAULT 50,
    "profile_picture_position_x" integer DEFAULT 50,
    "profile_picture_position_y" integer DEFAULT 50
);


ALTER TABLE "public"."employee_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "role" "text" NOT NULL,
    "hierarchy" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "text",
    "reports_to" "text",
    "employment_status" "text" DEFAULT 'permanent'::"text",
    CONSTRAINT "employees_hierarchy_check" CHECK (("hierarchy" = ANY (ARRAY['chairman'::"text", 'executive'::"text", 'leader'::"text", 'department-leader'::"text", 'member'::"text", 'hr'::"text"])))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_summaries" (
    "employee_id" "text" NOT NULL,
    "summary_text" "text" NOT NULL,
    "insights" "jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_periods" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "review_periods_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"]))),
    CONSTRAINT "review_periods_type_check" CHECK (("type" = ANY (ARRAY['Monthly'::"text", 'Q1'::"text", 'Q2'::"text", 'Q3'::"text", 'Q4'::"text", 'H1'::"text", 'H2'::"text", 'Annual'::"text", 'Custom'::"text"])))
);


ALTER TABLE "public"."review_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo" "text",
    "admin_pin" "text" NOT NULL,
    "accent_color" "text" NOT NULL,
    "theme" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "employee_of_period_overrides" "jsonb",
    CONSTRAINT "settings_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subtitle" "text",
    "type" "text" NOT NULL,
    "categories" "jsonb" NOT NULL,
    "questions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" NOT NULL,
    "username" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_login_at" timestamp with time zone,
    "employee_id" "text",
    "must_change_password" boolean DEFAULT false,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appraisal_assignments"
    ADD CONSTRAINT "appraisal_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appraisal_links"
    ADD CONSTRAINT "appraisal_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appraisal_links"
    ADD CONSTRAINT "appraisal_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."appraisals"
    ADD CONSTRAINT "appraisals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_summaries"
    ADD CONSTRAINT "performance_summaries_pkey" PRIMARY KEY ("employee_id");



ALTER TABLE ONLY "public"."review_periods"
    ADD CONSTRAINT "review_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_appraisal_assignments_appraiser" ON "public"."appraisal_assignments" USING "btree" ("appraiser_id");



CREATE INDEX "idx_appraisal_assignments_review_period" ON "public"."appraisal_assignments" USING "btree" ("review_period_id");



CREATE INDEX "idx_appraisal_links_employee" ON "public"."appraisal_links" USING "btree" ("employee_id");



CREATE INDEX "idx_appraisal_links_token" ON "public"."appraisal_links" USING "btree" ("token");



CREATE INDEX "idx_appraisals_appraiser" ON "public"."appraisals" USING "btree" ("appraiser_id");



CREATE INDEX "idx_appraisals_employee" ON "public"."appraisals" USING "btree" ("employee_id");



CREATE INDEX "idx_appraisals_review_period" ON "public"."appraisals" USING "btree" ("review_period_id");



CREATE INDEX "idx_employee_profiles_employee_id" ON "public"."employee_profiles" USING "btree" ("employee_id");



CREATE INDEX "idx_employees_hierarchy" ON "public"."employees" USING "btree" ("hierarchy");



CREATE INDEX "idx_review_periods_status" ON "public"."review_periods" USING "btree" ("status");



CREATE INDEX "idx_review_periods_year" ON "public"."review_periods" USING "btree" ("year");



CREATE INDEX "idx_teams_created" ON "public"."teams" USING "btree" ("created_at");



CREATE INDEX "idx_templates_type" ON "public"."templates" USING "btree" ("type");



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("lower"("username"));



ALTER TABLE ONLY "public"."employee_profiles"
    ADD CONSTRAINT "employee_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all operations" ON "public"."appraisal_assignments" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."appraisal_links" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."appraisals" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."employee_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."employees" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."performance_summaries" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."review_periods" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."settings" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."teams" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."templates" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete users" ON "public"."users" FOR DELETE USING (true);



CREATE POLICY "Users can insert users" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can read all users" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can update users" ON "public"."users" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."appraisal_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appraisal_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appraisals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."appraisal_assignments" TO "anon";
GRANT ALL ON TABLE "public"."appraisal_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."appraisal_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."appraisal_links" TO "anon";
GRANT ALL ON TABLE "public"."appraisal_links" TO "authenticated";
GRANT ALL ON TABLE "public"."appraisal_links" TO "service_role";



GRANT ALL ON TABLE "public"."appraisals" TO "anon";
GRANT ALL ON TABLE "public"."appraisals" TO "authenticated";
GRANT ALL ON TABLE "public"."appraisals" TO "service_role";



GRANT ALL ON TABLE "public"."employee_profiles" TO "anon";
GRANT ALL ON TABLE "public"."employee_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."performance_summaries" TO "anon";
GRANT ALL ON TABLE "public"."performance_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."review_periods" TO "anon";
GRANT ALL ON TABLE "public"."review_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."review_periods" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































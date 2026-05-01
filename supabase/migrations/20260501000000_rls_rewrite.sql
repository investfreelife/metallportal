-- =============================================================
-- RLS REWRITE — Wave 0 / P0-2
-- Replaces permissive USING(true) and ineffective tenant-only
-- policies with role-scoped policies:
--   A. public-read tables — SELECT for anon+authenticated, write only service_role
--   B. admin-only tables  — service_role only (anon/authenticated default-deny)
--   C. owner-private      — authenticated sees only own rows, service_role full
-- 
-- Pre-flight snapshots (rollback material) saved to harlan-ai/week2/:
--   pg_policies_backup_20260501.json   (66 policies)
--   rls_flags_before_20260501.txt     (54 tables, all RLS-enabled)
--   columns_inventory_20260501.txt    (user_id/owner_id/etc)
--   classification_20260501.md        (A=4, B=44, C=6)
-- 
-- Date: 2026-05-01
-- =============================================================

BEGIN;

-- ─── A. PUBLIC-READ ──────────────────────────────────────────

-- categories: SELECT public (is_active=true), write service_role only
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;

CREATE POLICY categories_public_read ON public.categories
  FOR SELECT USING (is_active = true);
CREATE POLICY categories_service_role ON public.categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- products: SELECT public (is_active=true), write service_role only
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Suppliers can insert own products" ON public.products;
DROP POLICY IF EXISTS "Suppliers can update own products" ON public.products;

CREATE POLICY products_public_read ON public.products
  FOR SELECT USING (is_active = true);
CREATE POLICY products_service_role ON public.products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- price_items: SELECT public, write service_role only
DROP POLICY IF EXISTS "Price items are viewable by everyone" ON public.price_items;
DROP POLICY IF EXISTS "Suppliers can insert own prices" ON public.price_items;
DROP POLICY IF EXISTS "Suppliers can update own prices" ON public.price_items;

CREATE POLICY price_items_public_read ON public.price_items
  FOR SELECT USING (true);
CREATE POLICY price_items_service_role ON public.price_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- suppliers: SELECT public, write service_role + owner (user_id=auth.uid())
DROP POLICY IF EXISTS "Suppliers are viewable by everyone" ON public.suppliers;

CREATE POLICY suppliers_public_read ON public.suppliers
  FOR SELECT USING (true);
CREATE POLICY suppliers_owner_write ON public.suppliers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY suppliers_service_role ON public.suppliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── B. ADMIN-ONLY ───────────────────────────────────────────
-- service_role only; anon/authenticated have NO policies → default-deny

-- activities
DROP POLICY IF EXISTS "service_role_all" ON public.activities;
DROP POLICY IF EXISTS "tenant_isolation" ON public.activities;

CREATE POLICY activities_service_role ON public.activities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- admin_users
DROP POLICY IF EXISTS "allow_admin_write" ON public.admin_users;
DROP POLICY IF EXISTS "allow_login_check" ON public.admin_users;
DROP POLICY IF EXISTS "service_only" ON public.admin_users;

CREATE POLICY admin_users_service_role ON public.admin_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_actions
DROP POLICY IF EXISTS "service_role_all" ON public.agent_actions;

CREATE POLICY agent_actions_service_role ON public.agent_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_cycles
DROP POLICY IF EXISTS "service_role_all" ON public.agent_cycles;

CREATE POLICY agent_cycles_service_role ON public.agent_cycles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_memory
DROP POLICY IF EXISTS "service_role_all" ON public.agent_memory;

CREATE POLICY agent_memory_service_role ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ai_cost_log
DROP POLICY IF EXISTS "tenant_cost" ON public.ai_cost_log;
DROP POLICY IF EXISTS "tenant_cost_log" ON public.ai_cost_log;

CREATE POLICY ai_cost_log_service_role ON public.ai_cost_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ai_queue
DROP POLICY IF EXISTS "service_role_all" ON public.ai_queue;
DROP POLICY IF EXISTS "tenant_isolation" ON public.ai_queue;

CREATE POLICY ai_queue_service_role ON public.ai_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- calls
DROP POLICY IF EXISTS "service_role_all" ON public.calls;

CREATE POLICY calls_service_role ON public.calls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- categories_archive_metallprokat_20260428
-- (no existing policies on categories_archive_metallprokat_20260428)

CREATE POLICY categories_archive_metallprokat_20260428_service_role ON public.categories_archive_metallprokat_20260428
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- channels
DROP POLICY IF EXISTS "service_role_all" ON public.channels;

CREATE POLICY channels_service_role ON public.channels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- contact_sessions
DROP POLICY IF EXISTS "service_only_sessions" ON public.contact_sessions;

CREATE POLICY contact_sessions_service_role ON public.contact_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- contacts
DROP POLICY IF EXISTS "service_role_all" ON public.contacts;
DROP POLICY IF EXISTS "tenant_isolation" ON public.contacts;

CREATE POLICY contacts_service_role ON public.contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_users
DROP POLICY IF EXISTS "tenant_isolation" ON public.crm_users;

CREATE POLICY crm_users_service_role ON public.crm_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- customer_price_overrides
DROP POLICY IF EXISTS "overrides_tenant_isolation" ON public.customer_price_overrides;

CREATE POLICY customer_price_overrides_service_role ON public.customer_price_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- data_quality_queue
DROP POLICY IF EXISTS "dqq_tenant_isolation" ON public.data_quality_queue;

CREATE POLICY data_quality_queue_service_role ON public.data_quality_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- deals
DROP POLICY IF EXISTS "service_role_all" ON public.deals;
DROP POLICY IF EXISTS "tenant_isolation" ON public.deals;

CREATE POLICY deals_service_role ON public.deals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- discount_policies
DROP POLICY IF EXISTS "policies_tenant_isolation" ON public.discount_policies;

CREATE POLICY discount_policies_service_role ON public.discount_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- discount_review_queue
DROP POLICY IF EXISTS "discount_review_tenant_isolation" ON public.discount_review_queue;

CREATE POLICY discount_review_queue_service_role ON public.discount_review_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- email_accounts
DROP POLICY IF EXISTS "service_role_all_email_accounts" ON public.email_accounts;

CREATE POLICY email_accounts_service_role ON public.email_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- emails
DROP POLICY IF EXISTS "service_role_all_emails" ON public.emails;

CREATE POLICY emails_service_role ON public.emails
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- manual_review_queue
DROP POLICY IF EXISTS "mrq_tenant_isolation" ON public.manual_review_queue;

CREATE POLICY manual_review_queue_service_role ON public.manual_review_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "Allow insert for all" ON public.orders;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.orders;
DROP POLICY IF EXISTS "service_role_all_orders" ON public.orders;

CREATE POLICY orders_service_role ON public.orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- parsing_questions
DROP POLICY IF EXISTS "questions_tenant_isolation" ON public.parsing_questions;

CREATE POLICY parsing_questions_service_role ON public.parsing_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- price_suppliers
DROP POLICY IF EXISTS "suppliers_tenant_isolation" ON public.price_suppliers;

CREATE POLICY price_suppliers_service_role ON public.price_suppliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- products_archive_metallprokat_20260428
-- (no existing policies on products_archive_metallprokat_20260428)

CREATE POLICY products_archive_metallprokat_20260428_service_role ON public.products_archive_metallprokat_20260428
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- products_unit_cleanup_log
-- (no existing policies on products_unit_cleanup_log)

CREATE POLICY products_unit_cleanup_log_service_role ON public.products_unit_cleanup_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_payouts
DROP POLICY IF EXISTS "service_role_all" ON public.referral_payouts;

CREATE POLICY referral_payouts_service_role ON public.referral_payouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_transactions
DROP POLICY IF EXISTS "service_role_all" ON public.referral_transactions;

CREATE POLICY referral_transactions_service_role ON public.referral_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referrals
DROP POLICY IF EXISTS "service_role_all" ON public.referrals;

CREATE POLICY referrals_service_role ON public.referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- site_events
DROP POLICY IF EXISTS "service_role_all" ON public.site_events;
DROP POLICY IF EXISTS "tenant_isolation" ON public.site_events;

CREATE POLICY site_events_service_role ON public.site_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- site_settings
-- (no existing policies on site_settings)

CREATE POLICY site_settings_service_role ON public.site_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- site_users
DROP POLICY IF EXISTS "service_role_all" ON public.site_users;

CREATE POLICY site_users_service_role ON public.site_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- social_posts
DROP POLICY IF EXISTS "service_role_all" ON public.social_posts;

CREATE POLICY social_posts_service_role ON public.social_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_parsing_rules
DROP POLICY IF EXISTS "rules_tenant_isolation" ON public.supplier_parsing_rules;

CREATE POLICY supplier_parsing_rules_service_role ON public.supplier_parsing_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_price_offers
DROP POLICY IF EXISTS "offers_tenant_isolation" ON public.supplier_price_offers;

CREATE POLICY supplier_price_offers_service_role ON public.supplier_price_offers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_price_uploads
DROP POLICY IF EXISTS "uploads_tenant_isolation" ON public.supplier_price_uploads;

CREATE POLICY supplier_price_uploads_service_role ON public.supplier_price_uploads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_quote_requests
DROP POLICY IF EXISTS "quote_req_tenant_isolation" ON public.supplier_quote_requests;

CREATE POLICY supplier_quote_requests_service_role ON public.supplier_quote_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_quote_responses
DROP POLICY IF EXISTS "quote_resp_tenant_isolation" ON public.supplier_quote_responses;

CREATE POLICY supplier_quote_responses_service_role ON public.supplier_quote_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- supplier_sku_mapping
DROP POLICY IF EXISTS "mapping_tenant_isolation" ON public.supplier_sku_mapping;

CREATE POLICY supplier_sku_mapping_service_role ON public.supplier_sku_mapping
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- system_logs
DROP POLICY IF EXISTS "service_only_logs" ON public.system_logs;

CREATE POLICY system_logs_service_role ON public.system_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tasks
DROP POLICY IF EXISTS "service_role_all" ON public.tasks;

CREATE POLICY tasks_service_role ON public.tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- telegram_auth_codes
-- (no existing policies on telegram_auth_codes)

CREATE POLICY telegram_auth_codes_service_role ON public.telegram_auth_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tenant_settings
DROP POLICY IF EXISTS "service_only" ON public.tenant_settings;

CREATE POLICY tenant_settings_service_role ON public.tenant_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tenants
-- (no existing policies on tenants)

CREATE POLICY tenants_service_role ON public.tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── C. OWNER-PRIVATE ────────────────────────────────────────
-- authenticated sees only own rows; service_role full access

-- chats: owner-private via user_id = auth.uid()
DROP POLICY IF EXISTS "allow_all_chats" ON public.chats;

CREATE POLICY chats_owner ON public.chats
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY chats_service_role ON public.chats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- profiles: owner-private via auth.uid() = id
DROP POLICY IF EXISTS "Пользователь видит свой профиль" ON public.profiles;
DROP POLICY IF EXISTS "Пользователь обновляет свой профи" ON public.profiles;
DROP POLICY IF EXISTS "Пользователь создаёт свой профиль" ON public.profiles;

CREATE POLICY profiles_owner ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_service_role ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- referral_partners: owner-private via auth.uid() = user_id
DROP POLICY IF EXISTS "service_role_all" ON public.referral_partners;

CREATE POLICY referral_partners_owner ON public.referral_partners
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY referral_partners_service_role ON public.referral_partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- requests: owner-private via auth.uid() = user_id
DROP POLICY IF EXISTS "Anyone can create requests" ON public.requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.requests;

CREATE POLICY requests_owner ON public.requests
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY requests_service_role ON public.requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- users: owner-private via auth.uid() = id
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY users_owner ON public.users
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY users_service_role ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- messages: owner-private via chat_id → chats.user_id join
DROP POLICY IF EXISTS "allow_all_messages" ON public.messages;

CREATE POLICY messages_owner ON public.messages
  FOR ALL TO authenticated
  USING (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()))
  WITH CHECK (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));
CREATE POLICY messages_service_role ON public.messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

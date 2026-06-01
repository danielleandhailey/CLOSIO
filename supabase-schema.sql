-- CLOSIO™ V6 Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BORROWERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Working',
  loan_type TEXT,
  lender TEXT,
  rate NUMERIC(6,3),
  purchase_price NUMERIC(12,2),
  loan_amount NUMERIC(12,2),
  rate_status TEXT DEFAULT 'Floating', -- Floating or Locked
  coe_date DATE,
  date_submitted DATE,
  funded_date DATE,
  last_touched TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  phone TEXT,
  email TEXT,
  occupancy TEXT,
  ltv NUMERIC(5,2),
  dti NUMERIC(5,2),
  income_type TEXT,
  seller_cc NUMERIC(10,2),
  locked_rate NUMERIC(6,3),
  appraisal_value NUMERIC(12,2),
  appraisal_waiver BOOLEAN DEFAULT FALSE,
  appraisal_waiver_reason TEXT,
  bonzo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS borrower_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'task', -- task or appointment
  assigned_to TEXT,
  outlook_link TEXT,
  calendly_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAGE HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTINGENCIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contingencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS TABLE (Buyer's Agent, Title, Lender, Processor)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- buyers_agent, title_escrow, lender, processor
  name TEXT,
  company TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STIPULATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stipulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  received BOOLEAN DEFAULT FALSE,
  received_date DATE,
  doc_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAM CHAT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS team_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  sender_name TEXT NOT NULL,
  sender_role TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LENDER MATRICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS lender_matrices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  ai_index TEXT, -- JSON stringified index
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RATE RETREAD TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_retread (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  locked_rate NUMERIC(6,3),
  current_market_rate NUMERIC(6,3),
  annual_savings NUMERIC(10,2),
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  bonzo_triggered BOOLEAN DEFAULT FALSE,
  bonzo_triggered_at TIMESTAMPTZ
);

-- ============================================================
-- BONZO PULL LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bonzo_pull_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  pulled_at TIMESTAMPTZ DEFAULT NOW(),
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success'
);

-- ============================================================
-- USER PROFILES TABLE (roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'LOA', -- LO, LOA, Admin
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contingencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stipulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_retread ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonzo_pull_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read/write borrowers (team shared pipeline)
CREATE POLICY "Authenticated users can manage borrowers"
  ON borrowers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tags follow borrowers
CREATE POLICY "Authenticated users can manage tags"
  ON borrower_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tasks"
  ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage documents"
  ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage stage history"
  ON stage_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage contingencies"
  ON contingencies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage contacts"
  ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage stipulations"
  ON stipulations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write team chat"
  ON team_chat FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Matrices are private per user
CREATE POLICY "Users own their matrices"
  ON lender_matrices FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can manage rate retread"
  ON rate_retread FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage bonzo log"
  ON bonzo_pull_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================================
-- REALTIME SUBSCRIPTIONS (enable for all tables)
-- ============================================================
-- Run in Supabase Dashboard > Database > Replication
-- Or enable via API. Tables to enable:
-- borrowers, borrower_tags, tasks, team_chat, contingencies,
-- contacts, stipulations, stage_history

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Create via Supabase Dashboard > Storage
-- Bucket name: "documents" (public: false)
-- Bucket name: "matrices" (public: false)

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_borrowers_updated_at
  BEFORE UPDATE ON borrowers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 
          COALESCE(NEW.raw_user_meta_data->>'role', 'LOA'));
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

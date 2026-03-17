-- Skin Laser & MedSpa - Supabase Table Setup
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service TEXT,
  message TEXT,
  hear_about TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'resolved')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specials table
CREATE TABLE IF NOT EXISTS specials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price TEXT,
  original_price TEXT,
  tag TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  page TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_specials_active ON specials(active);
CREATE INDEX IF NOT EXISTS idx_specials_sort_order ON specials(sort_order);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
-- Allow insert from API (using service role key)
CREATE POLICY "Allow insert leads" ON leads
  FOR INSERT WITH CHECK (true);

-- Allow select for service role
CREATE POLICY "Allow select leads" ON leads
  FOR SELECT USING (true);

-- Allow update for service role
CREATE POLICY "Allow update leads" ON leads
  FOR UPDATE USING (true);

-- RLS Policies for specials
CREATE POLICY "Allow all specials" ON specials
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for page_views
CREATE POLICY "Allow insert page_views" ON page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select page_views" ON page_views
  FOR SELECT USING (true);

-- Insert some sample specials
INSERT INTO specials (title, description, price, original_price, tag, active, sort_order) VALUES
  ('Spring Glow Package', 'Chemical peel + LED light therapy session. Perfect for refreshing your skin this season.', '$199', '$350', 'Most Popular', true, 1),
  ('Laser Hair Removal - Full Legs', 'Full legs laser hair removal session with our Elite iQ system.', '$299', '$450', 'Save 33%', true, 2),
  ('Botox Special', '20 units of Botox for forehead and crow''s feet.', '$199', '$280', 'Limited Time', true, 3);

-- Seed initial data for testing

-- Insert departments
INSERT INTO departments (name, code) VALUES
  ('Computer Science', 'CSE'),
  ('Electronics', 'ECE'),
  ('Mechanical', 'MECH'),
  ('Civil', 'CIVIL')
ON CONFLICT (code) DO NOTHING;

-- Insert academic years
INSERT INTO academic_years (year_level, name) VALUES
  (1, 'First Year'),
  (2, 'Second Year'),
  (3, 'Third Year'),
  (4, 'Fourth Year')
ON CONFLICT DO NOTHING;

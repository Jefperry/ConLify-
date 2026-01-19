# ConLify

A modern digital ledger for Rotating Savings and Credit Associations (ROSCA). ConLify automates payment tracking, manages member queues, and brings transparency to savings circles.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Security](#security)
- [License](#license)

## Overview

ConLify is a web application designed to digitize and streamline the management of ROSCA (Rotating Savings and Credit Association) groups. Traditional ROSCAs rely on manual tracking and trust-based systems. ConLify provides a transparent, digital alternative where group presidents can manage members, track payments, and automate the contribution cycle.

### What is a ROSCA?

A ROSCA is a group of individuals who agree to contribute a fixed amount of money to a common pool on a regular basis (weekly or monthly). Each cycle, the pooled funds are given to one member on a rotating basis until everyone has received the pot once.

## Features

### Authentication and User Management

- Email/password authentication with Supabase Auth
- Email verification for new accounts
- User profile management (name, phone number)
- Session management with automatic token refresh

### Group Management

- Create savings groups with customizable contribution amounts
- Set contribution frequency (weekly or monthly)
- Generate unique invite codes for member recruitment
- Archive and restore groups
- Permanently delete groups with all associated data

### Member Roles and Permissions

- **President**: Full control over group settings, payment verification, and member management
- **Vice President**: Assists with group management
- **Member**: Standard participant in the savings circle

### Payment Cycles

- Create payment cycles with start and end dates
- Track cycle status (active, closed)
- Countdown display showing days until cycle ends or starts
- Automatic payment log creation for all members when a cycle begins

### Payment Tracking

- Members can mark their payments as submitted
- Presidents verify or reject submitted payments
- Payment statuses: unpaid, pending, verified, rejected
- Real-time payment status updates

### Queue Management

- Automatic queue position assignment for new members
- President can reorder member queue positions
- Visual queue display showing payout order

### Dashboard and Analytics

- Personal dashboard showing all groups
- Total contributions across all groups
- Next payment due dates
- Group-specific analytics with charts
- Personal payment statistics
- Member performance metrics (president only)
- Cycle reports with CSV export

### Settings and Configuration

- Edit group name, contribution amount, and frequency
- View and copy invite codes
- Archive groups to hide from active view
- Restore archived groups
- Permanently delete groups

### Notifications

- In-app notification center
- Payment reminders
- Verification status updates
- Mark notifications as read

## Tech Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and development server
- **React Router DOM v6** - Client-side routing
- **TanStack React Query** - Server state management and caching
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library
- **Recharts** - Charting library for analytics
- **date-fns** - Date utility library
- **Lucide React** - Icon library

### Backend

- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Row Level Security (RLS)
  - Real-time subscriptions

### Development Tools

- **ESLint** - Code linting
- **Vitest** - Unit testing framework
- **PostCSS** - CSS processing

## Prerequisites

Before running ConLify, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **bun** package manager
- **Supabase account** (free tier available at https://supabase.com)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ConLify.git
cd ConLify
```

2. Install dependencies:

```bash
npm install
# or
bun install
```

## Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Fill in your Supabase credentials in the `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project dashboard under Settings > API.

## Database Setup

Run the following SQL scripts in your Supabase SQL Editor to set up the required tables and policies:

### 1. Create Enums

```sql
-- Member status enum
CREATE TYPE member_status AS ENUM ('active', 'inactive', 'removed');

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('unpaid', 'pending', 'verified', 'rejected');

-- Group frequency enum
CREATE TYPE group_frequency AS ENUM ('weekly', 'monthly');

-- Cycle status enum
CREATE TYPE cycle_status AS ENUM ('active', 'closed');

-- Member role enum
CREATE TYPE member_role AS ENUM ('president', 'vice_president', 'member');
```

### 2. Create Tables

```sql
-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  president_id UUID NOT NULL REFERENCES auth.users(id),
  president_email TEXT NOT NULL,
  frequency group_frequency NOT NULL DEFAULT 'monthly',
  contribution_amount DECIMAL(10,2) NOT NULL,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 8)),
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  queue_position INTEGER NOT NULL,
  status member_status NOT NULL DEFAULT 'active',
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id),
  UNIQUE(group_id, queue_position)
);

-- Payment cycles table
CREATE TABLE payment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES group_members(id),
  cycle_number INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status cycle_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment logs table
CREATE TABLE payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES payment_cycles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id),
  status payment_status NOT NULL DEFAULT 'unpaid',
  paid_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cycle_id, member_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Enable Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups policies
CREATE POLICY "Users can view groups they belong to" ON groups FOR SELECT
  USING (id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT
  WITH CHECK (auth.uid() = president_id);
CREATE POLICY "Presidents can update their groups" ON groups FOR UPDATE
  USING (auth.uid() = president_id);
CREATE POLICY "Presidents can delete their groups" ON groups FOR DELETE
  USING (auth.uid() = president_id);

-- Group members policies
CREATE POLICY "Users can view members of their groups" ON group_members FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can join groups" ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Presidents can manage members" ON group_members FOR UPDATE
  USING (group_id IN (SELECT id FROM groups WHERE president_id = auth.uid()));
CREATE POLICY "Presidents can remove members" ON group_members FOR DELETE
  USING (group_id IN (SELECT id FROM groups WHERE president_id = auth.uid()));

-- Payment cycles policies
CREATE POLICY "Users can view cycles of their groups" ON payment_cycles FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Presidents can create cycles" ON payment_cycles FOR INSERT
  WITH CHECK (group_id IN (SELECT id FROM groups WHERE president_id = auth.uid()));
CREATE POLICY "Presidents can update cycles" ON payment_cycles FOR UPDATE
  USING (group_id IN (SELECT id FROM groups WHERE president_id = auth.uid()));

-- Payment logs policies
CREATE POLICY "Users can view payment logs of their groups" ON payment_logs FOR SELECT
  USING (cycle_id IN (
    SELECT pc.id FROM payment_cycles pc
    JOIN group_members gm ON pc.group_id = gm.group_id
    WHERE gm.user_id = auth.uid()
  ));
CREATE POLICY "Members can mark their payments" ON payment_logs FOR UPDATE
  USING (member_id IN (SELECT id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Presidents can manage payment logs" ON payment_logs FOR ALL
  USING (cycle_id IN (
    SELECT pc.id FROM payment_cycles pc
    JOIN groups g ON pc.group_id = g.id
    WHERE g.president_id = auth.uid()
  ));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT
  WITH CHECK (TRUE);
```

### 4. Create Profile Trigger

```sql
-- Automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
# or
bun dev
```

The application will be available at `http://localhost:8080`.

### Production Build

Build for production:

```bash
npm run build
# or
bun run build
```

Preview the production build:

```bash
npm run preview
# or
bun run preview
```

### Running Tests

```bash
npm run test
# or
bun test
```

## Project Structure

```
ConLify/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── settings/       # Settings page components
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # React context providers
│   │   ├── AuthContext.tsx # Authentication state
│   │   └── ThemeContext.tsx# Theme (dark/light) state
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase client configuration
│   ├── lib/                # Utility functions
│   │   ├── cycleManagement.ts  # Payment cycle utilities
│   │   ├── exportCsv.ts        # CSV export functionality
│   │   ├── notifications.ts    # Notification utilities
│   │   ├── security.ts         # Security utilities
│   │   └── utils.ts            # General utilities
│   ├── pages/              # Page components
│   │   ├── CreateGroup.tsx     # Create new group
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   ├── GroupDetail.tsx     # Group details and management
│   │   ├── GroupSettings.tsx   # Group settings page
│   │   ├── Index.tsx           # Landing page
│   │   ├── Invoice.tsx         # Invoice view
│   │   ├── JoinGroup.tsx       # Join group via invite code
│   │   ├── Login.tsx           # Login page
│   │   ├── Profile.tsx         # User profile
│   │   └── Signup.tsx          # Registration page
│   ├── test/               # Test files
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Root component with routing
│   └── main.tsx            # Application entry point
├── .env.example            # Environment variables template
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Security

ConLify implements multiple layers of security following OWASP best practices:

### Input Validation and Sanitization

- Schema-based validation on all user inputs
- HTML entity encoding to prevent XSS attacks
- SQL injection pattern detection
- Length limits on all text fields
- Type checking and sanitization

### Rate Limiting

- IP and user-based rate limiting on all forms
- Configurable limits per action type:
  - Login: 5 attempts per 15 minutes
  - Signup: 3 attempts per hour
  - Group creation: 10 per hour
- Graceful error messages with retry information

### Content Security Policy

- Strict CSP headers prevent unauthorized script execution
- Frame ancestors blocked to prevent clickjacking
- Form actions restricted to same origin

### Authentication

- Secure session management via Supabase Auth
- Email verification required for new accounts
- Automatic token refresh

### API Security

- All API keys stored in environment variables
- Row Level Security (RLS) on all database tables
- User-specific data access policies

## License

This project is licensed under the MIT License.

---

ConLify is a record-keeping tool and not a financial institution. It does not hold, transfer, or manage actual funds.

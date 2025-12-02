# studox

A comprehensive study tracking and productivity application built with React, TypeScript, and Supabase. Track your subjects, manage topics, monitor study sessions with Pomodoro timer, and stay organized with exams and todos.

<img width="1897" height="862" alt="image" src="https://github.com/user-attachments/assets/f7c9042e-41e3-4c2e-8de8-eb218cf83b74" />


## Features

### 📚 Subject & Topic Management
- Create and organize subjects with custom colors
- Add topics under each subject
- Track revision counts and last revised dates
- Upload and manage PPT/PDF resources for each topic

### ⏱️ Study Tracking
- **Pomodoro Timer**: Focus sessions with customizable work/break intervals
- **Stopwatch**: Manual time tracking for flexible study sessions
- **Study History**: View completed sessions grouped by date with total study time
- **Dashboard Timeline**: Visualize your study activity over the last 7 days

### 📅 Calendar & Exams
- View study activity and exams on an interactive calendar
- Create and manage exams with dates, types, and tags
- Upload exam PPTs and resources
- See subject names alongside exam dates

### ✅ Task Management
- Daily todos on the dashboard
- Quick task creation and completion tracking
- Clean, minimal interface for productivity

### 🔐 Authentication
- Secure user authentication with Supabase Auth
- User profiles with customizable settings

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Charts**: Recharts
- **Routing**: React Router

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (or use the provided migrations)

### Installation

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd strack-main
```

2. Install dependencies:
```sh
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database:
Run the Supabase migrations located in `supabase/migrations/`:
- `20251202092442_8d9f17d1-17ec-49c0-b255-3e64454bf120.sql` - Main schema
- `20251202100000_add_exams_table.sql` - Exams table

5. Start the development server:
```sh
npm run dev
```

The application will be available at `http://localhost:5173`

## Demo Credentials

You can use the following demo credentials to test the application:

- **Email**: `khuranaaksh08@gmail.com`
- **Password**: `123456`

> **Note**: These are demo credentials for testing purposes. Please do not use them for production or store sensitive data.

## Project Structure

```
strack-main/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── Pomodoro/        # Timer components
│   │   └── Dashboard/       # Dashboard-specific components
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── CalendarPage.tsx # Calendar view
│   │   ├── HistoryPage.tsx  # Study history
│   │   ├── PomodoroPage.tsx # Timer page
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # Supabase client and types
│   └── App.tsx              # Main app component
├── supabase/
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## Database Schema

The application uses the following main tables:
- `profiles` - User profiles
- `subjects` - Study subjects
- `topics` - Topics under subjects
- `study_sessions` - Pomodoro and study session records
- `notes` - Notes and file attachments
- `exams` - Exam dates and resources
- `papers` - Previous year papers

Storage buckets:
- `notes` - Private bucket for topic resources (PPT/PDF)
- `papers` - Private bucket for previous year papers
- `exams` - Private bucket for exam PPTs

## Key Features Explained

### File Management
- Upload PPT, PPTX, and PDF files to topics
- Preview PDFs directly in the browser
- Preview PPT/PPTX files using Office Online viewer
- Download files with secure signed URLs (private bucket access)

### Study Session Tracking
- Pomodoro sessions are automatically saved when completed
- Stopwatch sessions are stored in localStorage
- Both are displayed in the History page and Dashboard timeline

### Calendar Integration
- View study sessions and exams on the calendar
- Click on dates to see detailed activity
- Exams show subject names for easy identification

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- Component-based architecture

## Deployment

The application can be deployed to any static hosting service (Vercel, Netlify, etc.) or through Lovable's built-in deployment.

For Supabase projects, ensure your environment variables are set correctly in your hosting platform.

## License

This project is part of a study tracking application.

## Contributing

This is a personal project. For issues or suggestions, please open an issue in the repository.

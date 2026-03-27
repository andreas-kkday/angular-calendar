import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieSession from 'cookie-session';
import authRoutes from './routes/auth';
import calendarRoutes from './routes/calendar';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.RENDER_EXTERNAL_URL || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'secret'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

app.use('/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);

// Static files for Angular frontend
const frontendPath = path.join(__dirname, '../../frontend/dist/frontend/browser');
app.use(express.static(frontendPath));

// Catch-all: serve index.html for any other route (handles Angular client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on ${process.env.RENDER_EXTERNAL_URL}:${PORT}`);
});

import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import calendarRoutes from './routes/calendar';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

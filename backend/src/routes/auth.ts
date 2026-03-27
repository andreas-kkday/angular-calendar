import { Router } from 'express';
import { google } from 'googleapis';

const router = Router();

const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.RENDER_EXTERNAL_URL + "/auth/google/callback"
  );
};

router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);
    req.session!.tokens = tokens;
    res.redirect(process.env.RENDER_EXTERNAL_URL || 'http://localhost:4200');
  } catch (error) {
    console.error('Error in google callback:', error);
    res.redirect(`${process.env.RENDER_EXTERNAL_URL}?error=auth_failed`);
  }
});

router.get('/status', (req, res) => {
  if (req.session && req.session.tokens) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

export default router;

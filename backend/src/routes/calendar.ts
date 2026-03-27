import { Router } from 'express';
import { google } from 'googleapis';
import ical from 'ical-generator';
import crypto from 'crypto';

const router = Router();

// Encryption helpers
const ENCRYPTION_KEY = process.env.SESSION_SECRET
  ? crypto.scryptSync(process.env.SESSION_SECRET, 'salt', 32)
  : crypto.scryptSync('secret', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Middleware to check authentication and initialize calendar client
router.use((req, res, next) => {
  // Allow stateless access to the iCal feed if token is provided
  if (req.path === '/ical' && req.query.t) {
    return next();
  }

  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.FRONTEND_URL + "/auth/google/callback"
  );
  oauth2Client.setCredentials(req.session.tokens);

  // Attach calendar client to request
  (req as any).calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  next();
});

// Get upcoming events
router.get('/events', async (req, res) => {
  try {
    const calendar = (req as any).calendar;
    // Get events for the current year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfYear,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Endpoint to generate the subscribeable iCal link
router.get('/ical-link', (req, res) => {
  const tokensString = JSON.stringify(req.session!.tokens);
  const token = encrypt(tokensString);
  const url = `${req.protocol}://${req.get('host')}/api/calendar/ical?t=${encodeURIComponent(token)}`;
  res.json({ url });
});

// Export events as iCal
router.get('/ical', async (req, res) => {
  try {
    let calendarAuth;
    if (req.query.t) {
      const tokens = JSON.parse(decrypt(req.query.t as string));
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.FRONTEND_URL + "/auth/google/callback"
      );
      oauth2Client.setCredentials(tokens);
      calendarAuth = google.calendar({ version: 'v3', auth: oauth2Client });
    } else {
      calendarAuth = (req as any).calendar;
    }
    // Get events for the current year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const response = await calendarAuth.events.list({
      calendarId: 'primary',
      timeMin: startOfYear,
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const cal = ical({ name: 'My Google Calendar' });

    const items = response.data.items || [];
    for (const item of items) {
      if (!item.start || !item.end) continue;

      cal.createEvent({
        start: new Date(item.start.dateTime || item.start.date!),
        end: new Date(item.end.dateTime || item.end.date!),
        summary: item.summary || 'Untitled Event',
        description: item.description || '',
      });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
    res.send(cal.toString());
  } catch (error) {
    console.error('Error exporting iCal:', error);
    res.status(500).json({ error: 'Failed to export iCal calendar' });
  }
});

// Add a random event in the current year
router.post('/events', async (req, res) => {
  try {
    const calendar = (req as any).calendar;

    // Generate random date within the current year
    const currentYear = new Date().getFullYear();
    const start = new Date(currentYear, 0, 1).getTime();
    const end = new Date(currentYear, 11, 31).getTime();
    const randomTime = start + Math.random() * (end - start);
    const eventStart = new Date(randomTime);

    // Event lasts for 1 hour
    const eventEnd = new Date(randomTime + 60 * 60 * 1000);

    const appId = `APP-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 10000)}`;

    const randomUrl = `https://picsum.photos/seed/${appId}/300/300`;
    const event = {
      summary: `Random Event ${Math.floor(Math.random() * 1000)}`,
      description: `An event automatically generated by the Calendar App.\n\nMore info: ${randomUrl}`,
      extendedProperties: {
        private: { appId }
      },
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 3 * 60 },
          { method: 'popup', minutes: 3 * 60 },
          { method: 'email', minutes: 6 * 60 },
          { method: 'popup', minutes: 6 * 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update an event's title
router.patch('/events/:appId', async (req, res) => {
  try {
    const calendar = (req as any).calendar;
    const { appId } = req.params;
    const { summary } = req.body;

    if (!summary) return res.status(400).json({ error: 'Summary is required' });

    // Find the event by our custom appId
    const searchResponse = await calendar.events.list({
      calendarId: 'primary',
      privateExtendedProperty: [`appId=${appId}`]
    });

    const items = searchResponse.data.items;
    let googleEventId = appId; // Fallback if no match
    if (items && items.length > 0) {
      googleEventId = items[0].id; // Extract inner Google ID
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: { summary }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete an event
router.delete('/events/:appId', async (req, res) => {
  try {
    const calendar = (req as any).calendar;
    const { appId } = req.params;

    // First search for the event matching our custom appId
    const searchResponse = await calendar.events.list({
      calendarId: 'primary',
      privateExtendedProperty: [`appId=${appId}`]
    });

    const items = searchResponse.data.items;
    let googleEventId = appId; // Fallback to raw ID
    if (items && items.length > 0) {
      googleEventId = items[0].id;
    }

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;

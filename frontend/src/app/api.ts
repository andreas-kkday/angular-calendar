import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: {
    private?: {
      appId?: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class Api {
  private apiUrl = '';

  constructor(private http: HttpClient) {}

  checkAuthStatus(): Observable<{ authenticated: boolean }> {
    return this.http.get<{ authenticated: boolean }>(`${this.apiUrl}/auth/status`, { withCredentials: true });
  }

  getEvents(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(`${this.apiUrl}/api/calendar/events`, { withCredentials: true });
  }

  addRandomEvent(): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(`${this.apiUrl}/api/calendar/events`, {}, { withCredentials: true });
  }

  deleteEvent(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/api/calendar/events/${id}`, { withCredentials: true });
  }

  updateEvent(appId: string, summary: string): Observable<CalendarEvent> {
    return this.http.patch<CalendarEvent>(`${this.apiUrl}/api/calendar/events/${appId}`, { summary }, { withCredentials: true });
  }

  logout(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  getAuthUrl(): string {
    return `${this.apiUrl}/auth/google`;
  }

  getSubscribeLink(): Observable<{url: string}> {
    return this.http.get<{url: string}>(`${this.apiUrl}/api/calendar/ical-link`, {
      withCredentials: true
    });
  }
}

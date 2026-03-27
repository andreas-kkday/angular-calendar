import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Api, CalendarEvent } from './api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  isAuthenticated = false;
  events: CalendarEvent[] = [];
  loading = true;
  actionLoading = false;
  subscribeUrl: string | null = null;

  constructor(public api: Api, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.checkAuth();
  }

  checkAuth(): void {
    this.api.checkAuthStatus().subscribe({
      next: (res) => {
        this.isAuthenticated = res.authenticated;
        this.loading = false;
        this.cdr.detectChanges();
        if (this.isAuthenticated) {
          this.loadEvents();
        }
      },
      error: () => {
        this.isAuthenticated = false;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  login(): void {
    window.location.href = this.api.getAuthUrl();
  }

  logout(): void {
    this.api.logout().subscribe(() => {
      this.isAuthenticated = false;
      this.events = [];
      this.cdr.detectChanges();
    });
  }

  loadEvents(): void {
    this.api.getEvents().subscribe((events) => {
      this.events = events || [];
      this.cdr.detectChanges();
    });
  }

  addRandomEvent(): void {
    this.actionLoading = true;
    this.api.addRandomEvent().subscribe({
      next: (newEvent) => {
        this.events.push(newEvent);
        // Sort events by start date
        this.events.sort((a, b) => {
          const aTime = new Date(a.start.dateTime || a.start.date || 0).getTime();
          const bTime = new Date(b.start.dateTime || b.start.date || 0).getTime();
          return aTime - bTime;
        });
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteEvent(event: CalendarEvent): void {
    const appId = event.extendedProperties?.private?.appId || event.id;
    this.actionLoading = true;
    this.api.deleteEvent(appId).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== event.id);
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  editEvent(event: CalendarEvent): void {
    const appId = event.extendedProperties?.private?.appId || event.id;
    const newTitle = window.prompt('Enter new title for this event:', event.summary);
    if (!newTitle || newTitle === event.summary) return;

    this.actionLoading = true;
    this.api.updateEvent(appId, newTitle).subscribe({
      next: (updatedEvent) => {
        const index = this.events.findIndex(e => e.id === event.id);
        if (index !== -1) {
          this.events[index] = updatedEvent;
        }
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  generateSubscribeLink(): void {
    this.actionLoading = true;
    this.api.getSubscribeLink().subscribe({
      next: (res) => {
        this.subscribeUrl = res.url;
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error generating link', err);
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!');
    });
  }

  formatDate(dateObj: { date?: string; dateTime?: string }): string {
    if (!dateObj) return '';
    if (dateObj.dateTime) {
      const d = new Date(dateObj.dateTime);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (dateObj.date) {
      const d = new Date(dateObj.date);
      // All day events only provide the date string (e.g., '2024-03-25')
      // Note: Because it's interpreted as UTC midnight, toLocaleDateString might shift by a day depending on timezone
      // Adding a time to ensure it parses correctly or just stripping it
      d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Shift back to local to avoid day skip
      return `All Day (${d.toLocaleDateString()})`;
    }
    return '';
  }
}

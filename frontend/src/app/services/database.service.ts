import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private apiUrl = 'http://localhost:3000'; // URL del backend
  constructor(private http: HttpClient) {}
  
  getUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`);
  }
}
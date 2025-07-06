export interface ScraperEvent {
    type: 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    message: string;
    error?: string;
    result?: any;
}

export interface TaskStatus {
    id: string;
    status: ScraperEvent['type'];
    progress: number;
    message: string;
    error?: string;
    result?: any;
    updatedAt: string;
} 
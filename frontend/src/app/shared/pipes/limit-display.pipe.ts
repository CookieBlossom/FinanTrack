import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'limitDisplay',
  standalone: true
})
export class LimitDisplayPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0';
    if (value === -1) return 'Ilimitado';
    return value.toString();
  }
} 
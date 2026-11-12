import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha civil legible en la zona del navegador: «10 nov 2026, 09:42» o, en corto, «11 nov». */
@Pipe({ name: 'requestDate' })
export class RequestDatePipe implements PipeTransform {
  transform(value: string | null | undefined, format: 'long' | 'short' = 'long'): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
    if (format === 'short') {
      return day;
    }
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return `${day} ${date.getFullYear()}, ${time}`;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

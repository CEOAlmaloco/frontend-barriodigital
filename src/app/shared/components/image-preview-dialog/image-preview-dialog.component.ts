import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export interface ImagePreviewData {
  title: string;
  /** URL temporal (blob:) que administra quien abre el diálogo. */
  url: string;
  alt: string;
  /** Contexto bajo el título, como el autor y la fecha. */
  caption?: string;
  /** Sin nombre no se ofrece la descarga. */
  downloadName?: string;
}

/** Imagen a tamaño completo: la evidencia del alta, la de un comentario o la que se está por adjuntar. */
@Component({
  selector: 'app-image-preview-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatIcon],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="image-preview">
      @if (data.caption) {
        <p class="image-preview__caption">{{ data.caption }}</p>
      }
      <div class="image-preview__frame">
        <img [src]="data.url" [alt]="data.alt" />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.downloadName) {
        <a matButton [href]="data.url" [download]="data.downloadName">
          <mat-icon aria-hidden="true">download</mat-icon>
          Descargar
        </a>
      }
      <button matButton="filled" type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styleUrl: './image-preview-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagePreviewDialogComponent {
  protected readonly data = inject<ImagePreviewData>(MAT_DIALOG_DATA);
}

export function openImagePreview(
  dialog: MatDialog,
  data: ImagePreviewData,
): MatDialogRef<ImagePreviewDialogComponent, void> {
  return dialog.open<ImagePreviewDialogComponent, ImagePreviewData, void>(
    ImagePreviewDialogComponent,
    {
      data,
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      width: '56rem',
      maxWidth: 'calc(100vw - 2rem)',
    },
  );
}

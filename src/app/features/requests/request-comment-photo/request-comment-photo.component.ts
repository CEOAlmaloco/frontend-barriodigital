import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { openImagePreview } from '../../../shared/components/image-preview-dialog/image-preview-dialog.component';
import { RequestsService } from '../requests.service';

type PhotoState = 'idle' | 'loading' | 'ready' | 'error';

/** Margen para pedir la foto un poco antes de que aparezca al desplazarse. */
const VIEWPORT_MARGIN = '200px';

/**
 * Foto de un comentario del historial. Se pide al acercarse a la pantalla: un trámite puede tener hasta 20 de
 * hasta 5 MB (EP3-64, sección 9).
 */
@Component({
  selector: 'app-request-comment-photo',
  imports: [MatButton, MatIcon],
  templateUrl: './request-comment-photo.component.html',
  styleUrl: './request-comment-photo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestCommentPhotoComponent {
  readonly requestId = input.required<string>();
  readonly commentId = input.required<string>();
  /** Quién y cuándo, para el nombre del botón y el diálogo. */
  readonly context = input.required<string>();

  private readonly requests = inject(RequestsService);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: IntersectionObserver | null = null;
  private loading: Subscription | null = null;
  private previewDialog: MatDialogRef<unknown, void> | null = null;
  private extension = 'png';

  protected readonly state = signal<PhotoState>('idle');
  protected readonly url = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.load();
        return;
      }
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.stopObserving();
            this.load();
          }
        },
        { rootMargin: VIEWPORT_MARGIN },
      );
      this.observer.observe(this.host.nativeElement);
    });

    inject(DestroyRef).onDestroy(() => {
      this.stopObserving();
      this.loading?.unsubscribe();
      this.previewDialog?.close();
      this.revoke();
    });
  }

  protected load(): void {
    this.loading?.unsubscribe();
    this.state.set('loading');
    this.loading = this.requests
      .getCommentAttachment(this.requestId(), this.commentId())
      .subscribe({
        next: (image) => {
          if (image.type !== 'image/jpeg' && image.type !== 'image/png') {
            this.state.set('error');
            return;
          }
          this.revoke();
          this.extension = image.type === 'image/jpeg' ? 'jpg' : 'png';
          this.url.set(URL.createObjectURL(image));
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  protected openPreview(): void {
    const url = this.url();
    if (!url || this.previewDialog) {
      return;
    }
    this.previewDialog = openImagePreview(this.dialog, {
      title: 'Foto del comentario',
      caption: this.context(),
      url,
      alt: `Foto del comentario, ${this.context()}`,
      downloadName: `comentario.${this.extension}`,
    });
    this.previewDialog.afterClosed().subscribe(() => (this.previewDialog = null));
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private revoke(): void {
    const url = this.url();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.url.set(null);
  }
}

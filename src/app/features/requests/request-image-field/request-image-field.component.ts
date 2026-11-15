import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { formatFileSize } from '../../../shared/utils/file-size';
import { ACCEPTED_IMAGE_TYPES } from '../requests.constants';

type ImagePreview = { url: string; name: string };

let nextId = 0;

/**
 * Selector de una imagen con la advertencia de privacidad y vista previa. Solo presenta: la validación y el
 * procesamiento quedan en quien lo usa, que devuelve el archivo aceptado, el progreso o el error.
 */
@Component({
  selector: 'app-request-image-field',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './request-image-field.component.html',
  styleUrl: './request-image-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestImageFieldComponent {
  readonly file = input<File | null>(null);
  readonly processing = input(false);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);

  readonly fileSelected = output<File>();
  readonly removed = output<void>();

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private readonly chooseButton = viewChild('choose', { read: ElementRef });
  private readonly changeButton = viewChild('change', { read: ElementRef });
  private readonly previewTemplate =
    viewChild.required<TemplateRef<{ $implicit: ImagePreview }>>('preview');
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private previewDialog: MatDialogRef<unknown> | null = null;
  /** El botón que abrió el selector puede desaparecer al cambiar de estado; el foco vuelve al control vigente. */
  private readonly focusPending = signal(false);

  protected readonly hintId = `image-field-hint-${nextId}`;
  protected readonly cautionId = `image-field-caution-${nextId}`;
  protected readonly errorId = `image-field-error-${nextId++}`;
  protected readonly accept = ACCEPTED_IMAGE_TYPES.join(',');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly fileSize = computed(() => {
    const file = this.file();
    return file ? formatFileSize(file.size) : '';
  });
  protected readonly describedBy = computed(() =>
    [this.hintId, this.cautionId, this.error() ? this.errorId : null].filter(Boolean).join(' '),
  );

  constructor() {
    effect((onCleanup) => {
      const file = this.file();
      if (!file) {
        this.previewUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(file);
      this.previewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });

    effect(() => {
      if (!this.focusPending() || this.processing()) {
        return;
      }
      this.file();
      this.error();
      this.focusPending.set(false);
      afterNextRender(() => this.focusCurrentControl(), { injector: this.injector });
    });

    // La vista ampliada usa la misma URL temporal, que se revoca al destruir el componente
    inject(DestroyRef).onDestroy(() => this.previewDialog?.close());
  }

  /** Mismo diálogo que la imagen del detalle; al cerrarse, el foco vuelve a la miniatura. */
  protected openPreview(): void {
    const url = this.previewUrl();
    const file = this.file();
    if (!url || !file || this.previewDialog) {
      return;
    }
    this.previewDialog = this.dialog.open(this.previewTemplate(), {
      data: { url, name: file.name } satisfies ImagePreview,
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      width: '56rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.previewDialog.afterClosed().subscribe(() => (this.previewDialog = null));
  }

  protected openPicker(): void {
    this.picker().nativeElement.click();
  }

  protected pick(): void {
    const input = this.picker().nativeElement;
    const file = input.files?.[0];
    // Permite volver a elegir el mismo archivo después de quitarlo
    input.value = '';
    if (file) {
      this.focusPending.set(true);
      this.fileSelected.emit(file);
    }
  }

  protected remove(): void {
    this.focusPending.set(true);
    this.removed.emit();
  }

  private focusCurrentControl(): void {
    const target = this.changeButton() ?? this.chooseButton();
    (target?.nativeElement as HTMLElement | undefined)?.focus();
  }
}

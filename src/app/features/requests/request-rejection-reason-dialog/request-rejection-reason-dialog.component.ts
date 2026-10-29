import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

import { Request } from '../../../shared/models/request.model';
import { locationSummary, mapUrl } from '../request-location';

export interface RequestRejectionReasonDialogData {
  request: Request;
  procedureTypeLabel: string;
}

@Component({
  selector: 'app-request-rejection-reason-dialog',
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  templateUrl: './request-rejection-reason-dialog.component.html',
  styleUrl: './request-rejection-reason-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestRejectionReasonDialogComponent {
  protected readonly data = inject<RequestRejectionReasonDialogData>(MAT_DIALOG_DATA);
  protected readonly locationSummary = locationSummary;
  protected readonly mapUrl = mapUrl;
}

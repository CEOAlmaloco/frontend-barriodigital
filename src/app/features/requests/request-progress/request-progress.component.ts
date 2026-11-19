import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { RequestStatus } from '../../../shared/models/request.model';
import { RequestDatePipe } from '../request-date.pipe';
import { REQUEST_FLOW, REQUEST_STATUS_VIEW } from '../requests.constants';

export interface RequestStage {
  estado: RequestStatus;
  desde: string;
}

type StepState = 'done' | 'current' | 'stopped' | 'pending';

interface Step {
  status: RequestStatus;
  label: string;
  state: StepState;
  since: string | null;
}

const STATE_TEXT: Record<StepState, string> = {
  done: 'completado',
  current: 'estado actual',
  stopped: 'estado final',
  pending: 'pendiente',
};

@Component({
  selector: 'app-request-progress',
  imports: [MatIcon, RequestDatePipe],
  templateUrl: './request-progress.component.html',
  styleUrl: './request-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestProgressComponent {
  readonly status = input.required<RequestStatus>();
  /** Etapas de /actividad. Sin ellas el avance se arma solo con el estado actual. */
  readonly stages = input<readonly RequestStage[]>([]);

  protected readonly stateText = STATE_TEXT;

  protected readonly steps = computed<Step[]>(() => {
    const status = this.status();
    const since = new Map(this.stages().map((stage) => [stage.estado, stage.desde]));
    const step = (value: RequestStatus, state: StepState): Step => ({
      status: value,
      label: REQUEST_STATUS_VIEW[value].label,
      state,
      since: since.get(value) ?? null,
    });

    const position = REQUEST_FLOW.indexOf(status);
    if (position >= 0) {
      return REQUEST_FLOW.map((value, index) =>
        step(
          value,
          index < position || status === 'RESUELTO'
            ? 'done'
            : index === position
              ? 'current'
              : 'pending',
        ),
      );
    }

    const reached = this.stages()
      .map((stage) => REQUEST_FLOW.indexOf(stage.estado))
      .filter((index) => index >= 0);
    const last = reached.length ? Math.max(...reached) : 0;
    return [
      ...REQUEST_FLOW.slice(0, last + 1).map((value) => step(value, 'done')),
      step(status, 'stopped'),
    ];
  });
}

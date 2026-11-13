import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { Page } from '../../../shared/models/page.model';
import { Request } from '../../../shared/models/request.model';
import { loadedResource } from '../../../shared/utils/loaded-resource';
import { formatCount } from '../../reports/report-format';
import { NEW_REQUEST_FRAGMENT } from '../../requests/requests.constants';
import { RequestsService } from '../../requests/requests.service';
import { HOME_PAGE_SIZE } from '../home.constants';
import { BlockView, blockView, readyData } from '../home-block-view';
import { HomeBlockComponent } from '../home-block/home-block.component';
import { HomeRequestListComponent } from '../home-request-list/home-request-list.component';
import { HomeStateComponent } from '../home-state/home-state.component';

interface Stat {
  label: string;
  icon: string;
  open: 'true' | 'false';
  status: BlockView<unknown>['status'];
  value: string;
}

/**
 * Inicio del Vecino: ingresar un trámite y seguir los suyos. requests ya le devuelve solo los propios. El total de
 * abiertos sale de la misma consulta de los recientes, y el de cerrados de una con `size=1` (EP3-04, sección 7).
 */
@Component({
  selector: 'app-home-vecino',
  imports: [
    HomeBlockComponent,
    HomeRequestListComponent,
    HomeStateComponent,
    MatButton,
    MatIcon,
    RouterLink,
  ],
  templateUrl: './home-vecino.component.html',
  styleUrls: ['./home-vecino.component.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeVecinoComponent {
  private readonly requestsService = inject(RequestsService);

  protected readonly newRequestFragment = NEW_REQUEST_FRAGMENT;
  protected readonly recent = loadedResource<number, Page<Request>>({
    key: 0,
    load: () => this.requestsService.getRequests({ open: 'true', size: String(HOME_PAGE_SIZE) }),
  });
  private readonly closed = loadedResource<number, Page<Request>>({
    key: 0,
    load: () => this.requestsService.getRequests({ open: 'false', size: '1' }),
  });

  protected readonly recentView = computed(() => blockView(this.recent.state(), this.recent.key()));
  private readonly closedView = computed(() => blockView(this.closed.state(), this.closed.key()));
  protected readonly openPage = computed(() => readyData(this.recentView()));
  /** Sin trámites de ningún tipo: solo se afirma cuando las dos consultas respondieron. */
  protected readonly firstTime = computed(
    () => this.openPage()?.totalElements === 0 && readyData(this.closedView())?.totalElements === 0,
  );
  protected readonly stats = computed<Stat[]>(() => [
    stat('Abiertos', 'pending_actions', 'true', this.recentView()),
    stat('Cerrados', 'task_alt', 'false', this.closedView()),
  ]);

  constructor() {
    this.recent.setKey(0);
    this.closed.setKey(0);
  }

  /** Los conteos resumen la misma fuente que la lista: se actualizan juntos. */
  protected refresh(): void {
    this.recent.refresh();
    this.closed.refresh();
  }
}

function stat(
  label: string,
  icon: string,
  open: Stat['open'],
  view: BlockView<Page<Request>>,
): Stat {
  return {
    label,
    icon,
    open,
    status: view.status,
    value: view.status === 'ready' ? formatCount(view.data.totalElements) : '',
  };
}

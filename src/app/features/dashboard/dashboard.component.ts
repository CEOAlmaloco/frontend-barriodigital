import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../shared/models/role';
import { REQUEST_STATUSES, REQUEST_STATUS_VIEW, TIPOS_TRAMITE_PROVISIONAL } from '../requests/requests.constants';

/** Inicio según el claim roles del access token (EP1-07). El BFF es quien autoriza de verdad. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);

  protected readonly tiposTramite = TIPOS_TRAMITE_PROVISIONAL;
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly statusView = REQUEST_STATUS_VIEW;

  protected readonly accountName = computed(() => {
    const account = this.auth.account();
    return account?.name ?? account?.username ?? '';
  });

  /** Vacío mientras el access token todavía no llegó. */
  protected readonly rolesLabel = computed(() => this.auth.roles().join(', '));

  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));
  protected readonly isFuncionario = computed(() => this.auth.hasRole(Role.Funcionario));
  protected readonly isVecino = computed(() => this.auth.hasRole(Role.Vecino));
  protected readonly isAuditor = computed(() => this.auth.hasRole(Role.Auditor));
}

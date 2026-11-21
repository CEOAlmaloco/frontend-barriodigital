import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  KafkaDltMessages,
  KafkaGroupDetail,
  KafkaGroupSummary,
  KafkaReplayRequest,
  KafkaReplayResponse,
  KafkaResetOffsetsRequest,
  KafkaResetOffsetsResponse,
  KafkaTopicDetail,
  KafkaTopicSummary,
} from './kafka-admin.models';

/** Administración de Kafka a través del BFF (solo Admin). */
@Injectable({ providedIn: 'root' })
export class KafkaAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.bffBaseUrl}/api/kafka`;

  listTopics(): Observable<KafkaTopicSummary[]> {
    return this.http.get<KafkaTopicSummary[]>(`${this.base}/topics`);
  }

  getTopic(name: string): Observable<KafkaTopicDetail> {
    return this.http.get<KafkaTopicDetail>(`${this.base}/topics/${encodeURIComponent(name)}`);
  }

  deleteTopic(name: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/topics/${encodeURIComponent(name)}`);
  }

  listConsumerGroups(): Observable<KafkaGroupSummary[]> {
    return this.http.get<KafkaGroupSummary[]>(`${this.base}/consumer-groups`);
  }

  getConsumerGroup(groupId: string): Observable<KafkaGroupDetail> {
    return this.http.get<KafkaGroupDetail>(
      `${this.base}/consumer-groups/${encodeURIComponent(groupId)}`,
    );
  }

  resetOffsets(
    groupId: string,
    body: KafkaResetOffsetsRequest,
  ): Observable<KafkaResetOffsetsResponse> {
    return this.http.post<KafkaResetOffsetsResponse>(
      `${this.base}/consumer-groups/${encodeURIComponent(groupId)}/offsets/reset`,
      body,
    );
  }

  listDltMessages(
    name: string,
    options: { partition?: number; fromOffset?: number; limit?: number } = {},
  ): Observable<KafkaDltMessages> {
    let params = new HttpParams();
    if (options.partition !== undefined) {
      params = params.set('partition', String(options.partition));
    }
    if (options.fromOffset !== undefined) {
      params = params.set('fromOffset', String(options.fromOffset));
    }
    if (options.limit !== undefined) {
      params = params.set('limit', String(options.limit));
    }
    return this.http.get<KafkaDltMessages>(
      `${this.base}/dlt/${encodeURIComponent(name)}/messages`,
      { params },
    );
  }

  replayDlt(name: string, body: KafkaReplayRequest): Observable<KafkaReplayResponse> {
    return this.http.post<KafkaReplayResponse>(
      `${this.base}/dlt/${encodeURIComponent(name)}/replay`,
      body,
    );
  }
}

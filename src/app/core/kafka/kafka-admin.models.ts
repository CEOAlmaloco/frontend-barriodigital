export interface KafkaTopicSummary {
  name: string;
  partitions: number;
  replicationFactor: number;
  system: boolean;
}

export interface KafkaGroupSummary {
  groupId: string;
  state: string;
  members: number;
  system: boolean;
}

export interface KafkaPartitionLag {
  partition: number;
  committedOffset: number | null;
  endOffset: number;
  lag: number | null;
  lagBasis: string | null;
}

export interface KafkaGroupTopicLag {
  topic: string;
  partitions: KafkaPartitionLag[];
}

export interface KafkaGroupMember {
  memberId: string;
  clientId: string;
  host: string;
}

export interface KafkaGroupDetail {
  groupId: string;
  state: string;
  members: number;
  system: boolean;
  memberDetails?: KafkaGroupMember[];
  topics: KafkaGroupTopicLag[];
}

export interface KafkaTopicPartition {
  partition: number;
  leader: number | null;
  replicas: number[];
  isr: number[];
}

export interface KafkaTopicConfig {
  name: string;
  value: string;
  source: string;
  editable: boolean;
}

export interface KafkaTopicDetail {
  name: string;
  system: boolean;
  partitions: KafkaTopicPartition[];
  configs: KafkaTopicConfig[];
}

export interface KafkaDltMessage {
  partition: number;
  offset: number;
  key: string | null;
  receivedAt: string | null;
  eventId: string | null;
  eventType: string | null;
  value: string | null;
  originalTopic: string | null;
  originalPartition: number | null;
  originalOffset: number | null;
  originalTimestamp: string | null;
  consumerGroup: string | null;
  exceptionClass: string | null;
  exceptionCause: string | null;
  exceptionMessage: string | null;
}

export interface KafkaDltPartition {
  partition: number;
  nextOffset: number | null;
  messages: KafkaDltMessage[];
}

export interface KafkaDltMessages {
  dlt: string;
  partitions: KafkaDltPartition[];
}

export interface KafkaResetOffsetsRequest {
  topic: string;
  strategy: 'EARLIEST' | 'LATEST' | 'TIMESTAMP';
  timestamp?: string;
  dryRun: boolean;
}

export interface KafkaReplayRequest {
  offsets?: { partition: number; offset: number }[];
  eventIds?: string[];
}

export interface KafkaReplayResponse {
  dlt: string;
  targetTopic: string;
  resent: number;
  skipped: number;
  failed: number;
  notAttempted: number;
}

export interface KafkaResetOffsetsPartition {
  partition: number;
  currentOffset: number | null;
  targetOffset: number;
  lagAfter: number;
}

export interface KafkaResetOffsetsResponse {
  groupId: string;
  topic: string;
  strategy: KafkaResetOffsetsRequest['strategy'];
  dryRun: boolean;
  partitions: KafkaResetOffsetsPartition[];
}

/** Retraso conocido del grupo. Un `lag` null es una partición sin offset: no se cuenta como 0. */
export interface KafkaGroupLag {
  known: number;
  unknownPartitions: number;
  partitions: number;
}

export function groupLag(detail: KafkaGroupDetail): KafkaGroupLag {
  const parts = detail.topics.flatMap((topic) => topic.partitions);
  return {
    known: parts.reduce((sum, part) => sum + (part.lag ?? 0), 0),
    unknownPartitions: parts.filter((part) => part.lag === null).length,
    partitions: parts.length,
  };
}

export function flattenDltMessages(view: KafkaDltMessages): KafkaDltMessage[] {
  return view.partitions.flatMap((part) => part.messages);
}

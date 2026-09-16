import type { Database } from '@/types/database';

export type PushTemplateMode = 'manual' | 'scheduled';
export type PushTemplateStatus = 'draft' | 'scheduled' | 'canceled';

export type PushTemplateUpdate =
  Database['public']['Tables']['push_templates']['Update'];

export type AdminPushTemplate = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  mode: PushTemplateMode;
  scheduledAt: string | null;
  status: PushTemplateStatus;
  lastSentAt: string | null;
  sendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PushTemplateRow = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  mode: string;
  scheduled_at: string | null;
  status: string;
  last_sent_at: string | null;
  send_count: number;
  created_at: string;
  updated_at: string;
};

export function mapPushTemplate(row: PushTemplateRow): AdminPushTemplate {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    mode: row.mode as PushTemplateMode,
    scheduledAt: row.scheduled_at,
    status: row.status as PushTemplateStatus,
    lastSentAt: row.last_sent_at,
    sendCount: row.send_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const PUSH_TEMPLATE_SELECT =
  'id, title, body, url, mode, scheduled_at, status, last_sent_at, send_count, created_at, updated_at';

export type AdminPushTemplateSend = {
  id: string;
  templateId: string;
  triggeredBy: 'manual' | 'scheduled';
  sentAt: string;
  customers: number;
  devices: number;
  sent: number;
  failed: number;
  revoked: number;
};

export type PushTemplateSendRow = {
  id: string;
  template_id: string;
  triggered_by: string;
  sent_at: string;
  customers: number;
  devices: number;
  sent: number;
  failed: number;
  revoked: number;
};

export function mapPushTemplateSend(
  row: PushTemplateSendRow,
): AdminPushTemplateSend {
  return {
    id: row.id,
    templateId: row.template_id,
    triggeredBy: row.triggered_by as 'manual' | 'scheduled',
    sentAt: row.sent_at,
    customers: row.customers,
    devices: row.devices,
    sent: row.sent,
    failed: row.failed,
    revoked: row.revoked,
  };
}

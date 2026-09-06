export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
};

export type StoredPushSubscription = {
  id: string;
  customerId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

import {
  getAppEnv,
  getTwilioOtpServiceSid,
  hasTwilioVerifyConfig,
} from '@/config/env';
import { err, ok, type Result } from '@/lib/errors';
import { startTwilioVerification } from '@/modules/notifications/twilio-verify';

export type OtpDeliveryChannel = 'sms' | 'debug';

export async function deliverCustomerOtp(
  phoneE164: string,
): Promise<Result<{ deliveredVia: OtpDeliveryChannel; serviceSid?: string }>> {
  if (hasTwilioVerifyConfig()) {
    const sms = await startTwilioVerification(
      phoneE164,
      'sms',
      getTwilioOtpServiceSid(),
    );
    if (!sms.ok) return sms;
    return ok({ deliveredVia: 'sms', serviceSid: sms.data.serviceSid });
  }

  if (getAppEnv() === 'production') {
    return err(
      'INTEGRATION_UNAVAILABLE',
      'Envio de código ainda não está configurado.',
    );
  }

  return ok({ deliveredVia: 'debug' });
}

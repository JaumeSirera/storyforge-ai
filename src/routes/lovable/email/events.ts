import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'

const LOG_STATUS: Record<SuppressionReason, string> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const LOG_MESSAGE: Record<SuppressionReason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

/**
 * Notification-only bookkeeping: keeps the project's own email history and
 * opt-out view up to date. Lovable enforces suppression at send time; these
 * rows never gate a send.
 */
async function recordOutcome(
  reason: SuppressionReason,
  event: { event_id: string; data: { recipient: string; message_id?: string | null } },
) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const email = event.data.recipient.toLowerCase()

  const { error: suppressError } = await supabaseAdmin
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null } as any, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: event.event_id,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: insertError } = await supabaseAdmin.from('email_send_log').insert({
    message_id: event.data.message_id ?? null,
    template_name: 'system',
    recipient_email: email,
    status: LOG_STATUS[reason],
    error_message: LOG_MESSAGE[reason],
    metadata: null,
  } as any)

  if (insertError) {
    console.warn('Failed to insert email_send_log', {
      code: insertError.code,
      message: insertError.message,
      event_id: event.event_id,
    })
  }
}

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              await recordOutcome('bounce', event as any)
            },
            'email.complaint': async (event) => {
              await recordOutcome('complaint', event as any)
            },
            'email.unsubscribed': async (event) => {
              await recordOutcome('unsubscribe', event as any)
            },
          },
        })
        return handler(request)
      },
    },
  },
})

import { eq, or, and, lt } from 'drizzle-orm'
import { type DrizzleDB } from '../../lib/db/client'
import * as schema from '../db/schema'

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface NotificationService {
  send(recipientId: string, recipientType: string, eventType: string, payload: object): Promise<void>
}

export interface OutboxWorker {
  start(): void
  stop(): void
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createOutboxWorker(
  db: DrizzleDB,
  notificationService: NotificationService,
  intervalMs: number = 5000,
): OutboxWorker {
  let timer: ReturnType<typeof setInterval> | null = null

  async function poll(): Promise<void> {
    const MAX_RETRY = 5
    const BATCH_SIZE = 50

    const pending = db
      .select()
      .from(schema.notifications)
      .where(
        or(
          eq(schema.notifications.status, 'PENDING'),
          and(
            eq(schema.notifications.status, 'FAILED'),
            lt(schema.notifications.retryCount, MAX_RETRY),
          ),
        ),
      )
      .limit(BATCH_SIZE)
      .all()

    for (const notification of pending) {
      const now = Date.now()
      try {
        await notificationService.send(
          notification.recipientId,
          notification.recipientType,
          notification.eventType,
          JSON.parse(notification.payload),
        )

        db.update(schema.notifications)
          .set({ status: 'SENT', sentAt: now, lastAttemptAt: now })
          .where(eq(schema.notifications.id, notification.id))
          .run()
      } catch {
        const nextRetryCount = notification.retryCount + 1
        const nextStatus = nextRetryCount >= MAX_RETRY ? 'FAILED' : notification.status

        db.update(schema.notifications)
          .set({
            retryCount: nextRetryCount,
            lastAttemptAt: now,
            status: nextStatus,
          })
          .where(eq(schema.notifications.id, notification.id))
          .run()
      }
    }
  }

  return {
    start(): void {
      if (timer !== null) return
      timer = setInterval(() => {
        void poll()
      }, intervalMs)
    },

    stop(): void {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}

import type { PaymentHoldStatus } from "@maxsport/shared";
import { ForbiddenError, type Pool } from "@maxsport/shared";

export interface PaymentHoldView {
  slotId: string;
  userId: string;
  lobbyId: string;
  status: PaymentHoldStatus;
  amount: number;
}

export interface PaymentService {
  listForLobby(lobbyId: string): Promise<PaymentHoldView[]>;
  collectForLobby(lobbyId: string, organizerId: string): Promise<void>;
}

export function createPaymentService(pool: Pool): PaymentService {
  return {
    async listForLobby(lobbyId) {
      const result = await pool.query(
        `SELECT slot_id, user_id, lobby_id, status, amount
         FROM payment_holds WHERE lobby_id = $1`,
        [lobbyId]
      );
      return result.rows.map((row) => ({
        slotId: row.slot_id as string,
        userId: row.user_id as string,
        lobbyId: row.lobby_id as string,
        status: row.status as PaymentHoldStatus,
        amount: Number(row.amount),
      }));
    },

    async collectForLobby(lobbyId, organizerId) {
      const check = await pool.query(
        `SELECT organizer_id FROM lobbies WHERE id = $1`,
        [lobbyId]
      );
      if (!check.rows[0] || check.rows[0].organizer_id !== organizerId) {
        throw new ForbiddenError();
      }
      await pool.query(
        `UPDATE payment_holds SET status = 'charged', updated_at = NOW()
         WHERE lobby_id = $1 AND status = 'held'`,
        [lobbyId]
      );
    },
  };
}

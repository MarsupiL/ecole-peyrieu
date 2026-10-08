/** Integration boundaries. These adapters only mutate the visitor's local demonstration. */
import type { State, Service } from './types';
import { reserve, bookingStatus, advanceClock } from './engine';
interface ReservationProvider {
  readonly mode: 'local-simulation';
  request(
    s: State,
    actor: string,
    child: string,
    service: Service,
    dates: string[],
    session: string,
  ): State;
  confirm(s: State, actor: string, id: string): State;
  requestCancellation(s: State, actor: string, id: string): State;
  confirmCancellation(s: State, actor: string, id: string): State;
}
class LocalReservationProvider implements ReservationProvider {
  readonly mode = 'local-simulation' as const;
  request = reserve;
  confirm(s: State, actor: string, id: string) {
    return bookingStatus(s, actor, id, 'confirmed');
  }
  requestCancellation(s: State, actor: string, id: string) {
    return bookingStatus(s, actor, id, 'cancellationRequested');
  }
  confirmCancellation(s: State, actor: string, id: string) {
    return bookingStatus(s, actor, id, 'cancelled');
  }
}
export interface NotificationScheduler {
  readonly mode: 'local-simulation';
  tick(s: State, actor: string, hours: number): State;
}
export const localNotifications: NotificationScheduler = {
  mode: 'local-simulation',
  tick: advanceClock,
};
export const localReservations = new LocalReservationProvider();

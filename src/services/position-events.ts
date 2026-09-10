import { Client, type Pool } from "pg";

const CHANNEL = "trip_position_updates";

export type PositionNotification = {
  tripId: string;
  positionId: number;
};

export interface PositionPublisher {
  publish(notification: PositionNotification): Promise<void>;
}

export class PostgresPositionPublisher implements PositionPublisher {
  constructor(private readonly pool: Pool) {}

  async publish(notification: PositionNotification) {
    await this.pool.query("select pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify(notification),
    ]);
  }
}

export type PositionNotificationHandler = (
  notification: PositionNotification,
) => void | Promise<void>;

export interface PositionEventSource {
  subscribe(
    tripId: string,
    handler: PositionNotificationHandler,
  ): Promise<() => void>;
}

export class PostgresPositionEventSource implements PositionEventSource {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private readonly handlers = new Map<
    string,
    Set<PositionNotificationHandler>
  >();

  constructor(private readonly connectionString: string) {}

  async subscribe(
    tripId: string,
    handler: PositionNotificationHandler,
  ): Promise<() => void> {
    const tripHandlers = this.handlers.get(tripId) ?? new Set();
    tripHandlers.add(handler);
    this.handlers.set(tripId, tripHandlers);

    try {
      await this.ensureConnected();
    } catch (error) {
      tripHandlers.delete(handler);
      throw error;
    }

    return () => {
      const handlers = this.handlers.get(tripId);
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        this.handlers.delete(tripId);
      }
    };
  }

  async close() {
    this.handlers.clear();
    const client = this.client;
    this.client = null;
    if (client) {
      await client.end();
    }
  }

  private async ensureConnected() {
    if (this.client) {
      return;
    }
    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect() {
    const client = new Client({ connectionString: this.connectionString });
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) {
        return;
      }

      try {
        const notification = JSON.parse(message.payload) as PositionNotification;
        const handlers = this.handlers.get(notification.tripId);
        for (const handler of handlers ?? []) {
          void handler(notification);
        }
      } catch {
        // Ignore malformed database notifications; persisted rows remain replayable.
      }
    });
    client.on("error", () => {
      if (this.client === client) {
        this.client = null;
      }
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    this.client = client;
  }
}

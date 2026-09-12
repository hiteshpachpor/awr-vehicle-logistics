import { Client, type Pool } from "pg";
import type { TripStatus } from "@/db/schema";

const CHANNEL = "trip_list_updates";

export type TripListUpdateType = "created" | "assigned" | "status";

export type TripListNotification = {
  tripId: string;
  vendorId: string;
  type: TripListUpdateType;
  from?: TripStatus;
  to?: TripStatus;
};

export interface TripListPublisher {
  publish(notification: TripListNotification): Promise<void>;
}

export class PostgresTripListPublisher implements TripListPublisher {
  constructor(private readonly pool: Pool) {}

  async publish(notification: TripListNotification) {
    await this.pool.query("select pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify(notification),
    ]);
  }
}

export type TripListNotificationHandler = (
  notification: TripListNotification,
) => void | Promise<void>;

export interface TripListEventSource {
  subscribe(handler: TripListNotificationHandler): Promise<() => void>;
}

export class PostgresTripListEventSource implements TripListEventSource {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private readonly handlers = new Set<TripListNotificationHandler>();

  constructor(private readonly connectionString: string) {}

  async subscribe(
    handler: TripListNotificationHandler,
  ): Promise<() => void> {
    this.handlers.add(handler);

    try {
      await this.ensureConnected();
    } catch (error) {
      this.handlers.delete(handler);
      throw error;
    }

    return () => {
      this.handlers.delete(handler);
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
        const notification = JSON.parse(message.payload) as TripListNotification;
        for (const handler of this.handlers) {
          void handler(notification);
        }
      } catch {
        // Ignore malformed database notifications; clients refetch on reconnect.
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

import { repositories } from "@/lib/repositories";
import type { PriceAlert } from "@/lib/types";

export class AlertService {
  async create(gameId: string, thresholdPrice: number): Promise<PriceAlert> {
    return repositories.alerts.create(gameId, thresholdPrice);
  }

  async checkAndNotify(): Promise<PriceAlert[]> {
    const triggered = await repositories.alerts.checkTriggered();

    for (const alert of triggered) {
      await this.sendMockNotification(alert);
    }

    return triggered;
  }

  private async sendMockNotification(alert: PriceAlert): Promise<void> {
    await repositories.diagnostics.recordIntegrationLog({
      service: "alerts",
      level: "info",
      message: `Mock notification prepared for ${alert.gameId} at threshold ${alert.thresholdPrice} PLN.`
    });
  }
}

export const alertService = new AlertService();

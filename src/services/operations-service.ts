import type { OperationsRepository } from "@/repositories/operations-repository";

export class OperationsService {
  constructor(private readonly operations: OperationsRepository) {}

  listVehicles() {
    return this.operations.listVehicles();
  }

  listDrivers() {
    return this.operations.listActiveDrivers();
  }
}

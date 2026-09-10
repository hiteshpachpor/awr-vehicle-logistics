import type { OperationsRepository } from "@/repositories/operations-repository";

export class OperationsService {
  constructor(private readonly operations: OperationsRepository) {}

  listCustomers() {
    return this.operations.listCustomers();
  }

  listVehicles(customerId?: string) {
    return this.operations.listVehicles(customerId);
  }

  listVendors() {
    return this.operations.listActiveVendors();
  }

  listDrivers(vendorId?: string) {
    return this.operations.listActiveDrivers(vendorId);
  }
}

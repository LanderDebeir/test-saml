import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const ADMIN_DATA_DIR = path.join(process.cwd(), 'config', 'admin');
const STORE_PATH = path.join(ADMIN_DATA_DIR, 'admin-store.json');
const GENERATED_CONFIG = path.join(ADMIN_DATA_DIR, 'generated-config.json');

interface StoreShape {
  services: Array<{ id: number; name: string; description?: string }>;
  assignments: Record<string, number[]>; // userId -> serviceIds
}

const defaultStore: StoreShape = {
  services: [],
  assignments: {},
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async readStore(): Promise<StoreShape> {
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as StoreShape;
    } catch (e) {
      await this.writeStore(defaultStore);
      return defaultStore;
    }
  }

  private async writeStore(store: StoreShape) {
    await fs.mkdir(ADMIN_DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  }

  async listServices() {
    const store = await this.readStore();
    return store.services;
  }

  async getServiceByName(name: string) {
    const store = await this.readStore();
    return store.services.find((service) => service.name === name) ?? null;
  }

  async getAssignedServiceIdsForUser(userId: number) {
    const store = await this.readStore();
    return store.assignments[String(userId)] ?? [];
  }

  async userHasAccessToService({
    userId,
    serviceName,
  }: {
    userId: number;
    serviceName: string;
  }) {
    const service = await this.getServiceByName(serviceName);
    if (!service) {
      return false;
    }

    const assignedServiceIds = await this.getAssignedServiceIdsForUser(userId);
    return assignedServiceIds.includes(service.id);
  }

  async addService({
    name,
    description,
  }: {
    name: string;
    description?: string;
  }) {
    const store = await this.readStore();
    const id = store.services.length
      ? store.services[store.services.length - 1].id + 1
      : 1;
    const svc = { id, name, description };
    store.services.push(svc);
    await this.writeStore(store);
    return svc;
  }

  async assignServiceToUser({
    userId,
    serviceId,
  }: {
    userId: number;
    serviceId: number;
  }) {
    const store = await this.readStore();
    const key = String(userId);
    const existing = store.assignments[key] ?? [];
    if (!existing.includes(serviceId)) existing.push(serviceId);
    store.assignments[key] = existing;
    await this.writeStore(store);
    return store.assignments;
  }

  async getAssignments() {
    const store = await this.readStore();
    return store.assignments;
  }

  async generateConfig() {
    const services = await this.listServices();
    const users = await this.prisma.user.findMany();
    const assignments = await this.getAssignments();

    const config = {
      generatedAt: new Date().toISOString(),
      services,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
      })),
      assignments,
    };

    await fs.mkdir(ADMIN_DATA_DIR, { recursive: true });
    await fs.writeFile(
      GENERATED_CONFIG,
      JSON.stringify(config, null, 2),
      'utf-8',
    );
    return config;
  }
}

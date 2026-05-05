import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const ADMIN_DATA_DIR = path.join(process.cwd(), 'config', 'admin');
const STORE_PATH = path.join(ADMIN_DATA_DIR, 'admin-store.json');
const GENERATED_CONFIG = path.join(ADMIN_DATA_DIR, 'generated-config.json');

interface ServiceAttribute {
  name: string;
  description?: string;
}

interface StoreShape {
  services: Array<{
    id: number;
    name: string;
    description?: string;
    attributes: ServiceAttribute[]; // attributes this service requires
  }>;
  assignments: Record<string, number[]>; // userId -> serviceIds
  userAttributes: Record<string, Record<string, Record<string, string>>>; // userId -> serviceId -> attributeName -> value
}

const defaultStore: StoreShape = {
  services: [],
  assignments: {},
  userAttributes: {},
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async readStore(): Promise<StoreShape> {
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf-8');
      const store = JSON.parse(raw) as StoreShape;
      // Ensure all required properties exist (handle migrations)
      if (!store.userAttributes) {
        store.userAttributes = {};
      }
      if (!store.services) {
        store.services = [];
      }
      if (!store.assignments) {
        store.assignments = {};
      }
      return store;
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
    attributes,
  }: {
    name: string;
    description?: string;
    attributes?: ServiceAttribute[];
  }) {
    const store = await this.readStore();
    const id = store.services.length
      ? store.services[store.services.length - 1].id + 1
      : 1;
    const svc = { id, name, description, attributes: attributes || [] };
    store.services.push(svc);
    await this.writeStore(store);
    this.logger.log(`Service created: id=${svc.id}, name="${svc.name}"`);
    return svc;
  }

  async addServiceAttribute({
    serviceId,
    attributeName,
    attributeDescription,
  }: {
    serviceId: number;
    attributeName: string;
    attributeDescription?: string;
  }) {
    const store = await this.readStore();
    const service = store.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }
    if (!service.attributes) service.attributes = [];
    if (!service.attributes.find((a) => a.name === attributeName)) {
      service.attributes.push({
        name: attributeName,
        description: attributeDescription,
      });
      await this.writeStore(store);
      this.logger.log(
        `Attribute added to service: serviceId=${serviceId}, attribute="${attributeName}"`,
      );
    }
    return service.attributes;
  }

  async setUserAttribute({
    userId,
    serviceId,
    attributeName,
    attributeValue,
  }: {
    userId: number;
    serviceId: number;
    attributeName: string;
    attributeValue: string;
  }) {
    const store = await this.readStore();
    const userKey = String(userId);
    const serviceKey = String(serviceId);

    if (!store.userAttributes[userKey]) {
      store.userAttributes[userKey] = {};
    }
    if (!store.userAttributes[userKey][serviceKey]) {
      store.userAttributes[userKey][serviceKey] = {};
    }

    store.userAttributes[userKey][serviceKey][attributeName] = attributeValue;
    await this.writeStore(store);
    this.logger.log(
      `User attribute set: userId=${userId}, serviceId=${serviceId}, attribute="${attributeName}"="${attributeValue}"`,
    );
  }

  async getUserAttributes(
    userId: number,
    serviceId: number,
  ): Promise<Record<string, string>> {
    const store = await this.readStore();
    const userKey = String(userId);
    const serviceKey = String(serviceId);
    return (
      store.userAttributes?.[userKey]?.[serviceKey] || {}
    );
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
    if (!existing.includes(serviceId)) {
      existing.push(serviceId);
      this.logger.log(
        `Service assigned to user: userId=${userId}, serviceId=${serviceId}`,
      );
    }
    store.assignments[key] = existing;
    await this.writeStore(store);
    return store.assignments;
  }

  async unassignServiceFromUser({
    userId,
    serviceId,
  }: {
    userId: number;
    serviceId: number;
  }) {
    const store = await this.readStore();
    const key = String(userId);
    const existing = store.assignments[key] ?? [];
    const index = existing.indexOf(serviceId);
    if (index > -1) {
      existing.splice(index, 1);
      this.logger.log(
        `Service unassigned from user: userId=${userId}, serviceId=${serviceId}`,
      );
    }
    store.assignments[key] = existing;
    await this.writeStore(store);
    return store.assignments;
  }

  async getAssignments() {
    const store = await this.readStore();
    return store.assignments;
  }

  async getAssignmentsBetween(
    userId: number,
  ): Promise<Array<{ userId: number; serviceId: number }>> {
    const store = await this.readStore();
    const assignedServiceIds = store.assignments[String(userId)] ?? [];
    return assignedServiceIds.map((serviceId) => ({ userId, serviceId }));
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

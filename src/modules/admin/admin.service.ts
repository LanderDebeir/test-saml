import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StoreShape, ServiceAttribute } from './types';

const ADMIN_DATA_DIR = path.join(process.cwd(), 'config', 'admin');
const STORE_PATH = path.join(ADMIN_DATA_DIR, 'admin-store.json');

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
      store.services = store.services.map((service) => ({
        ...service,
        attributes: (service.attributes || []).map((attribute) => ({
          name: attribute.name,
          type: this.normalizeAttributeType(
            (attribute as { type?: string; description?: string }).type ??
              (attribute as { type?: string; description?: string })
                .description,
          ),
        })),
      }));
      return store;
    } catch (e) {
      await this.writeStore(defaultStore);
      return defaultStore;
    }
  }

  private normalizeAttributeType(type?: string) {
    const normalized = (type || 'string').toLowerCase();
    if (normalized === 'integer') {
      return 'number';
    }
    return ['string', 'boolean', 'number', 'email', 'array'].includes(
      normalized,
    )
      ? normalized
      : 'string';
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
    attributeType,
  }: {
    serviceId: number;
    attributeName: string;
    attributeType?: string;
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
        type: this.normalizeAttributeType(attributeType),
      });
      await this.writeStore(store);
      this.logger.log(
        `Attribute added to service: serviceId=${serviceId}, attribute="${attributeName}"`,
      );
    }
    return service.attributes;
  }

  async updateServiceAttribute({
    serviceId,
    oldAttributeName,
    attributeName,
    attributeType,
  }: {
    serviceId: number;
    oldAttributeName: string;
    attributeName: string;
    attributeType?: string;
  }) {
    const store = await this.readStore();
    const service = store.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    if (!service.attributes) {
      service.attributes = [];
    }

    const attribute = service.attributes.find(
      (item) => item.name === oldAttributeName,
    );
    if (!attribute) {
      throw new Error(
        `Attribute "${oldAttributeName}" not found for service ${serviceId}`,
      );
    }

    const normalizedType = this.normalizeAttributeType(attributeType);
    const attributeNameChanged = oldAttributeName !== attributeName;

    attribute.name = attributeName;
    attribute.type = normalizedType;

    if (attributeNameChanged) {
      for (const userAttributesByService of Object.values(
        store.userAttributes,
      )) {
        const serviceAttributes = userAttributesByService[String(serviceId)];
        if (!serviceAttributes) {
          continue;
        }

        if (serviceAttributes[oldAttributeName] !== undefined) {
          serviceAttributes[attributeName] =
            serviceAttributes[oldAttributeName];
          delete serviceAttributes[oldAttributeName];
        }
      }
    }

    await this.writeStore(store);
    this.logger.log(
      `Attribute updated for service: serviceId=${serviceId}, oldAttribute="${oldAttributeName}", attribute="${attributeName}", type="${normalizedType}"`,
    );
    return service.attributes;
  }

  async removeServiceAttribute({
    serviceId,
    attributeName,
  }: {
    serviceId: number;
    attributeName: string;
  }) {
    const store = await this.readStore();
    const service = store.services.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const beforeCount = service.attributes?.length ?? 0;
    service.attributes = (service.attributes || []).filter(
      (attribute) => attribute.name !== attributeName,
    );

    for (const userAttributesByService of Object.values(store.userAttributes)) {
      const serviceAttributes = userAttributesByService[String(serviceId)];
      if (serviceAttributes && serviceAttributes[attributeName] !== undefined) {
        delete serviceAttributes[attributeName];
      }
    }

    if ((service.attributes?.length ?? 0) !== beforeCount) {
      await this.writeStore(store);
      this.logger.log(
        `Attribute removed from service: serviceId=${serviceId}, attribute="${attributeName}"`,
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
    return store.userAttributes?.[userKey]?.[serviceKey] || {};
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
}

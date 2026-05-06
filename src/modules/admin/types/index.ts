export interface ServiceAttribute {
  name: string;
  type: string;
}

export interface StoreShape {
  services: Array<{
    id: number;
    name: string;
    description?: string;
    attributes: ServiceAttribute[]; // attributes this service requires
  }>;
  assignments: Record<string, number[]>; // userId -> serviceIds
  userAttributes: Record<string, Record<string, Record<string, string>>>; // userId -> serviceId -> attributeName -> value
}

import { UserData } from 'src/modules/users/types/userData';

export interface XmlAttributeFields {
  [key: string]: any;
}

export type SamlRequestData = {
  samlRequest: string;
  relayState: string;
  user: UserData;
};

export type LoginRequest = {
  id: string;
  assertionConsumerServiceUrl: string;
  relayState: string;
  userData: UserData;
};

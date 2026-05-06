import { hashPassword } from 'src/utils';
import 'dotenv/config';

export const users: {
  email: string;
  displayName: string;
  password: string;
  createdAt: Date;
}[] = [
  {
    email: process.env.TEST_USER_EMAIL || '',
    displayName: process.env.TEST_USER_NAME || '',
    password: hashPassword(process.env.TEST_USER_PASSWORD || ''),
    createdAt: new Date(),
  },
];

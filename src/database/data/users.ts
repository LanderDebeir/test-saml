import { hashPassword } from 'src/utils';
import 'dotenv/config';

export const users: {
  id: number;
  email: string;
  displayName: string;
  password: string;
  imageUrl: string;
  createdAt: Date;
}[] = [
  {
    id: 1234,
    email: process.env.TEST_USER_EMAIL || '',
    displayName: process.env.TEST_USER_NAME || '',
    password: hashPassword(process.env.TEST_USER_PASSWORD || ''),
    imageUrl: process.env.TEST_USER_PFP || '',
    createdAt: new Date(),
  },
];

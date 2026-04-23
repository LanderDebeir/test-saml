import { hashPassword } from 'src/utils';

export const users: { email: string; password: string; createdAt: Date }[] = [
  {
    email: 'lander.debeir@jimber.io',
    password: hashPassword('password123'),
    createdAt: new Date(),
  },
];

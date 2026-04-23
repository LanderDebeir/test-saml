import { hashPassword } from 'src/utils';

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
    email: 'lander.debeir@jimber.io',
    displayName: 'Lander Debeir',
    password: hashPassword('password123'),
    imageUrl: 'https://www.pngmart.com/files/23/Profile-PNG-Photo.png',
    createdAt: new Date(),
  },
];

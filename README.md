# Saml Test

a repository for testing out creating a SAML identity provider using nestjs.

## Project setup

```bash
#install dependencies
$ npm install

#run docker containers
$ docker compose -f ./config/docker/docker-compose.yml up -d

#set up database
$ npx prisma migrate dev

#seed database
$ npm run seed 
```

## Compile and run the project

```bash
# watch mode
$ npm run dev

# production mode
$ npm run prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## License

[MIT license](./LICENSE).

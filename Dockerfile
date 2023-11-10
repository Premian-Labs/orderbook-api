FROM node:18-slim

COPY . ./

RUN yarn install --production && yarn cache clean

EXPOSE 3000

RUN yarn run build
CMD ["yarn", "run", "start"]
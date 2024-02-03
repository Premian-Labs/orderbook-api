FROM node:18-slim

COPY . ./

RUN yarn install --production && yarn cache clean

RUN yarn run build
CMD ["yarn", "run", "start"]
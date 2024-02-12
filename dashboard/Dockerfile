FROM node:18-slim

COPY . ./

RUN yarn install --production && yarn cache clean

#RUN yarn build
#CMD ["yarn", "serve", "-l", "3010" ,"-s", "build"]

CMD ["yarn", "start"]
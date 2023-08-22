FROM node:18

COPY package.json ./

RUN yarn

COPY .. .

EXPOSE 3000

RUN yarn run build
CMD ["yarn", "run", "start"]
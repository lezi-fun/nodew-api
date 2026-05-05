import { createApp } from '../dist/app.js';

let appPromise = null;

const getApp = async () => {
  appPromise ??= createApp().then(async (app) => {
    await app.ready();
    return app;
  });

  return appPromise;
};

export default async function handler(request, response) {
  const app = await getApp();
  app.server.emit('request', request, response);
}

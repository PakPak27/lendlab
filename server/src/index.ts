import { getConfig } from './config.js';
import { createApp } from './app.js';

const config = getConfig();
const app = createApp();

app.listen(config.PORT, () => {
  console.log(`LendLab API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

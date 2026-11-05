import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/ui',fullyParallel:false,workers:1,timeout:45000,
 use:{baseURL:'http://127.0.0.1:3433',viewport:{width:1440,height:900},trace:'retain-on-failure'},
 webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3433',url:'http://127.0.0.1:3433/api/health',reuseExistingServer:!process.env.CI,
  env:{SYNAPSE_LOCAL_DEV:'true'},timeout:120000}
});

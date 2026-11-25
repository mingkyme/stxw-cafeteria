import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: {baseURL:'http://127.0.0.1:4173', browserName:'chromium', timezoneId:'America/Los_Angeles'},
  webServer: {command:'npm run serve', url:'http://127.0.0.1:4173', reuseExistingServer:!process.env.CI},
  projects: [{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  reporter:'list'
});

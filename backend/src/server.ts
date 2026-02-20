import App from './app';
import { HealthController } from './controllers/health.controller';
import { ErrandController } from './controllers/errand.controller';

const app = new App([HealthController, ErrandController]);

app.listen();

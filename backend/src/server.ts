import App from './app';
import { HealthController } from './controllers/health.controller';
import { ErrandController } from './controllers/errand.controller';
import { AuthController } from './controllers/auth.controller';

const app = new App([HealthController, ErrandController, AuthController]);

app.listen();

/**
 * TEMPORÄR: Enkel lösenordsspärr för staging-miljön.
 * Används enbart i test-/demosyfte för att förhindra obehörig åtkomst under PoC-fasen.
 * Ska tas bort helt vid lansering till produktion.
 */
import { STAGE_PASSWORD } from '@/config';
import { Body, Controller, Post, Res } from 'routing-controllers';
import { Response } from 'express';

@Controller()
export class AuthController {
  @Post('/auth/verify')
  async verify(@Body() body: { password: string }, @Res() response: Response): Promise<Response> {
    if (!STAGE_PASSWORD) {
      return response.json({ authorized: true });
    }

    if (body.password === STAGE_PASSWORD) {
      return response.json({ authorized: true });
    }

    return response.status(401).json({ authorized: false, message: 'Fel lösenord' });
  }
}

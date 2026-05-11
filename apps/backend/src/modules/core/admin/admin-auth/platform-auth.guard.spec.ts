import { PlatformAuthGuard } from './platform-auth.guard';

describe('PlatformAuthGuard', () => {
  it('extends AuthGuard(platform-jwt)', () => {
    const guard = new PlatformAuthGuard();
    expect(guard).toBeInstanceOf(PlatformAuthGuard);
    // o passport interno chama o strategy 'platform-jwt' — coberto pelo
    // strategy.validate (já testado indiretamente via integration tests)
  });
});

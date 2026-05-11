import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida que o payload é um Record<UUID, number > 0 | null>.
 * NÃO valida regras de negócio (chave da tabela padrão presente,
 * IDs existem no banco) — isso fica no service.
 */
export function IsPriceMap(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'isPriceMap',
      target: target.constructor,
      propertyName,
      options: { message: 'Mapa de preços inválido', ...options },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            return false;
          }
          for (const [k, v] of Object.entries(
            value as Record<string, unknown>,
          )) {
            if (!UUID_REGEX.test(k)) return false;
            if (v === null) continue;
            if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
              return false;
            }
          }
          return true;
        },
      },
    });
  };
}

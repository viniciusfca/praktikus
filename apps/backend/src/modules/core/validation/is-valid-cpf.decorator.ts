import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCpf } from '@praktikus/shared';

@ValidatorConstraint({ name: 'isValidCpf', async: false })
export class IsValidCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpf(value);
  }

  defaultMessage(): string {
    return 'CPF inválido';
  }
}

export function IsValidCpf(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsValidCpfConstraint,
    });
  };
}

/**
 * Insere as 2 unidades de medida padrão no schema do tenant Recycling
 * recém-criado: Quilograma (kg) e Unidade (unid).
 *
 * Estes inserts rodam na mesma transação que CREATE TABLE units
 * (provisionSchema), então não há risco de ordem ou rollback parcial.
 * O usuário pode renomear/deletar as unidades como qualquer outra —
 * elas não têm flag de "default" no banco.
 */
export function buildUnitsSeedSql(schemaName: string): string[] {
  return [
    `INSERT INTO "${schemaName}".units (name, abbreviation)
       VALUES ('Quilograma', 'kg')`,
    `INSERT INTO "${schemaName}".units (name, abbreviation)
       VALUES ('Unidade', 'unid')`,
  ];
}

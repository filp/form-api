export type ID = string;

export type WithOptionalArchived<T extends { archived: boolean }> = Omit<
  T,
  'archived'
> & { archived?: boolean };

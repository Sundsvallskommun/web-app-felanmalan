export const APIS = [
  {
    name: 'supportmanagement',
    version: '12.4',
  },
  {
    name: 'eneo-sundsvall',
    version: '1.1',
  },
] as const;

export const getApiBase = (name: string) => {
  const api = APIS.find(api => api.name === name);
  return `${api?.name}/${api?.version}`;
};

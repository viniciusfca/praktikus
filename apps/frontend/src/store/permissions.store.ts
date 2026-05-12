import { create } from 'zustand';
import {
  employeesService,
  type EmployeePermissions,
} from '../services/recycling/employees.service';

interface PermissionsState {
  permissions: EmployeePermissions | null;
  loading: boolean;
  fetch: () => Promise<void>;
  clear: () => void;
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  permissions: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const permissions = await employeesService.getMyPermissions();
      set({ permissions, loading: false });
    } catch {
      // Em caso de falha (ex.: 403 por status do tenant), zera para que
      // a sidebar esconda itens granulares por segurança.
      set({ permissions: null, loading: false });
    }
  },
  clear: () => set({ permissions: null, loading: false }),
}));

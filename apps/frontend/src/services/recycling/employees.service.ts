import { api } from '../api';

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface EmployeePermissions {
  userId: string;
  canManageSuppliers: boolean;
  canManageBuyers: boolean;
  canManageProducts: boolean;
  canOpenCloseCash: boolean;
  canViewStock: boolean;
  canViewReports: boolean;
  canRegisterPurchases: boolean;
  canRegisterSales: boolean;
}

export const employeesService = {
  async list(): Promise<Employee[]> {
    const { data } = await api.get<Employee[]>('/recycling/employees');
    return data;
  },

  async create(payload: { name: string; email: string; password: string }): Promise<Employee> {
    const { data } = await api.post<Employee>('/recycling/employees', payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/recycling/employees/${id}`);
  },

  async getPermissions(id: string): Promise<EmployeePermissions> {
    const { data } = await api.get<EmployeePermissions>(`/recycling/employees/${id}/permissions`);
    return data;
  },

  async updatePermissions(id: string, perms: Partial<EmployeePermissions>): Promise<EmployeePermissions> {
    const { data } = await api.patch<EmployeePermissions>(`/recycling/employees/${id}/permissions`, perms);
    return data;
  },
};

import { InvoiceStatus, BillingType } from '@praktikus/shared';

export interface OpenInvoiceDto {
  id: string;
  asaasPaymentId: string;
  value: number;
  dueDate: string;
  status: InvoiceStatus;
  billingType: BillingType;
  pix: { qrCodeBase64: string; copyPaste: string } | null;
}

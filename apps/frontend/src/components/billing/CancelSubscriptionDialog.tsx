import { CModal, CModalHeader, CModalBody, CModalFooter, CButton } from '@coreui/react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function CancelSubscriptionDialog({ open, onClose, onConfirm }: Props) {
  return (
    <CModal visible={open} onClose={onClose} alignment="center">
      <CModalHeader>Cancelar assinatura</CModalHeader>
      <CModalBody>
        <p>Você terá acesso ao Praktikus até o final do ciclo atual já pago.</p>
        <p>Após esse período, sua conta será suspensa. Tem certeza?</p>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose}>Voltar</CButton>
        <CButton color="danger" onClick={async () => { await onConfirm(); onClose(); }}>
          Cancelar assinatura
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

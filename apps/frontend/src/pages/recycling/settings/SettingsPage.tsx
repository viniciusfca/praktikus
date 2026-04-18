import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBuilding, cilOptions, cilUser, cilCreditCard } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { useAuthStore } from '../../../store/auth.store';
import { CompanyTab } from '../../../components/settings/CompanyTab';
import { AccountTab } from '../../../components/settings/AccountTab';
import { SubscriptionTab } from '../../../components/settings/SubscriptionTab';
import { UnitsTab } from './UnitsTab';

const TABS = [
  { label: 'Empresa', icon: cilBuilding },
  { label: 'Unidades de medida', icon: cilOptions },
  { label: 'Minha conta', icon: cilUser },
  { label: 'Assinatura', icon: cilCreditCard },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/recycling/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'OWNER') return null;

  return (
    <>
      <PageHead
        title="Configurações"
        subtitle="Gerencie os dados da sua empresa, unidades de medida, conta e assinatura"
      />

      <div style={{ borderBottom: '1px solid var(--cui-border-color)', marginBottom: 20 }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          {TABS.map((t, i) => (
            <CNavItem key={t.label}>
              <CNavLink
                active={activeTab === i}
                onClick={() => setActiveTab(i)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={t.icon} size="sm" /> {t.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}><CompanyTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><UnitsTab /></CTabPane>
        <CTabPane visible={activeTab === 2}><AccountTab /></CTabPane>
        <CTabPane visible={activeTab === 3}><SubscriptionTab /></CTabPane>
      </CTabContent>
    </>
  );
}

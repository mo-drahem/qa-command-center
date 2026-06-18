import { useState } from 'react';
import BusinessScenariosPanel from './logger/BusinessScenariosPanel';
import LookupPanel from './logger/LookupPanel';
import NarrativeTab from './logger/NarrativeTab';
import PromotionsPanel from './logger/PromotionsPanel';
import SavedReportsDrawer from './logger/SavedReportsDrawer';

const TABS = [
  { id: 'narrative', label: 'Narrative Tool' },
  { id: 'lookup', label: 'Data Lookup' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'businessScenarios', label: 'Business Scenarios' },
];

export default function LoggerView() {
  const [activeTab, setActiveTab] = useState('narrative');
  const [savedOpen, setSavedOpen] = useState(false);
  const [promoEnvironment, setPromoEnvironment] = useState('dev');
  const [scenarioEnvironment, setScenarioEnvironment] = useState('staging');
  const [lookupPrefill, setLookupPrefill] = useState({ type: 'orderNumber', value: '' });
  const [narrativeReload, setNarrativeReload] = useState(null);

  function handleVitalLookup(type, value) {
    setLookupPrefill({ type, value });
    setActiveTab('lookup');
  }

  function handleOpenPromotions() {
    setActiveTab('promotions');
  }

  function handleLoadSavedReport(report) {
    setSavedOpen(false);
    setActiveTab('narrative');
    setNarrativeReload({ tracerId: report.tracerId, environment: report.environment, key: Date.now() });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center relative">
          <h1 className="text-3xl font-bold text-gray-900">🛠 QA Command Center</h1>
          <p className="mt-2 text-gray-500">
            Narratives, OMS lookup, pricing promotions, and business scenario actions (dev/staging/production).
          </p>
          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="absolute right-0 top-0 text-sm font-semibold text-blue-600 hover:underline"
          >
            Saved reports
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-2 border border-gray-100 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={activeTab === 'narrative' ? undefined : 'hidden'}>
          <NarrativeTab
            key={narrativeReload?.key ?? 'narrative-session'}
            initialTracerId={narrativeReload?.tracerId}
            initialEnvironment={narrativeReload?.environment}
            onVitalLookup={handleVitalLookup}
          />
        </div>

        <div className={activeTab === 'lookup' ? undefined : 'hidden'}>
          <LookupPanel
            key={`${lookupPrefill.type}-${lookupPrefill.value}`}
            initialType={lookupPrefill.type}
            initialValue={lookupPrefill.value}
            onOpenPromotions={handleOpenPromotions}
          />
        </div>

        <div className={activeTab === 'promotions' ? undefined : 'hidden'}>
          <PromotionsPanel
            environment={promoEnvironment}
            onEnvironmentChange={setPromoEnvironment}
          />
        </div>

        <div className={activeTab === 'businessScenarios' ? undefined : 'hidden'}>
          <BusinessScenariosPanel
            environment={scenarioEnvironment}
            onEnvironmentChange={setScenarioEnvironment}
          />
        </div>
      </div>

      <SavedReportsDrawer
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onLoadReport={handleLoadSavedReport}
      />
    </div>
  );
}
